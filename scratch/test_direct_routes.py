import subprocess
import json
import time
import urllib.request
import sys
import websocket

sys.stdout.reconfigure(encoding='utf-8')

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
proc = subprocess.Popen([
    chrome_path,
    "--headless=new",
    "--remote-debugging-port=9223",
    "--remote-allow-origins=*",
    "--disable-gpu",
    "about:blank"
])

time.sleep(1.5)

try:
    with urllib.request.urlopen("http://localhost:9223/json") as resp:
        targets = json.loads(resp.read().decode('utf-8'))
        ws_url = targets[0]["webSocketDebuggerUrl"]

    ws = websocket.create_connection(ws_url)
    msg_id = 0

    def send(method, params=None):
        global msg_id
        msg_id += 1
        payload = {"id": msg_id, "method": method, "params": params or {}}
        ws.send(json.dumps(payload))
        while True:
            res = json.loads(ws.recv())
            if res.get("id") == msg_id:
                return res.get("result", {})

    send("Page.enable")
    send("Runtime.enable")

    def eval_js(expr):
        res = send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
        return res.get("result", {}).get("value")

    def nav(url, wait_ms=400):
        send("Page.navigate", {"url": url})
        time.sleep(wait_ms / 1000.0)

    print("Connected to headless Chrome!")

    # Test routes directly
    test_urls = [
        ("Direct: Empty Hash", "http://localhost:8000/"),
        ("Direct: #/", "http://localhost:8000/#/"),
        ("Direct: Helper Login (#/login)", "http://localhost:8000/#/login"),
        ("Direct: Dashboard (#/dashboard)", "http://localhost:8000/#/dashboard"),
        ("Direct: Quick Check (#/quick)", "http://localhost:8000/#/quick"),
        ("Direct: Unknown Route (#/zzz)", "http://localhost:8000/#/zzz")
    ]

    print("\n=== DIRECT ROUTE LOADS ===")
    results = []
    for label, url in test_urls:
        nav(url, wait_ms=800)
        # In case of redirect (like #/zzz -> #/ or #/dashboard -> #/login when not logged in)
        time.sleep(0.3)
        current_hash = eval_js("window.location.hash")
        landing_count = eval_js("document.querySelectorAll('[data-page=\"landing\"]').length")
        headers = eval_js("document.querySelectorAll('header').length")
        footers = eval_js("document.querySelectorAll('footer').length")
        h1_count = eval_js("document.querySelectorAll('h1').length")
        h1_text = eval_js("(document.querySelector('h1') || {}).textContent || ''").strip()
        results.append({
            "test": label,
            "hash": current_hash,
            "landing_count": landing_count,
            "headers": headers,
            "footers": footers,
            "h1_count": h1_count,
            "h1_text": h1_text
        })
        print(f"[{label}] Hash: '{current_hash}' | Landing: {landing_count} | Header: {headers} | Footer: {footers} | H1: {h1_count} ('{h1_text}')")

    ws.close()

except Exception as e:
    print("Error during test:", e)
finally:
    proc.terminate()
