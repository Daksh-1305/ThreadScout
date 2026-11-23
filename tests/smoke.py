"""Offline Chromium smoke test. Requires Python Playwright and a Chromium binary."""
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
import os
import shutil
from playwright.sync_api import sync_playwright, expect

extension = Path(__file__).resolve().parents[1] / "extension"
clock = datetime.now(timezone.utc).isoformat()
def post(post_id, body):
    return f'''<article data-testid="tweet"><a role="link" href="/tester/status/{post_id}">
    <time datetime="{clock}">now</time></a><div data-testid="tweetText">{body}</div></article>'''

home = '<main>' + ''.join([
    post(1, 'Does reducing texture quality help with VRAM stutter?'),
    post(2, 'Why compare frame times across two runs?'),
    post(2, 'Why compare frame times across two runs?'),
    post(3, 'Gemini released a benchmark. How was it scored?'),
    post(4, 'What did you cook today?')
]) + '</main>'
with TemporaryDirectory() as profile, sync_playwright() as pw:
    ctx = pw.chromium.launch_persistent_context(profile,
        executable_path=os.getenv('CHROMIUM') or shutil.which('chromium'),
        args=[f'--disable-extensions-except={extension}', f'--load-extension={extension}'],
        ignore_default_args=['--disable-extensions'], headless=True)
    worker = (ctx.service_workers or [ctx.wait_for_event('serviceworker')])[0]
    panel_origin = worker.url.rsplit('/', 1)[0]
    ctx.route('https://x.com/**', lambda r: r.fulfill(content_type='text/html',
        body=home if r.request.url.endswith('/home') else '<main>Fixture destination</main>'))
    feed = ctx.pages[0]
    feed.goto('https://x.com/home')
    panel = ctx.new_page()
    panel.goto(panel_origin + '/panel.html')
    # Use the packaged panel document with the fixture tab active in the same window.
    feed.bring_to_front()
    scan = panel.locator('#scan')
    def scan_for(status):
        scan.evaluate('(b)=>b.click()')
        expect(panel.locator('#status')).to_contain_text(status,timeout=25000)
    scan_for('4 unique posts')
    expect(panel.locator('article')).to_have_count(2)
    panel.locator('textarea').first.fill('My edited reply')
    panel.locator('#ideas').click()
    expect(panel.locator('article').first).to_contain_text('Recurring in 2 posts')
    expect(panel.locator('section')).to_contain_text('Verify the announcement')
    panel.locator('#replies').click()
    expect(panel.locator('textarea').first).to_have_value('My edited reply')
    ctx.grant_permissions(['clipboard-read','clipboard-write'], origin=panel_origin)
    panel.bring_to_front()
    panel.get_by_text('Copy draft', exact=True).first.click()
    expect(panel.get_by_text('Copied',exact=True)).to_be_visible()
    assert panel.evaluate('navigator.clipboard.readText()') == 'My edited reply'
    with ctx.expect_page() as popup:
        panel.locator('article a').first.click()
    popup.value.wait_for_url('https://x.com/tester/status/1')
    popup.value.close()
    feed.bring_to_front()
    feed.locator('main').evaluate('(m)=>m.replaceChildren()')
    scan_for('X stopped loading new posts')
    feed.locator('main').evaluate('(m,html)=>m.innerHTML=html',post(5,'Should I try Firebase or Supabase?'))
    scan_for('1 unique posts')
    expect(panel.locator('section')).to_contain_text('Firebase')
    feed.goto('https://x.com/i/flow/login')
    scan_for('Sign in')
    # Simulate a virtual feed that mounts only eight overlapping cards per viewport.
    feed.goto('https://x.com/home')
    feed.evaluate("""() => {
      document.body.style.height='40000px';
      const paint=()=>{const start=Math.floor(scrollY/180);
        document.querySelector('main').innerHTML=Array.from({length:8},(_,n)=>{
          const id=start+n+1;
          return '<article><a href="/tester/status/'+id+'"><time datetime="2026-01-01">now</time></a><div data-testid="tweetText">Firebase or Supabase for app '+id+'?</div></article>';
        }).join('');};
      addEventListener('scroll',paint);paint();
    }""")
    panel.locator('#target').select_option('50')
    feed.bring_to_front()
    scan.evaluate('(b)=>b.click()')
    expect(panel.locator('#status')).to_contain_text('Collecting')
    other = ctx.new_page()
    other.goto('https://x.com/home')
    other.bring_to_front()
    panel.close()
    panel = ctx.new_page()
    panel.goto(panel_origin + '/panel.html')
    other.bring_to_front()
    expect(panel.locator('#status')).to_contain_text('50 unique posts analyzed', timeout=120000)
    expect(panel.locator('#status')).to_contain_text('Target reached')
    assert other.evaluate('scrollY') == 0
    ctx.close()
print('PASS: scan, deduplication, scoring, grouping, source, edits, clipboard, rescan and signed-out states')
