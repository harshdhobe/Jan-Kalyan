import asyncio
import json
import os
import shutil
import subprocess
import urllib.request
import websockets

async def measure():
    user_data = r"C:\gov scheme\temp_edge_timings"
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

            # Measure in browser
            bench_code = """
            (function() {
                const rules = window.ALL_RULES || [];
                const facts = { age: 36, gender: "male" };

                // 1. evaluateAll single run
                const runs = 5;
                let evalSum = 0;
                for (let i = 0; i < runs; i++) {
                    const t0 = performance.now();
                    window.GovEngine.evaluateAll(rules, facts);
                    evalSum += (performance.now() - t0);
                }
                const avgEvalMs = (evalSum / runs).toFixed(2);

                // 2. nextQuestion single run
                let nqSum = 0;
                for (let i = 0; i < runs; i++) {
                    const t0 = performance.now();
                    window.GovEngine.nextQuestion(rules, facts);
                    nqSum += (performance.now() - t0);
                }
                const avgNqMs = (nqSum / runs).toFixed(2);

                // 3. Search query filter time (simulating un-debounced search across rules)
                const queries = ["p", "pe", "pen", "pens", "pensi", "pensio", "pension"];
                let searchTimes = [];
                queries.forEach(q => {
                    const t0 = performance.now();
                    const filtered = rules.filter(r => 
                        (r.name && r.name.toLowerCase().includes(q)) || 
                        (r.benefit && r.benefit.toLowerCase().includes(q)) ||
                        (r.id && r.id.toLowerCase().includes(q))
                    );
                    searchTimes.push((performance.now() - t0).toFixed(2));
                });

                return {
                    rulesCount: rules.length,
                    avgEvalMs,
                    avgNqMs,
                    searchTimes
                };
            })()
            """
            await ws.send(json.dumps({"id": 2, "method": "Runtime.evaluate", "params": {"expression": bench_code, "returnByValue": True}}))

            while True:
                msg = await ws.recv()
                data = json.loads(msg)
                if data.get("id") == 2:
                    res = data["result"]["result"]["value"]
                    print("BASELINE TIMINGS (BEFORE):")
                    print(json.dumps(res, indent=2))
                    break
    finally:
        proc.terminate()
        shutil.rmtree(user_data, ignore_errors=True)

if __name__ == "__main__":
    asyncio.run(measure())
