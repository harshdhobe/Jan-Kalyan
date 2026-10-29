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
PORT = 9255

def run_checks():
    print("=" * 60)
    print("STAGE FIX-1: TWO-COLUMN LAYOUT & HEADER VERIFICATION")
    print("=" * 60)

    user_data = r"C:\gov scheme\temp_edge_fix1_verify"
    if os.path.exists(user_data):
        import shutil
        shutil.rmtree(user_data, ignore_errors=True)

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
    all_passed = True

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

        # Initial navigate and seed helper + profile in GovDB
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

        def check_layout(view_name, route, setup_fn=None):
            nonlocal all_passed
            print(f"\n--- Checking View: {view_name} (Route: {route}) ---")

            # Test widths: 1440, 1024, 360
            for width in [1440, 1024]:
                set_viewport(width, 900)
                eval_js(f"window.location.hash = '{route}';")
                time.sleep(0.5)
                if setup_fn:
                    eval_js(setup_fn)
                    time.sleep(0.5)

                layout_info = eval_js("""
                (() => {
                    const qBox = document.querySelector(".sidebar-column");
                    const rBox = document.querySelector(".results-column");
                    if (!qBox || !rBox) return null;
                    const qRect = qBox.getBoundingClientRect();
                    const rRect = rBox.getBoundingClientRect();
                    return {
                        qLeft: qRect.left,
                        qRight: qRect.right,
                        qTop: qRect.top,
                        qWidth: qRect.width,
                        rLeft: rRect.left,
                        rRight: rRect.right,
                        rTop: rRect.top,
                        rWidth: rRect.width,
                        scrollWidth: document.documentElement.scrollWidth
                    };
                })()
                """)

                if not layout_info:
                    print(f"  [FAIL] {view_name} at {width}px: Could not find .sidebar-column or .results-column")
                    all_passed = False
                    continue

                q_left_of_r = layout_info["qRight"] <= layout_info["rLeft"] + 2
                tops_aligned = abs(layout_info["qTop"] - layout_info["rTop"]) <= 24
                r_wider_than_q = layout_info["rWidth"] > layout_info["qWidth"]

                print(f"  Width {width}px:")
                print(f"    Questions box: left={layout_info['qLeft']:.1f}, right={layout_info['qRight']:.1f}, top={layout_info['qTop']:.1f}, width={layout_info['qWidth']:.1f}")
                print(f"    Results box:   left={layout_info['rLeft']:.1f}, right={layout_info['rRight']:.1f}, top={layout_info['rTop']:.1f}, width={layout_info['rWidth']:.1f}")

                pass_side_by_side = q_left_of_r and tops_aligned and r_wider_than_q
                if pass_side_by_side:
                    print(f"    [PASS] Side-by-side: Questions left of Results, tops aligned ({layout_info['qTop']:.1f} vs {layout_info['rTop']:.1f}), Results wider ({layout_info['rWidth']:.1f} > {layout_info['qWidth']:.1f})")
                else:
                    print(f"    [FAIL] Side-by-side failed: q_left_of_r={q_left_of_r}, tops_aligned={tops_aligned}, r_wider_than_q={r_wider_than_q}")
                    all_passed = False

            # Test 360px vertical stack
            set_viewport(360, 800)
            eval_js(f"window.location.hash = '{route}';")
            time.sleep(0.5)
            if setup_fn:
                eval_js(setup_fn)
                time.sleep(0.5)

            m_info = eval_js("""
            (() => {
                const qBox = document.querySelector(".sidebar-column");
                const rBox = document.querySelector(".results-column");
                if (!qBox || !rBox) return null;
                const qRect = qBox.getBoundingClientRect();
                const rRect = rBox.getBoundingClientRect();
                return {
                    qBottom: qRect.bottom,
                    rTop: rRect.top,
                    qLeft: qRect.left,
                    rLeft: rRect.left,
                    scrollWidth: document.documentElement.scrollWidth,
                    clientWidth: document.documentElement.clientWidth
                };
            })()
            """)

            if not m_info:
                print(f"  [FAIL] {view_name} at 360px: Could not find columns")
                all_passed = False
            else:
                stacked = m_info["qBottom"] <= m_info["rTop"] + 15
                no_overflow = m_info["scrollWidth"] <= 360
                print(f"  Width 360px:")
                print(f"    qBottom={m_info['qBottom']:.1f}, rTop={m_info['rTop']:.1f}, scrollWidth={m_info['scrollWidth']}, clientWidth={m_info['clientWidth']}")
                if stacked and no_overflow:
                    print(f"    [PASS] Mobile stacked vertically (qBottom <= rTop) with no page overflow")
                else:
                    print(f"    [FAIL] Mobile stack failed: stacked={stacked}, no_overflow={no_overflow}")
                    all_passed = False

        # 1. Quick Check
        check_layout("Quick Check (Unsaved)", "#/quick")

        # 2. Saved Profile Questionnaire (Find Schemes from #/profile/test-prof-anita)
        find_schemes_setup = """
        (() => {
            const btn = document.getElementById("btn-prof-find-schemes") || document.getElementById("btn-empty-find-schemes");
            if (btn) btn.click();
        })()
        """
        check_layout("Saved Profile Questionnaire (#/profile/<id> -> Find schemes)", "#/profile/test-prof-anita", find_schemes_setup)

        # 3. Quick Check with Sample Profile (e.g. Ramesh)
        persona_setup = """
        (() => {
            const sel = document.getElementById("persona-select");
            if (sel) {
                sel.value = "persona_3";
                sel.dispatchEvent(new Event("change"));
            }
        })()
        """
        check_layout("Quick Check with Sample Profile (Ramesh)", "#/quick", persona_setup)

        # 4. Header Logo single line check on all routes at 1440px and 1024px
        print("\n--- Checking Header Logo Wordmark on Every Route ---")
        routes = ["#/", "#/quick", "#/login", "#/setup", "#/dashboard", "#/profile/test-prof-anita"]
        for route in routes:
            for width in [1440, 1024]:
                set_viewport(width, 900)
                eval_js(f"window.location.hash = '{route}';")
                time.sleep(0.4)

                logo_info = eval_js("""
                (() => {
                    const wm = document.querySelector(".wordmark") || document.querySelector(".landing-logo-serif");
                    if (!wm) return null;
                    const r = wm.getBoundingClientRect();
                    const style = window.getComputedStyle(wm);
                    return {
                        height: r.height,
                        fontSize: parseFloat(style.fontSize) || 32,
                        text: wm.textContent.trim()
                    };
                })()
                """)

                if not logo_info:
                    print(f"  [FAIL] Route {route} at {width}px: .wordmark not found")
                    all_passed = False
                else:
                    # Height should be under 1.5 * fontSize (single line is ~font-size * 1.0 to 1.25)
                    max_single_line_height = logo_info["fontSize"] * 1.5
                    is_single_line = logo_info["height"] <= max_single_line_height
                    if is_single_line:
                        print(f"  [PASS] Route {route:25} at {width}px: Wordmark height={logo_info['height']:.1f}px (under {max_single_line_height:.1f}px threshold, single line: '{logo_info['text']}')")
                    else:
                        print(f"  [FAIL] Route {route:25} at {width}px: Wordmark wrapped! height={logo_info['height']:.1f}px > {max_single_line_height:.1f}px")
                        all_passed = False

        print("\n" + "=" * 60)
        if all_passed:
            print("ALL FIX-1 LAYOUT & HEADER CHECKS PASSED!")
            print("=" * 60)
            return True
        else:
            print("SOME CHECKS FAILED!")
            print("=" * 60)
            return False

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
    success = run_checks()
    sys.exit(0 if success else 1)
