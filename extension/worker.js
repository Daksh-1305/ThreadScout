chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});

// One writer serializes starts, checkpoints, stops and tab lifecycle events.
let pending=Promise.resolve();
function transaction(action) {
  const next=pending.then(async()=>action((await chrome.storage.session.get('scan')).scan));
  pending=next.catch(()=>{});
  return next;
}
const save=scan=>chrome.storage.session.set({scan});
const finish=(scan,reason)=>save({...scan,running:false,reason});
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(sender.id!==chrome.runtime.id) return;
  const result=transaction(async scan=>{
    const panel=sender.url===chrome.runtime.getURL('panel.html');
    if(msg.type==='separate' && panel && scan?.running && scan.id===msg.id){
      const tab=await chrome.tabs.get(scan.tabId);
      if((await chrome.tabs.query({windowId:tab.windowId})).length===1) return {ok:true};
      await chrome.windows.create({tabId:scan.tabId,focused:false,type:'normal'});
      return {ok:true};
    }
    if(msg.type==='stop' && panel){
      if(scan?.running && scan.id===msg.id) await finish(scan,'Stopped by you');
      return {ok:true};
    }
    if(!sender.tab || sender.frameId!==0) return {ok:false};
    if(msg.type==='begin'){
      if(!/^https:\/\/x\.com\/home\/?(?:[?#].*)?$/.test(sender.url) || ![50,100].includes(msg.target))
        return {error:'Open X Home to start a scan.'};
      if(scan?.running) return {error:'A scan is already running in the original tab.'};
      const id=crypto.randomUUID();
      await save({id,tabId:sender.tab.id,documentId:sender.documentId,target:msg.target,posts:[],running:true,lastGrowth:Date.now()});
      return {ok:true,id};
    }
    if(!scan?.running || scan.id!==msg.id || scan.tabId!==sender.tab.id || scan.documentId!==sender.documentId) return {ok:false};
    if(msg.type==='progress') await save({...scan,posts:msg.posts,lastGrowth:Date.now()});
    if(msg.type==='finish') await finish(scan,msg.reason);
    return {ok:true};
  });
  // Wait in the extension worker, outside the state transaction and hidden page timers.
  result.then(async answer=>{
    if(answer.ok && msg.type==='delay') await new Promise(resolve=>setTimeout(resolve,Math.min(5000,Math.max(500,Number(msg.ms)||700))));
    reply(answer);
  },error=>reply({error:error.message}));
  return true;
});
function endTab(tabId,reason){
  void transaction(scan=>scan?.running && scan.tabId===tabId ? finish(scan,reason) : undefined);
}
chrome.tabs.onRemoved.addListener(tabId=>endTab(tabId,'Original tab closed'));
chrome.tabs.onUpdated.addListener((tabId,change)=>{
  if(change.discarded) endTab(tabId,'Chrome discarded the original page');
  else if(change.status==='loading' || (change.url && !/^https:\/\/x\.com\/home\/?(?:[?#].*)?$/.test(change.url)))
    endTab(tabId,'Original page navigated or reloaded');
});
