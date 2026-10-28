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
PORT = 9245

def capture(stage="before", langs=None):
    if langs is None:
        langs = ["en"] if stage == "before" else ["en", "hi", "mr"]

    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "ui-checks", stage))
    os.makedirs(output_dir, exist_ok=True)

    print(f"Starting Chrome on port {PORT} for stage '{stage}'...")
    proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        "--remote-allow-origins=*",
        "--disable-extensions",
        "about:blank"
    ])

    time.sleep(1.8)

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

        def eval_js(expr):
            res = call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
            return res.get("result", {}).get("value")

        # Initial navigate and seed helper + profile
        call("Page.navigate", {"url": "http://localhost:8000/#/"})
        time.sleep(1.2)

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
                const p1 = {
                    id: "prof-anita",
                    name: "Anita Patil",
                    age: 45,
                    gender: "female",
                    consent: true,
                    household: { state: "Maharashtra" },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                await window.GovDB.saveProfile(p1);
            }
            return true;
        })()
        """
        eval_js(seed_script)
        time.sleep(0.5)

        routes = [
            ("landing", "http://localhost:8000/#/"),
            ("login", "http://localhost:8000/#/login"),
            ("setup", "http://localhost:8000/#/setup"),
            ("dashboard", "http://localhost:8000/#/dashboard"),
            ("profile", "http://localhost:8000/#/profile/prof-anita"),
            ("quick", "http://localhost:8000/#/quick")
        ]

        viewports = [
            ("1440", 1440, 900),
            ("360", 360, 780)
        ]

        captured = 0
        overflow_reports = []

        for lang in langs:
            for route_name, url in routes:
                for vp_name, width, height in viewports:
                    # Set viewport
                    call("Emulation.setDeviceMetricsOverride", {
                        "width": width,
                        "height": height,
                        "deviceScaleFactor": 1,
                        "mobile": width <= 768
                    })
                    time.sleep(0.1)

                    # Adjust auth mock before navigation
                    if route_name == "login":
                        eval_js("""
                        if (window.GovCloud) {
                            window.GovCloud.getSession = async () => ({ data: { session: null }, error: null });
                            window.GovCloud.getUser = async () => null;
                        }
                        window.location.hash = '#/login';
                        """)
                    else:
                        eval_js(f"""
                        if (window.GovCloud) {{
                            window.GovCloud.getSession = async () => ({{
                                data: {{ session: {{ user: {{ id: "test-helper-id", email: "helper@jankalyan.org" }} }} }},
                                error: null
                            }});
                            window.GovCloud.getUser = async () => ({{ id: "test-helper-id", email: "helper@jankalyan.org" }});
                        }}
                        window.location.hash = '{url.split('#')[1]}';
                        """)

                    time.sleep(0.7)

                    # Set language
                    lang_script = """
                    (async () => {
                        if (window.GovApp && typeof window.GovApp.setLanguage === 'function') {
                            window.GovApp.setLanguage('__LANG__');
                        } else if (window.JanKalyanLanding && typeof window.JanKalyanLanding.setLanguage === 'function') {
                            window.JanKalyanLanding.setLanguage('__LANG__');
                        }
                        localStorage.setItem('jk_lang', '__LANG__');
                        document.documentElement.setAttribute('lang', '__LANG__');
                    })()
                    """.replace("__LANG__", lang)
                    eval_js(lang_script)
                    time.sleep(0.4)

                    # Check overflow
                    overflow = eval_js("""
                    (() => {
                        const body = document.body;
                        const html = document.documentElement;
                        const scrollW = Math.max(body.scrollWidth, html.scrollWidth);
                        const clientW = Math.max(body.clientWidth, html.clientWidth);
                        return { scrollW, clientW, hasOverflow: scrollW > clientW + 1 };
                    })()
                    """)
                    if overflow and overflow.get("hasOverflow"):
                        overflow_reports.append(f"{route_name} at {vp_name}px [{lang}]: scrollW={overflow['scrollW']} > clientW={overflow['clientW']}")

                    # Capture screenshot
                    shot = call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True})
                    data = shot.get("data")
                    if data:
                        filename = f"{route_name}_{vp_name}_{lang}.png"
                        filepath = os.path.join(output_dir, filename)
                        with open(filepath, "wb") as f:
                            f.write(base64.b64decode(data))
                        captured += 1
                        print(f"Captured {filename}")

        ws.close()
        print(f"\nSuccessfully captured {captured} screenshots into {output_dir}!")
        if overflow_reports:
            print("Overflow warnings:")
            for o in overflow_reports:
                print("  ", o)
        else:
            print("No horizontal overflow detected!")

        return True
    finally:
        proc.terminate()

if __name__ == "__main__":
    stage_arg = sys.argv[1] if len(sys.argv) > 1 else "before"
    capture(stage_arg)
