import asyncio
import json
import os
import shutil
import subprocess
import urllib.request
import websockets

async def measure_after():
    user_data = r"C:\gov scheme\temp_edge_after"
    if os.path.exists(user_data):
        shutil.rmtree(user_data, ignore_errors=True)

    proc = subprocess.Popen([
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "--headless=new",
        "--remote-debugging-port=9229",
        f"--user-data-dir={user_data}",
        "http://localhost:8000/?debug=1"
    ])
    await asyncio.sleep(2.0)

    try:
        req = urllib.request.urlopen("http://localhost:9229/json")
        targets = json.loads(req.read().decode("utf-8"))
        ws_url = None
        for t in targets:
            if t.get("type") == "page" and "8000" in t.get("url", ""):
                ws_url = t.get("webSocketDebuggerUrl")
                break
        if not ws_url:
            for t in targets:
                if t.get("type") == "page":
                    ws_url = t.get("webSocketDebuggerUrl")
                    break

        async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
            await ws.send(json.dumps({"id": 1, "method": "Runtime.enable"}))
            await asyncio.sleep(1.0)

            bench_code = """
            (async function() {
                // 1. Start quick check
                document.getElementById('btn-quick-check').click();

                // 2. Answer question
                const optBtn = document.querySelector('.stepper-option-btn');
                const enumSel = document.getElementById('stepper-enum-select');
                const saveBtn = document.getElementById('stepper-save-btn');
                const t0 = performance.now();
                if (enumSel && saveBtn) {
                    enumSel.selectedIndex = 1;
                    saveBtn.click();
                } else if (optBtn) {
                    optBtn.click();
                }
                const answerActionMs = (performance.now() - t0).toFixed(2);

                const evalMs = window.__DEBUG_STATS.lastEvalMs.toFixed(2);
                const renderMs = window.__DEBUG_STATS.lastRenderMs.toFixed(2);
                const evalCount = window.__DEBUG_STATS.evalCount;

                // 3. Precomputed search performance across 4633 schemes
                const queries = ["p", "pe", "pen", "pens", "pensi", "pensio", "pension"];
                const rules = window.ALL_RULES || [];
                let searchFilterTimes = [];
                queries.forEach(q => {
                    const st0 = performance.now();
                    const filtered = rules.filter(r => r._searchStr && r._searchStr.includes(q));
                    searchFilterTimes.push((performance.now() - st0).toFixed(2));
                });

                // 4. Test typing in search box with 200ms debounce
                const searchInp = document.getElementById('search-input');
                const countBeforeSearch = window.__DEBUG_STATS.evalCount;
                const typeT0 = performance.now();
                searchInp.value = 'farmer';
                searchInp.dispatchEvent(new Event('input', { bubbles: true }));
                const typeDispatchMs = (performance.now() - typeT0).toFixed(2);

                // Wait for debounce to finish
                await new Promise(r => setTimeout(r, 250));
                const countAfterSearch = window.__DEBUG_STATS.evalCount;

                return {
                    rulesCount: rules.length,
                    evalCount,
                    evalMs,
                    renderMs,
                    answerActionMs,
                    searchFilterTimes,
                    typeDispatchMs,
                    searchEvalDelta: countAfterSearch - countBeforeSearch,
                    searchRenderMs: window.__DEBUG_STATS.lastRenderMs.toFixed(2)
                };
            })()
            """
            await ws.send(json.dumps({
                "id": 2,
                "method": "Runtime.evaluate",
                "params": {"expression": bench_code, "awaitPromise": True, "returnByValue": True}
            }))

            while True:
                msg = await ws.recv()
                data = json.loads(msg)
                if data.get("id") == 2:
                    res = data["result"]["result"]["value"]
                    print("AFTER TIMINGS:")
                    print(json.dumps(res, indent=2))
                    break
    finally:
        proc.terminate()
        shutil.rmtree(user_data, ignore_errors=True)

if __name__ == "__main__":
    asyncio.run(measure_after())
