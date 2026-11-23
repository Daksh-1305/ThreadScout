import {analyze} from './analysis.js';
import {aiReview, chatBrief, records} from './intelligence.js';
const $ = id => document.getElementById(id);
const el = (tag,text) => Object.assign(document.createElement(tag), {textContent:text});
let mode = 'replies', data = null, originTab = null;
const edits = new Map();
function source(post) {
  const a = el('a', post.author+' ↗');
  Object.assign(a,{href:post.url,target:'_blank',rel:'noopener noreferrer',title:post.text});
  return a;
}
function editor(card,key,initial) {
  const label = el('label','Editable draft');
  const field = document.createElement('textarea');
  field.value = edits.get(key) ?? initial;
  label.append(field);
  const row = el('div',''), count = el('small',''), copy = el('button','Copy draft');
  row.className = 'row'; row.append(count,copy); card.append(label,row);
  function update() {
    // Conservative upper bound for mixed-script text. Long URLs may cost fewer units on X.
    const units = [...field.value.normalize('NFC')].reduce((sum,c) => sum+(c.codePointAt(0)<=0x10ff ? 1 : 2),0);
    count.textContent = units+' / 280 (estimate)';
    copy.disabled = !field.value.trim() || units>280;
    copy.textContent='Copy draft';
  }
  update();
  field.oninput = () => { edits.set(key,field.value); update(); };
  copy.onclick = async () => {
    try {await navigator.clipboard.writeText(field.value); copy.textContent='Copied';}
    catch {field.focus(); field.select(); $('status').textContent='Draft selected. Press Ctrl+C to copy.';}
  };
}
function render() {
  const out=$('results'); out.replaceChildren();
  for(const id of ['replies','ideas']) $(id).setAttribute('aria-pressed',String(id===mode));
  if (!data) return;
  const list=data[mode];
  if (!list.length) out.append(el('p','No matching discussion in this scan. Scroll Home and scan again.'));
  for(const item of list) {
    const card=el('article',''); out.append(card);
    if(mode==='replies') {
      const {p,draft,reason}=item;
      card.append(source(p),el('blockquote',p.text),el('p',reason+'.'));
      editor(card,reviewType+'r'+p.id,draft);
    } else {
      const [topic,entries]=item;
      card.append(el('h2',topic[1]),el('p',topic[3]));
      const sources=el('p',entries.length===1?'Inspired by ':'Recurring in '+entries.length+' posts · ');
      entries.forEach(({p},i)=>{if(i) sources.append(' · '); sources.append(source(p));});
      card.append(sources);
      if(entries.some(({p})=>/\b(launch\w*|announc\w*|releas\w*|leak\w*|reportedly|rumou?r\w*)\b/i.test(p.text))) card.append(el('p','Verify the announcement against the original source before publishing.'));
      editor(card,reviewType+'i'+topic[1],topic[4]);
    }
  }
}
for(const id of ['replies','ideas']) $(id).onclick=()=>{mode=id;render();};
let batch=[], scanId=null, running=false, reviewType='local';
let statusTimer;
function show(scan){
  if(!scan) return;
  running=scan.running;
  clearTimeout(statusTimer);
  $('separate').hidden=!running;
  if(scan.id!==scanId){
    if(originTab!==scan.tabId) edits.clear();
    originTab=scan.tabId;scanId=scan.id;reviewType='local';data=null;batch=[];
    $('feedback').textContent='';$('payload').textContent='';render();
  }
  $('scan').disabled=scan.running;$('stop').hidden=!scan.running;$('target').disabled=scan.running;
  $('target').value=String(scan.target);
  $('ai').hidden=scan.running || !scan.posts.length;
  if(scan.running){
    const count=scan.posts.length+' / '+scan.target;
    $('status').textContent='Collecting '+count+' in the original X tab.';
    statusTimer=setTimeout(()=>{
      $('status').textContent=count+' collected · Waiting for X to load. If the count stays here, move X to its own visible window.';
    }, Math.max(0,15000-(Date.now()-(scan.lastGrowth||Date.now()))));
  }else{
    batch=scan.posts;data=analyze(batch);reviewType='local';
    $('status').textContent=batch.length+' unique posts analyzed · '+scan.reason;
    $('payload').textContent=JSON.stringify(records(batch),null,2);
    $('scan').textContent='Scan again';render();
  }
}
let changed=false;
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='session' && changes.scan){changed=true;show(changes.scan.newValue);}
});
chrome.storage.session.get('scan').then(({scan})=>{if(!changed) show(scan);});
$('separate').onclick=async()=>{
  try {
    const result=await chrome.runtime.sendMessage({type:'separate',id:scanId});
    if(!result?.ok) throw Error(result?.error||'The scan has ended.');
    $('status').textContent='Keep the X window visible beside your other browser window.';
  }catch(error){$('status').textContent=error.message;}
};
$('stop').onclick=()=>chrome.runtime.sendMessage({type:'stop',id:scanId});
$('scan').onclick=async()=>{
  $('scan').disabled=true;
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    const answer=await chrome.tabs.sendMessage(tab.id,{type:'launch',target:Number($('target').value)});
    if(!answer?.ok) throw Error(answer?.error || 'Refresh X Home and try again.');
  }catch(error){
    $('status').textContent=/Receiving end|connection|No tab/i.test(error.message)?'Open X Home and refresh it after updating ThreadScout.':error.message;
    $('scan').disabled=false;
  }
};
$('brief').onclick=async()=>{
  const text=chatBrief(batch);
  try {await navigator.clipboard.writeText(text);$('feedback').textContent='Copied. Paste the brief into ChatGPT to review these posts.';}
  catch {const field=document.createElement('textarea');field.value=text;$('feedback').replaceChildren(field);field.focus();field.select();}
};
$('send').onclick=async()=>{
  const reviewedScan=scanId, reviewedPosts=batch;
  const key=$('key').value.trim();
  if(!key){$('feedback').textContent='Enter an API key, or use Copy brief for ChatGPT.';return;}
  $('send').disabled=true;$('scan').disabled=true;
  try{
    const allowed=await chrome.permissions.request({origins:['https://api.openai.com/*']});
    if(!allowed) throw Error('Permission declined. Your local results are available.');
    $('feedback').textContent='OpenAI is reviewing '+batch.length+' posts…';
    if(scanId!==reviewedScan) return;
    const review=await aiReview(reviewedPosts,key);
    if(scanId!==reviewedScan) return;
    reviewType='ai'; data=review;render();
    $('feedback').textContent='OpenAI review complete · '+review.replies.length+' replies and '+review.ideas.length+' ideas.';
  }catch(e){$('feedback').textContent=e.message;}
  finally{$('key').value='';$('send').disabled=false;$('scan').disabled=running;}
};
