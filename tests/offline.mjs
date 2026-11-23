import assert from 'node:assert/strict';
import {analyze} from '../extension/analysis.js';
const source=(id,text)=>({id, text, author:'@tester',url:'https://x.com/tester/status/'+id,date:new Date().toISOString()});
const posts=[source(1,'Why does my RTX 3050 stutter at 1080p with higher texture quality?'),source(2,'Would lower VRAM use improve frame times?'),source(3,'Firebase launched offline sync. Has anyone tested it?'),source(4,'What’s for dinner?')];
const result=analyze(posts);
assert.equal(result.replies.length,2);
assert.match(result.replies[0].draft,/RTX 3050 at 1080p/);
assert.match(result.replies[1].draft,/offline edits/);
assert.equal(result.ideas[0][1].length,2);
assert.deepEqual(analyze([]),{replies:[],ideas:[]});
for(const v of result.replies) assert.ok(v.draft.length<280);

// Exercise the shipped panel with in-memory substitutes for the browser services.
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.value='';}
  append(...children){this.children.push(...children);}
  replaceChildren(){this.children=[];}
  setAttribute(name,value){this[name]=value;}
  all(tag){return this.children.filter(x=>x instanceof Element).flatMap(x=>[...(x.tag===tag?[x]:[]),...x.all(tag)]);}
}
const ids=Object.fromEntries(['scan','ideas','replies','results','status','target','stop','separate','ai','brief','send','feedback','payload','key'].map(k=>[k,new Element('div')]));
globalThis.document={getElementById:id=>ids[id],createElement:tag=>new Element(tag)};
let response={posts,at:Date.now()}, changed;
globalThis.chrome={storage:{session:{get:async()=>({})},onChanged:{addListener:fn=>changed=fn}},tabs:{query:async()=>[{id:5}],sendMessage:async()=>{
  if(response.error) return response;
  changed({scan:{newValue:{id:'1',tabId:5,target:100,running:false,posts,reason:'Target reached'}}},'session');
  return {ok:true};
}}};
let clipboard='';
Object.defineProperty(navigator,'clipboard',{value:{writeText:async v=>{clipboard=v;}}});
await import('../extension/panel.js');
await ids.scan.onclick();
assert.match(ids.status.textContent,/4 unique posts/);
assert.equal(ids.results.all('a')[0].href,posts[0].url);
let field=ids.results.all('textarea')[0];
field.value='My own reply'; field.oninput();
ids.ideas.onclick();
assert.match(ids.results.all('p').map(x=>x.textContent).join(' '),/Verify the announcement/);
ids.replies.onclick();
assert.equal(ids.results.all('textarea')[0].value,'My own reply');
await ids.results.all('button')[0].onclick();
assert.equal(clipboard,'My own reply');
field=ids.results.all('textarea')[0];field.value='a'.repeat(281);field.oninput();
assert.ok(ids.results.all('button')[0].disabled);
response={error:'Sign in to X'};await ids.scan.onclick();assert.equal(ids.results.all('article').length,2);
assert.match(ids.status.textContent,/Sign in to X/);
console.log('Passed fixture analysis and panel workflow checks.');
// Feed the message listener representative card objects: ordinary timestamp anchor,
// quoted text, promoted card, repeated status, missing metrics and a compact count.
let listener;
chrome.runtime={id:'fixture',onMessage:{addListener:fn=>{listener=fn;}}};
globalThis.location={pathname:'/home'};
function card(id,promoted=false){
  const item={parentElement:{closest:()=>null},closest:()=>promoted};
  const own={closest:sel=>sel.startsWith('article')?item:null};
  const time={dateTime:posts[0].date,closest:sel=>['a','a[href]'].includes(sel)?{pathname:'/tester/status/'+id}:own.closest(sel)};
  const nested={innerText:'quoted body',closest:()=>({})};
  const like={...own,getAttribute:()=> '1.2K Likes'};
  item.querySelectorAll=sel=>sel==='time'?[time]:sel.includes('tweetText')?[nested,{...own,innerText:'Real body'}]:sel.includes('like')?[like]:[];
  return item;
}
const feed={querySelectorAll:()=>[card(10),card(10),card(11,true)]};
document.querySelector=sel=>sel.includes('primaryColumn')?feed:null;
await import('../extension/reader.js');
let scanned;
const scan=()=>listener({type:'scan-home'},{id:'fixture'},r=>{scanned=r;});
scan();
assert.equal(scanned.posts.length,1);
assert.equal(scanned.duplicates,1);assert.equal(scanned.skipped,1);
assert.equal(scanned.posts[0].likes,1200);assert.equal(scanned.posts[0].replies,null);
assert.equal(scanned.posts[0].text,'Real body');
location.pathname='/i/flow/login';scan();assert.match(scanned.error,/Sign in/);
console.log('Passed timeline reader fixture checks.');
