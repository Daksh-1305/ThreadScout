import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const collect=vm.runInThisContext(readFileSync(new URL('../extension/collector.js',import.meta.url),'utf8')+';collect');
import {mapOutput,records,chatBrief,aiReview} from '../extension/intelligence.js';
const feed=Array.from({length:140},(_,i)=>({id:String(i+1),author:'@sample',text:'Sample '+i,url:'https://x.com/sample/status/'+(i+1),date:'2026-01-01',likes:i,replies:1}));
const immediate=async()=>{};
for(const target of [50,100]){
  let offset=0, first=true;
  const result=await collect(target,async step=>{
    if(first){assert.equal(step,'top');first=false;return {reset:true};}
    const posts=feed.slice(offset,offset+8);offset+=3;return {posts,position:offset};
  },()=>{},()=>false,immediate);
  assert.deepEqual(result.posts,feed.slice(0,target));assert.equal(result.reason,'Target reached');
}
let attempts=0;
const resumed=await collect(50,async()=>{
  attempts++;
  return {posts:feed.slice(0,attempts<=320?5:50),position:0,hidden:true};
},()=>{},()=>false,immediate);
assert.equal(resumed.posts.length,50);
let turn=0;
const stalled=await collect(100,async()=>({posts:feed.slice(0,7),position:1}),()=>{},()=>false,immediate);
assert.equal(stalled.posts.length,7);assert.match(stalled.reason,/stopped loading/);
const partial=await collect(100,async()=>turn++?{error:'Left Home'}:{posts:feed.slice(0,8),position:0},()=>{},()=>false,immediate);
assert.equal(partial.posts.length,8);assert.equal(partial.reason,'Left Home');
const stopped=await collect(100,async()=>({posts:feed.slice(0,4),position:0}),()=>{turn=8;},()=>turn===8,immediate);
assert.equal(stopped.posts.length,4);
const posts=feed.slice(0,100);
const output={replies:[{source:100,reason:'A specific question',draft:'How did you measure it?'},{source:101,reason:'Missing',draft:'Wrong.'}],ideas:[{sources:[2,100],title:'Measure it',angle:'Compare both tests',draft:'What changed between runs?'}]};
const result=mapOutput(output,posts);assert.equal(result.replies.length,1);assert.equal(result.replies[0].p,posts[99]);assert.equal(result.ideas[0][1][1].p,posts[99]);
assert.ok(chatBrief(posts).includes(posts[99].url));
assert.ok(!JSON.stringify(records(posts)).includes('@sample'));
globalThis.fetch=async(url,opts)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');const req=JSON.parse(opts.body);
  assert.equal(JSON.parse(req.input).length,100);assert.equal(req.store,false);
  return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]})};
};
assert.deepEqual(await aiReview(posts,'fixture'),result);
globalThis.fetch=async()=>({ok:false,status:429});await assert.rejects(aiReview(posts,'fixture'),/429/);
console.log('Passed overlapping 50/100-post windows, partial scans, stop, source mapping, AI request and error cases.');
