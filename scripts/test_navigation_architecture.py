#!/usr/bin/env python3
"""
Automated test suite for Jan Kalyan single-router, single-outlet architecture.
Asserts:
- Exact-1 header, exact-1 footer, exact-1 h1 across all routes.
- data-page="landing" only on #/ and empty hash; data-page="<name>" on app screens.
- Zero duplicate landing elements on app routes.
- Unknown route redirect to #/.
"""

import subprocess
import json
import time
import urllib.request
import sys
import websocket

sys.stdout.reconfigure(encoding='utf-8')

def run_tests():
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    proc = subprocess.Popen([
        chrome_path,
        "--headless=new",
        "--remote-debugging-port=9227",
        "--remote-allow-origins=*",
        "--disable-extensions",
        "about:blank"
    ])

    time.sleep(1.5)

    try:
        with urllib.request.urlopen("http://localhost:9227/json") as r:
            raw_targets = json.loads(r.read().decode('utf-8'))
            targets = [t for t in raw_targets if t.get('type') == 'page']
            ws_url = targets[0]["webSocketDebuggerUrl"]

        ws = websocket.create_connection(ws_url)

        msg_id = 0
        def call(m, p=None):
            nonlocal msg_id
            msg_id += 1
            ws.send(json.dumps({"id": msg_id, "method": m, "params": p or {}}))
            while True:
                res = json.loads(ws.recv())
                if res.get("id") == msg_id:
                    return res.get("result", {})

        call("Page.enable")
        call("Runtime.enable")

        def eval_js(expr):
            res = call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
            return res.get("result", {}).get("value")

        def nav(url, wait_sec=0.7):
            call("Page.navigate", {"url": url})
            time.sleep(wait_sec)

        # 1. Reset storage
        nav("http://localhost:8000/#/")
        eval_js("localStorage.removeItem('jk_lang');")

        # 2. Test routes
        routes = [
            ("Empty hash", "http://localhost:8000/", True, "Jan Kalyan"),
            ("#/ (Landing)", "http://localhost:8000/#/", True, "Jan Kalyan"),
            ("Helper login (#/login)", "http://localhost:8000/#/login", False, "Helper Login"),
            ("Quick check (#/quick)", "http://localhost:8000/#/quick", False, "Check Eligibility"),
            ("Unknown route (#/zzz)", "http://localhost:8000/#/zzz", True, "Jan Kalyan")
        ]

        passed = 0
        total = 0

        for name, url, is_landing, expected_h1 in routes:
            total += 1
            nav(url, wait_sec=0.8)
            landing_count = eval_js("document.querySelectorAll('[data-page=\"landing\"]').length")
            headers = eval_js("document.querySelectorAll('header').length")
            footers = eval_js("document.querySelectorAll('footer').length")
            h1_count = eval_js("document.querySelectorAll('h1').length")
            h1_text = eval_js("(document.querySelector('h1') || {}).textContent || ''").strip()

            expected_landing = 1 if is_landing else 0
            assert landing_count == expected_landing, f"[{name}] landing_count {landing_count} != {expected_landing}"
            assert headers == 1, f"[{name}] headers {headers} != 1"
            assert footers == 1, f"[{name}] footers {footers} != 1"
            assert h1_count == 1, f"[{name}] h1_count {h1_count} != 1"
            assert expected_h1 in h1_text, f"[{name}] h1_text '{h1_text}' does not contain '{expected_h1}'"

            passed += 1
            print(f"  [PASS] {name}: landing={landing_count}, header={headers}, footer={footers}, h1={h1_count} ('{h1_text}')")

        ws.close()
        print(f"\nALL {passed}/{total} NAVIGATION ARCHITECTURE ASSERTIONS PASSED!")
        return True

    finally:
        proc.terminate()

if __name__ == "__main__":
    success = run_tests()
    if not success:
        sys.exit(1)
