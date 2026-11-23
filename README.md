# ThreadScout 2.1.1

ThreadScout is a Chrome side panel for finding conversations worth joining on X. Scan 50 or 100 posts from your Home timeline, review suggested replies, and open the original posts to respond in your own words. Local suggestions work without an API key.

## Update or install on Windows

Download the source from **Code → Download ZIP** and extract it, or clone this repository.

For an existing unpacked installation, extract the new ZIP, copy the contents of its **extension** folder into the extension folder Chrome already uses, and click the reload arrow on ThreadScout at `chrome://extensions`. Refresh X Home. Verify that Chrome lists version 2.1.1.

For a first installation, extract the ZIP, enable **Developer mode** on that page, click **Load unpacked**, and select the **extension** folder containing **manifest.json**. Use Chrome 116 or later.

## Collect a batch

Open the signed-in X Home tab and choose the For you or Following feed you want to read. Open ThreadScout from the extensions menu. Choose 50 or 100 and click **Scan timeline**. You can switch tabs, minimize the window or close the panel. Only the tab where you clicked Scan is asked to scroll. Chrome may slow or freeze a hidden page. A frozen document continues when Chrome allows it to run again. ThreadScout starts at the top and moves in overlapping steps, keeping each post by its status ID even after X removes the card from view. The counter shows unique readable posts. If it stays unchanged for 15 seconds the panel displays a waiting message. Hidden scans retry while X is slow to render. Use **Move X to its own window** to move the original tab without restarting the scan. Keep that window visible beside your work if X only loads while visible. Recognized ads and media-only posts are skipped.

Click **Stop and review collected posts** to end early. If X stops loading, the panel reports the actual count and keeps the partial batch. Each new scan starts fresh. Reopening the panel restores the current scan or its collected posts. Closing, navigating away from, reloading or discarding the source page ends the scan and retains its last checkpoint. Edits and AI reviews are panel-local. The reader depends on the visible X layout.

## Choose how to analyze the batch

- **Local suggestions** appear immediately. English-language topic rules match AI, backend development, games and PC hardware. Click the source, edit a draft or copy it.
- **ChatGPT** works with your existing account. Under **Review with AI**, click **Copy brief for ChatGPT**, then paste into a chat. The brief includes one excerpt from every collected post, its public source link, timestamp and visible engagement. ChatGPT can use topics beyond the local rules. The review appears in that chat. Copying alone leaves the brief on your clipboard.
- **OpenAI API** displays results inside the extension. Expand **Review the API payload**, inspect the excerpts, enter your personal API key, and click **Send to OpenAI for review**. Chrome may ask for permission to reach api.openai.com. Each click runs a separately billed request with gpt-4.1-mini. A ChatGPT subscription and API billing are separate. Check your API account’s access and spending limits before use.

Both AI routes include up to 1,200 characters of rendered text per post. The API route uses numbered sources instead of sending separate author or URL fields. Text can itself contain names, mentions and links. All collected records go into the request, including ones the local rules did not recognize. The panel verifies that cited source numbers exist before linking them. Check proposed facts against the sources.

## Data and controls

The extension reads rendered Home feed cards when you start a scan. It never posts or opens an X session on your behalf. Only the explicit API action sends a request from the extension. It sends the key directly to OpenAI over HTTPS and requests store:false. The extension clears its key field after the request. Do not distribute a key with a public copy. The latest batch is checkpointed in Chrome session storage. Starting a new scan replaces it. Ending the browser session clears it.

## Development

Load the extension directory directly. No build step. The reader handles each viewport, collector.js merges snapshots and manages stopping, analysis.js provides local recommendations, and intelligence.js prepares ChatGPT briefs and validates API responses. The source document runs the scan, the worker serializes session checkpoints, and the panel monitors progress and renders editable suggestions.

Run `node tests/offline.mjs` , `node tests/deep.mjs` and `node tests/background.mjs` using Node 24. The tests exercise the renderer, reader, overlapping 50/100-post windows, stop/stall behavior, AI formatting, mocked API errors and source validation.

For Chromium integration, run `python tests/smoke.py` on a system with Chromium and Python Playwright. Set CHROMIUM to the browser executable if needed. The test intercepts X with sample pages and opens the extension panel document directly.
