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
    "--remote-debugging-port=9225",
    "--remote-allow-origins=*",
    "--disable-extensions",
    "http://localhost:8000/#/"
])

time.sleep(1.5)

try:
    with urllib.request.urlopen("http://localhost:9225/json") as r:
        raw_targets = json.loads(r.read().decode('utf-8'))
        targets = [t for t in raw_targets if t.get('type') == 'page']
        print("Page Target URL:", targets[0]["url"])
        ws_url = targets[0]["webSocketDebuggerUrl"]

    ws = websocket.create_connection(ws_url)

    msg_id = 0
    def call(m, p=None):
        global msg_id
        msg_id += 1
        ws.send(json.dumps({"id": msg_id, "method": m, "params": p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get("id") == msg_id:
                return r.get("result", {})

    def eval_js(expr):
        res = call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
        return res.get("result", {}).get("value")

    time.sleep(1.0)
    print("HREF:", eval_js("window.location.href"))
    print("Landing count:", eval_js("document.querySelectorAll('[data-page=\"landing\"]').length"))
    print("Header count:", eval_js("document.querySelectorAll('header').length"))
    print("Footer count:", eval_js("document.querySelectorAll('footer').length"))
    print("H1 count:", eval_js("document.querySelectorAll('h1').length"))
    print("H1 text:", eval_js("(document.querySelector('h1') || {}).textContent || ''"))
    print("App shell in DOM:", eval_js("!!document.getElementById('app-shell')"))
    print("App header in DOM:", eval_js("!!document.querySelector('.app-header')"))

    ws.close()
finally:
    proc.terminate()
