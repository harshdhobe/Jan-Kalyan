import os
import sys
import json
import time
import base64
import urllib.request
import subprocess
import websocket

sys.stdout.reconfigure(encoding='utf-8')

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9260

def capture_fix1():
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "ui-checks", "fix1-after"))
    os.makedirs(out_dir, exist_ok=True)

    user_data = r"C:\gov scheme\temp_edge_fix1_screenshots"
    if os.path.exists(user_data):
        import shutil
        shutil.rmtree(user_data, ignore_errors=True)

    print(f"Starting Chrome for Fix-1 screenshots on port {PORT}...")
    proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        "--remote-allow-origins=*",
        "--disable-extensions",
        f"--user-data-dir={user_data}",
        "about:blank"
    ])

    time.sleep(2.0)

    try:
        with urllib.request.urlopen(f"http://localhost:{PORT}/json") as r:
            raw_targets = json.loads(r.read().decode('utf-8'))
            targets = [t for t in raw_targets if t.get('type') == 'page']
            ws_url = targets[0]["webSocketDebuggerUrl"]

        ws = websocket.create_connection(ws_url, max_size=100 * 1024 * 1024)

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

        def set_viewport(width, height=900):
            call("Emulation.setDeviceMetricsOverride", {
                "width": width,
                "height": height,
                "deviceScaleFactor": 1,
                "mobile": width <= 768
            })
            time.sleep(0.3)

        def eval_js(expr):
            res = call("Runtime.evaluate", {
                "expression": expr,
                "returnByValue": True,
                "awaitPromise": True
            })
            return res.get("result", {}).get("value")

        # Initial navigate and seed
        call("Page.navigate", {"url": "http://localhost:8000/frontend/index.html#/"})
        time.sleep(1.5)

        seed_script = """
        (async () => {
            if (window.GovCloud) {
                window.GovCloud.isConfigured = () => true;
                window.GovCloud.getSession = async () => ({
                    data: { session: { user: { id: "test-helper-id", email: "helper@jankalyan.org" } } },
                    error: null
                });
                window.GovCloud.getUser = async () => ({ id: "test-helper-id", email: "helper@jankalyan.org" });
            }
            if (window.GovDB && window.GovDB.isAvailable()) {
                await window.GovDB.setMeta("helper_account", {
                    id: "test-helper-id",
                    name: "Sunita Patil",
                    helper_type: "ASHA",
                    district: "Pune",
                    language: "en"
                });
                const testProfile = {
                    id: "test-prof-anita",
                    name: "Anita Patil",
                    consent: true,
                    consentGiven: true,
                    facts: { age: 34, gender: "female", marital_status: "married", household: { state: "Maharashtra", income: 150000 } },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                await window.GovDB.saveProfile(testProfile);
            }
            return true;
        })()
        """
        eval_js(seed_script)
        time.sleep(0.5)

        views = [
            ("quick", "#/quick", None),
            ("profile_finder", "#/profile/test-prof-anita", """
                const btn = document.getElementById("btn-prof-find-schemes") || document.getElementById("btn-empty-find-schemes");
                if (btn) btn.click();
            """),
            ("quick_persona", "#/quick", """
                const sel = document.getElementById("persona-select");
                if (sel) {
                    sel.value = "persona_3";
                    sel.dispatchEvent(new Event("change"));
                }
            """)
        ]

        widths = [1440, 1024, 768, 360]
        langs = ["en", "hi", "mr"]

        total = len(views) * len(widths) * len(langs)
        done = 0

        for view_key, route, setup_script in views:
            for lang in langs:
                # Switch language
                eval_js(f"""
                (() => {{
                    const langBtn = document.getElementById("lang-{lang}");
                    if (langBtn) langBtn.click();
                }})()
                """)
                time.sleep(0.2)

                for width in widths:
                    height = 900 if width > 360 else 800
                    set_viewport(width, height)
                    eval_js(f"window.location.hash = '{route}';")
                    time.sleep(0.4)
                    if setup_script:
                        eval_js(setup_script)
                        time.sleep(0.4)

                    filename = f"{view_key}_{width}_{lang}.png"
                    filepath = os.path.join(out_dir, filename)

                    screenshot = call("Page.captureScreenshot", {"format": "png"})
                    with open(filepath, "wb") as f:
                        f.write(base64.b64decode(screenshot["data"]))

                    done += 1
                    print(f"[{done}/{total}] Captured {filename} ({os.path.getsize(filepath)} bytes)")

        print("All Fix-1 screenshots captured successfully!")

    finally:
        try:
            ws.close()
        except Exception:
            pass
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except Exception:
            proc.kill()

if __name__ == "__main__":
    capture_fix1()
