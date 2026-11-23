import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const script=name=>readFileSync(new URL('../extension/'+name,import.meta.url),'utf8');
const event=()=>({addListener(fn){this.fn=fn;}});
const url='chrome-extension://test/panel.html';
const runtime={id:'test',getURL:()=>url,onMessage:event()};
let movedTab=null;
const windows={create:async options=>{movedTab=options;}};
const tabs={onRemoved:event(),onUpdated:event(),get:async id=>({id,windowId:7}),query:async()=>[{id:1},{id:2}]};
let state, afterSave=()=>{};
const session={get:async()=>({scan:state}),set:async({scan})=>{state=structuredClone(scan);afterSave();}};
const waits=[];
vm.runInNewContext(script('worker.js'),{chrome:{runtime,tabs,windows,sidePanel:{setPanelBehavior(){}},storage:{session}},crypto:webcrypto,setTimeout:f=>waits.push(f)});
const message=(msg,sender)=>new Promise(resolve=>runtime.onMessage.fn(msg,{id:'test',...sender},resolve));
function tab(id){
  const sender={tab:{id},documentId:'doc'+id,frameId:0,url:'https://x.com/home'};
  const pageRuntime={...runtime,onMessage:event(),sendMessage:msg=>message(msg,sender)};
  const sleeps=waits;
  const window={scrollY:0,scrollBy(){this.scrollY+=1;},scrollTo(){this.scrollY=0;}};
  const feed={querySelectorAll:()=>Array.from({length:5},(_,n)=>{
    const item={parentElement:{closest:()=>null},closest:()=>null};
    const own={closest:s=>s.startsWith('article')?item:null};
    const anchor={pathname:'/tester/status/'+(id*1000+window.scrollY*3+n)};
    const time={dateTime:'2026-01-01',closest:s=>s.startsWith('a[')||s==='a'?anchor:own.closest(s)};
    item.querySelectorAll=s=>s==='time'?[time]:s.includes('tweetText')?[{...own,innerText:'Source '+id}]:[];
    return item;
  })};
  const doc={hidden:false,querySelector:s=>s.includes('primaryColumn')?feed:null};
  const context=vm.createContext({window,document:doc,innerHeight:800,location:{pathname:'/home'},chrome:{runtime:pageRuntime},setTimeout:()=>{throw Error("Hidden page timer used");}});
  vm.runInContext(script('collector.js'),context);
  vm.runInContext(script('reader.js'),context);
  return {doc,window,sender,sleeps,launch:()=>new Promise(r=>pageRuntime.onMessage.fn({type:'launch',target:50},{id:'test',url},r))};
}
const a=tab(1), b=tab(2);
const tick=()=>new Promise(r=>setImmediate(r));
await a.launch();await tick();
assert.equal(state.posts.length,5);
a.doc.hidden=true; // No panel listeners remain; both tabs are X Home.
assert.match((await b.launch()).error,/already running/);
await message({type:'separate',id:state.id},{url});
assert.equal(movedTab.tabId,1);assert.equal(movedTab.focused,false);
while(state.running && a.sleeps.length){a.sleeps.shift()();await tick();}
assert.equal(state.posts.length,50);assert.equal(state.running,false);
assert.equal(b.window.scrollY,0);assert.ok(state.posts.every(p=>p.text==='Source 1'));
assert.equal((await session.get('scan')).scan.reason,'Target reached');
await b.launch();await tick();const checkpoint=state.posts.length;
await message({type:'stop',id:state.id},{url});b.sleeps.shift()();await tick();
assert.equal(state.reason,'Stopped by you');assert.equal(state.posts.length,checkpoint);
await a.launch();await tick();tabs.onRemoved.fn(2);await tick();assert.equal(state.running,true);
tabs.onRemoved.fn(1);await tick();assert.equal(state.reason,'Original tab closed');
await b.launch();await tick();tabs.onUpdated.fn(2,{status:'loading'});await tick();
assert.equal(state.running,false);assert.ok(state.posts.length>0);
console.log('Passed hidden source tab, competing X tab, panel-independent completion, session restoration, stop, navigation and closure.');
