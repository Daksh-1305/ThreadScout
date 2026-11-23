// Each rule pairs a narrow reading of a discussion with a concrete way to contribute.
const topics = [
  [/\b(VRAM|frame ?times?|texture quality|1% lows?)\b/i, 'Frame pacing', 'Would the stutter show up in a frame-time graph? I’d compare the same route twice with only texture quality changed.', 'Run the same route at two texture settings and record the frame times.', 'Can dropping textures one step make a game feel smoother on a 4 GB GPU? My test would be the same save, the same route and a frame-time graph for each run.'],
  [/\b(Supabase|Firebase)\b/i, 'Backend choices', 'Which part of the app drove your choice: sign-in, querying related records, or syncing changes to the client?', 'Build the same tiny feature twice and compare the code each version needs.', 'My test for Firebase vs Supabase: build a shared notes app. Give a second user read-only access, then revoke it. Which setup makes that rule easiest to get right?'],
  [/\b(vibe coding|AI coding|coding agents?|Copilot|Codex|Claude Code)\b/i, 'AI-assisted coding', 'What happens if you ask for one change after the first version works? I’d check whether the original behavior survives the edit.', 'Try a follow-up change and rerun the original acceptance checks.', 'An AI coding test I’d actually read: build a small feature, change one requirement, then rerun the first three checks. How much did you have to fix by hand?'],
  [/\b(benchmark|LLM|language model|GPT[- ]?\d|Claude|Gemini)\b/i, 'Model comparisons', 'Can we see one input where the model struggled, alongside the scoring rule? That would help me judge whether the result applies to my own work.', 'Compare two tools on the same input with a scoring rule written in advance.', 'Before comparing two AI models, write down what a good answer has to include. Give both the same messy input and score them blind. Which mistake would actually cost you time?'],
  [/\b(backend interview|system design|database index|slow quer(?:y|ies))\b/i, 'Backend trade-offs', 'What would you measure first if that endpoint slowed down: time spent waiting for the database, or time spent processing the result?', 'Trace a single slow request and explain the first measurement you would take.', 'Backend interview question: an endpoint just got twice as slow. You can add one measurement before touching the code. Where do you put it, and what would the result tell you?'],
  [/\b(PS5|gaming PC|console gaming)\b/i, 'Gaming hardware', 'Which three games would you buy the machine for? My answer changes a lot once mods, local multiplayer or a PC-only game enters the picture.', 'Price a setup around three actual games and how you like to play them.', 'Picking between a PS5 and a PC? Start with the next three games you’ll actually play. Then check where your friends play, whether you want mods and what the whole setup costs. What made the choice for you?'],
  [/\b(Minecraft|Fabric loader)\b/i, 'Minecraft', 'Which version and mod list are you running? I’d keep a clean profile on the same seed so there’s a baseline to compare with.', 'Show one mod at a time using the same seed and render distance.', 'A Minecraft mod comparison I’d save: same seed, same route, same render distance. Add one mod per run. Show the frame-time spikes when new chunks load.'],
  [/\b(game story|storytelling|RDR2|Red Dead Redemption|Far Cry 3|Vice City|Blood Money)\b/i, 'Game storytelling', 'Which playable moment sold you on the character? I’m curious whether it was something you did yourself or something you watched in a cutscene.', 'Choose one playable decision and describe how it changed your reading of a character.', 'What’s one game where a tiny thing you did between missions told you more about a character than a cutscene did? I want the scene that stuck with you.'],
  [/\b(Linux|Windows 11|SteamOS)\b/i, 'Everyday computing', 'What’s the one everyday task you’d test before switching? For me that would include launching a game with the exact peripherals I already use.', 'Trace a real daily task from setup to completion on each system.', 'My OS-switch checklist starts with a boring question: will my usual game, headset and screen recorder all work together? A five-minute test of my actual setup tells me more than a feature list.']
];
// Prefer an explicit detail in the source when it changes the question worth asking.
function replyFor(text, topic) {
  if (topic[1] === 'Frame pacing') {
    const gpu = text.match(/\b(?:RTX|GTX|RX)\s?\d{3,4}(?:\s?(?:Ti|XT))?\b/i)?.[0];
    const resolution = text.match(/\b(?:720p|1080p|1440p|2160p|4K)\b/i)?.[0];
    if (gpu || resolution) return `I'd try the same save twice${gpu ? ' on the '+gpu : ''}${resolution ? ' at '+resolution : ''}, changing only textures. Do the frame-time spikes move even if average FPS barely changes?`;
  }
  if (topic[1] === 'Backend choices' && /offline|sync/i.test(text))
    return 'How does it handle two offline edits to the same note? That’s the first case I’d try before choosing the sync layer.';
  if (topic[1] === 'Model comparisons' && /cheap|price|cost/i.test(text))
    return 'What was the cost per accepted answer once you counted retries? I’d want that number alongside the headline price.';
  if (topic[1] === 'AI-assisted coding' && /tests?|regression/i.test(text))
    return 'Did you write the failing test before giving the task to the agent? I’d be curious if it passes a second case it never saw.';
  return topic[2];
}
export function analyze(posts, now = Date.now()) {
  const groups = new Map();
  const candidates = [];
  for (const p of posts) {
    const topic = topics.find(([pattern]) => pattern.test(p.text));
    if (!topic || /\b(giveaway|follow for follow|like and repost)\b/i.test(p.text)) continue;
    const question = p.text.includes('?');
    const substantive = /\b(compare|versus|vs|test|tested|switch|why|because|launch|release|better|stutter|performance|struggled|trade.?off|issue|problem|story|benchmark)\b/i.test(p.text);
    if (!question && !substantive) continue;
    const hours = (now - Date.parse(p.date)) / 3600000;
    const fresh = hours >= 0 && hours < 24;
    const discussion = p.replies > 0 && p.replies < 50;
    const score = 4 * question + 2 * fresh + Number(discussion) + Number(p.likes > 0);
    const entry = {p, topic, score, draft:replyFor(p.text,topic), reason: [question ? 'The author asks a question' : 'The post raises a comparison or claim', fresh && 'posted within 24 hours', discussion && (p.replies+' existing replies')].filter(Boolean).join(' · ')};
    candidates.push(entry);
    if (!groups.has(topic)) groups.set(topic, []);
    groups.get(topic).push(entry);
  }
  const sorted = candidates.sort((a,b) => b.score-a.score);
  const seen = new Set();
  const replies = sorted.filter(({topic}) => !seen.has(topic) && seen.add(topic)).slice(0,5);
  const ideas = [...groups].sort((a,b) => b[1].length-a[1].length || Math.max(...b[1].map(e=>e.score))-Math.max(...a[1].map(e=>e.score))).slice(0,4);
  return {replies, ideas};
}
