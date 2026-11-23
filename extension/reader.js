// X uses client-side navigation. Check the route on every manual request.
(() => {
  function scan() {
    if (/^\/(?:login|i\/flow\/login)(?:\/|$)/.test(location.pathname) ||
        document.querySelector('[data-testid="loginButton"],input[autocomplete="username"]')) {
      return {error: 'Sign in to X, then open Home and analyze again.'};
    }
    if (!/^\/home\/?$/.test(location.pathname)) return {error: 'Open your X Home timeline to run a scan.'};
    const feed = document.querySelector('[data-testid="primaryColumn"]') || document.querySelector('main');
    if (!feed && document.hidden) return {posts:[]};
    if (!feed) return {error: 'Home is loading or its layout has changed. Refresh X and try again.'};
    const items = [...feed.querySelectorAll('article,[data-testid="tweet"]')].filter(a =>
      !a.parentElement.closest('article,[data-testid="tweet"]'));
    if (!items.length) {
      if (feed.querySelector('[data-testid="emptyState"]')) return {error:'Your Home timeline is empty.'};
      return {posts:[]};
    }
    const seen = new Set(), posts = [];
    let skipped = 0, duplicates = 0;
    for (const item of items) {
      const own = selector => [...item.querySelectorAll(selector)].filter(e =>
        e.closest('article,[data-testid="tweet"]') === item && !e.closest('div[role="link"],[data-testid="quoteTweet"]'));
      const time = own('time').find(e => e.closest('a[href]'));
      const path = time?.closest('a').pathname;
      const match = path?.match(/^\/(\w{1,15})\/status\/(\d+)\/?$/);
      const body = own('[data-testid="tweetText"]')[0]?.innerText.trim();
      if (!match || !body || item.closest('[data-testid="placementTracking"]')) { skipped++; continue; }
      if (seen.has(match[2])) { duplicates++; continue; }
      seen.add(match[2]);
      function metric(selector) {
        const button = own(selector)[0];
        const raw = button?.getAttribute('aria-label') || button?.innerText || '';
        const m = raw.match(/^\s*(\d[\d,]*(?:\.\d+)?)\s*([KMB])?\b/i);
        return m ? Math.round(Number(m[1].replaceAll(',', '')) * ({K:1e3,M:1e6,B:1e9}[m[2]?.toUpperCase()] || 1)) : null;
      }
      posts.push({id:match[2], author:'@'+match[1], url:'https://x.com'+path, text:body,
        date:time.dateTime, replies:metric('[data-testid="reply"]'), likes:metric('[data-testid="like"],[data-testid="unlike"]')});
    }
    return {posts, skipped, duplicates, at:Date.now()};
  }
  function readStep(step) {
    const batch = scan();
    if (batch.error || !step) return batch;
    if (step === 'top' && window.scrollY > 1) {
      window.scrollTo({top:0,behavior:'instant'});
      return {reset:true};
    }
    batch.position = window.scrollY;
    if (step === 'advance') window.scrollBy({top:Math.max(250,Math.floor(innerHeight*0.78)),behavior:'instant'});
    return batch;
  }
  async function run(id,target) {
    const send=(type,fields={})=>chrome.runtime.sendMessage({type,id,...fields});
    let lastCount=-1;
    try {
      const result=await collect(target,async step=>{
        const lease=await send('active');
        if(!lease?.ok) return {error:'Scan ended'};
        return {...readStep(step),hidden:document.hidden};
      },async (count,posts)=>{
        if(count===lastCount) return;
        const saved=await send('progress',{posts});
        if(!saved?.ok) throw Error('Scan ended');
        lastCount=count;
      },()=>false,async ms=>{
        const response=await send('delay',{ms});
        if(!response?.ok) throw Error('Scan ended');
      });
      await send('finish',{reason:result.reason});
    } catch(error) {
      await send('finish',{reason:error.message}).catch(()=>{});
    }
  }
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if(sender.id !== chrome.runtime.id) return;
    if(msg.type==='scan-home') {reply(readStep(msg.step));return;}
    if(msg.type!=='launch' || sender.url!==chrome.runtime.getURL('panel.html')) return;
    const initial=scan();
    if(initial.error){reply({error:initial.error});return;}
    chrome.runtime.sendMessage({type:'begin',target:msg.target}).then(answer=>{
      if(answer?.ok) void run(answer.id,msg.target);
      reply(answer);
    }).catch(error=>reply({error:error.message}));
    return true;
  });
})();
