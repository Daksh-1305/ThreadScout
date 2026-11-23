async function collect(target, read, progress, stopped, pause = ms => new Promise(r=>setTimeout(r,ms))) {
  const posts = new Map();
  let reason = 'Time limit reached', idle = 0, lastPosition = -1;
  let visibleTurns=0, first=true;
  while (visibleTurns<300) {
    if (stopped()) { reason='Stopped by you'; break; }
    let batch;
    try { batch = await read(first?'top':'advance'); }
    catch (error) { reason=error.message; break; }
    first=false;
    if(!batch.hidden) visibleTurns++;
    if (batch.error) { reason=batch.error; break; }
    if (batch.reset) { await pause(750); continue; }
    const before = posts.size;
    for (const post of batch.posts) {
      posts.set(post.id,post);
      if (posts.size===target) break;
    }
    await progress(posts.size, [...posts.values()]);
    if (posts.size===target) { reason='Target reached'; break; }
    idle = before===posts.size && lastPosition===batch.position ? idle+1 : 0;
    if (batch.hidden && idle>=3) {await pause(5000); idle=2; continue;}
    if (idle>=14) { reason='X stopped loading new posts'; break; }
    lastPosition=batch.position;
    await pause(700);
  }
  return {posts:[...posts.values()],reason};
}
