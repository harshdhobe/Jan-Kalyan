"""
capture_dash_after.py
Capture "after" screenshots for Stage DASH-LAYOUT into docs/ui-checks/dash-after/
Viewports: 1440px, 1024px, 768px, 360px
Languages: en, hi, mr
States: empty, populated
Temporary test data only (cleans up after capture).
"""

import asyncio
import base64
import json
import os
import subprocess
import urllib.request
import websockets

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
CDP_PORT = 9270
OUTPUT_DIR = os.path.join(r"c:\gov scheme", "docs", "ui-checks", "dash-after")

async def send_cmd(ws, method, params=None, req_id=1):
    await ws.send(json.dumps({"id": req_id, "method": method, "params": params or {}}))
    while True:
        msg = await ws.recv()
        data = json.loads(msg)
        if data.get("id") == req_id:
            return data

async def eval_js(ws, expr, req_id=100):
    res = await send_cmd(ws, "Runtime.evaluate", {
        "expression": expr,
        "returnByValue": True,
        "awaitPromise": True
    }, req_id=req_id)
    if "result" in res and "result" in res["result"]:
        return res["result"]["result"].get("value")
    return res

async def capture_screen(ws, filepath, req_id):
    res = await send_cmd(ws, "Page.captureScreenshot", {"format": "png"}, req_id)
    raw = res["result"]["data"]
    with open(filepath, "wb") as f:
        f.write(base64.b64decode(raw))
    print(f"  [SAVED] {os.path.basename(filepath)}")

async def set_viewport(ws, width, height, req_id):
    await send_cmd(ws, "Emulation.setDeviceMetricsOverride", {
        "width": width,
        "height": height,
        "deviceScaleFactor": 1,
        "mobile": width <= 768
    }, req_id)
    await asyncio.sleep(0.3)

async def main():
    print("Capturing DASH-LAYOUT after screenshots...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    user_data = os.path.join(os.environ.get("TEMP", r"C:\TEMP"), "edge_dash_after")
    cmd = [
        EDGE_PATH,
        f"--remote-debugging-port={CDP_PORT}",
        f"--user-data-dir={user_data}",
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-fre",
        "--disable-sync",
        "http://localhost:8000/#/helper"
    ]
    browser = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(2.0)
    req_id = 1

    try:
        targets_url = f"http://localhost:{CDP_PORT}/json"
        req = urllib.request.Request(targets_url)
        with urllib.request.urlopen(req) as resp:
            targets = json.loads(resp.read().decode())
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

        assert ws_url, "No page websocket URL found!"

        async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
            req_id += 1
            await send_cmd(ws, "Runtime.enable", {}, req_id)
            req_id += 1
            await send_cmd(ws, "Page.enable", {}, req_id)
            req_id += 1
            await send_cmd(ws, "Page.navigate", {"url": "http://localhost:8000/#/helper"}, req_id)
            await asyncio.sleep(1.0)


            mock_script = """
            window.__mockGovCloud = function() {
              if (window.GovCloud) {
                window.GovCloud.isConfigured = () => true;
                window.GovCloud.getSession = async () => ({
                  data: {
                    session: {
                      user: { id: "test-helper-id", email: "helper@jankalyan.org" },
                      access_token: "mock-token"
                    }
                  },
                  error: null
                });
                window.GovCloud.getUser = async () => ({
                  id: "test-helper-id",
                  email: "helper@jankalyan.org"
                });
                window.GovCloud.deleteProfileCloud = async () => ({ error: null });
                window.GovCloud.backupToCloud = async () => ({
                  success: true,
                  profilesBackedUp: 6,
                  applicationsBackedUp: 11,
                  backupTimestamp: new Date().toISOString()
                });
              }
            };
            window.__mockGovCloud();
            window.addEventListener("DOMContentLoaded", window.__mockGovCloud);
            """
            req_id += 1
            await send_cmd(ws, "Page.addScriptToEvaluateOnNewDocument", {"source": mock_script}, req_id)
            req_id += 1
            await eval_js(ws, mock_script, req_id)

            # Wait for app init
            for _ in range(30):
                init_done = await eval_js(ws, "window.__INIT_DONE === true", req_id)
                if init_done:
                    break
                await asyncio.sleep(0.2)

            # Setup helper account and clear profiles for empty state
            req_id += 1
            await eval_js(ws, """
            (async () => {
              if (window.__mockGovCloud) window.__mockGovCloud();
              if (window.GovDB && window.GovDB.isAvailable()) {
                await window.GovDB.clearAllBeneficiaryData();
              }
              const helper = {
                id: "test-helper-id",
                name: "Sunita Patil",
                helper_type: "ASHA",
                district: "Pune",
                language: "en"
              };
              if (window.GovDB) {
                await window.GovDB.setMeta("helper_account", helper);
              }
              return true;
            })()
            """, req_id)
            await asyncio.sleep(0.5)

            req_id += 1
            await eval_js(ws, "window.location.hash = '#/helper';", req_id)
            for _ in range(20):
                dash_vis = await eval_js(ws, """
                (() => {
                    const el = document.getElementById("dashboard-view");
                    return el && window.getComputedStyle(el).display !== "none";
                })()
                """, req_id)
                if dash_vis:
                    break
                await asyncio.sleep(0.2)

            viewports = [
                ("1440", 1440, 900),
                ("1024", 1024, 768),
                ("768", 768, 1024),
                ("360", 360, 740)
            ]
            langs = ["en", "hi", "mr"]

            # Capture Empty State
            print("\nCapturing EMPTY state after screenshots...")
            for lang in langs:
                req_id += 1
                await eval_js(ws, f"""
                (() => {{
                    const langBtn = document.getElementById("lang-{lang}");
                    if (langBtn) langBtn.click();
                }})()
                """, req_id)
                await asyncio.sleep(0.3)

                for vp_name, w, h in viewports:
                    req_id += 1
                    await set_viewport(ws, w, h, req_id)
                    fname = f"dash_after_empty_{lang}_{vp_name}px.png"
                    await capture_screen(ws, os.path.join(OUTPUT_DIR, fname), req_id)

            # Seed realistic test data for Populated State
            print("\nSeeding test data for POPULATED state after screenshots...")
            req_id += 1
            await eval_js(ws, """
            (async () => {
                const now = Date.now();
                const day = 86400000;

                const p1 = {
                    id: "prof-anita",
                    name: "Anita Patil",
                    age: 45,
                    gender: "female",
                    consent: true,
                    household: { state: "Maharashtra" },
                    createdAt: new Date(now - 10 * day).toISOString(),
                    updatedAt: new Date(now - 1 * day).toISOString()
                };
                const p2 = {
                    id: "prof-ramesh",
                    name: "Ramesh Pawar",
                    age: 28,
                    gender: "male",
                    consent: true,
                    household: { state: "Maharashtra" },
                    createdAt: new Date(now - 15 * day).toISOString(),
                    updatedAt: new Date(now - 3 * day).toISOString()
                };
                const p3 = {
                    id: "prof-ganesh",
                    name: "Ganesh Shinde",
                    age: 36,
                    gender: "male",
                    consent: true,
                    household: { state: "Maharashtra" },
                    createdAt: new Date(now - 8 * day).toISOString(),
                    updatedAt: new Date(now - 2 * day).toISOString()
                };
                const p4 = {
                    id: "prof-pooja",
                    name: "Pooja Jadhav",
                    age: 32,
                    gender: "female",
                    consent: true,
                    household: { state: "Maharashtra" },
                    createdAt: new Date(now - 20 * day).toISOString(),
                    updatedAt: new Date(now - 4 * day).toISOString()
                };
                const p5 = {
                    id: "prof-vikas",
                    name: "Vikas Gaikwad",
                    age: 24,
                    gender: "male",
                    consent: true,
                    household: { state: "Maharashtra" },
                    createdAt: new Date(now - 25 * day).toISOString(),
                    updatedAt: new Date(now - 5 * day).toISOString()
                };
                const p6 = {
                    id: "prof-sunita",
                    name: "Sunita More",
                    age: 52,
                    gender: "female",
                    consent: true,
                    household: { state: "Maharashtra" },
                    createdAt: new Date(now - 30 * day).toISOString(),
                    updatedAt: new Date(now - 6 * day).toISOString()
                };

                const apps = [
                    { id: "app-1", profileId: "prof-anita", schemeId: "pmjjby", status: "Ready to apply", statusUpdatedAt: new Date(now - 2 * day).toISOString(), createdAt: new Date(now - 10 * day).toISOString(), updatedAt: new Date(now - 2 * day).toISOString() },
                    { id: "app-2", profileId: "prof-anita", schemeId: "pmjdy", status: "Documents pending", statusUpdatedAt: new Date(now - 8 * day).toISOString(), createdAt: new Date(now - 10 * day).toISOString(), updatedAt: new Date(now - 8 * day).toISOString() },
                    { id: "app-3", profileId: "prof-anita", schemeId: "pm-kisan", status: "Applied", statusUpdatedAt: new Date(now - 35 * day).toISOString(), createdAt: new Date(now - 35 * day).toISOString(), updatedAt: new Date(now - 35 * day).toISOString() },
                    { id: "app-4", profileId: "prof-anita", schemeId: "mmlby", status: "Rejected", statusUpdatedAt: new Date(now - 5 * day).toISOString(), createdAt: new Date(now - 10 * day).toISOString(), updatedAt: new Date(now - 5 * day).toISOString() },

                    { id: "app-5", profileId: "prof-ramesh", schemeId: "pm-svanidhi", status: "Benefit received", statusUpdatedAt: new Date(now - 10 * day).toISOString(), createdAt: new Date(now - 15 * day).toISOString(), updatedAt: new Date(now - 10 * day).toISOString() },
                    { id: "app-6", profileId: "prof-ramesh", schemeId: "apy", status: "Documents pending", statusUpdatedAt: new Date(now - 3 * day).toISOString(), createdAt: new Date(now - 15 * day).toISOString(), updatedAt: new Date(now - 3 * day).toISOString() },

                    { id: "app-7", profileId: "prof-ganesh", schemeId: "ab-pmjay", status: "Ready to apply", statusUpdatedAt: new Date(now - 5 * day).toISOString(), createdAt: new Date(now - 8 * day).toISOString(), updatedAt: new Date(now - 5 * day).toISOString() },

                    { id: "app-8", profileId: "prof-pooja", schemeId: "pmmvy", status: "Applied", statusUpdatedAt: new Date(now - 12 * day).toISOString(), createdAt: new Date(now - 20 * day).toISOString(), updatedAt: new Date(now - 12 * day).toISOString() },
                    { id: "app-9", profileId: "prof-pooja", schemeId: "pmuy", status: "Benefit received", statusUpdatedAt: new Date(now - 4 * day).toISOString(), createdAt: new Date(now - 20 * day).toISOString(), updatedAt: new Date(now - 4 * day).toISOString() },

                    { id: "app-10", profileId: "prof-vikas", schemeId: "pmkvy", status: "Saved", statusUpdatedAt: new Date(now - 5 * day).toISOString(), createdAt: new Date(now - 25 * day).toISOString(), updatedAt: new Date(now - 5 * day).toISOString() },

                    { id: "app-11", profileId: "prof-sunita", schemeId: "nsap-ignoaps", status: "Documents pending", statusUpdatedAt: new Date(now - 14 * day).toISOString(), createdAt: new Date(now - 30 * day).toISOString(), updatedAt: new Date(now - 14 * day).toISOString() }
                ];

                for (const p of [p1, p2, p3, p4, p5, p6]) {
                    await window.GovDB.saveProfile(p);
                }
                for (const a of apps) {
                    await window.GovDB.saveApplication(a);
                }
                return true;
            })()
            """, req_id)
            await asyncio.sleep(0.5)

            req_id += 1
            await eval_js(ws, """
            (() => {
                window.location.hash = "#/";
                setTimeout(() => {
                    window.location.hash = "#/helper";
                }, 50);
            })()
            """, req_id)
            for _ in range(20):
                pop_vis = await eval_js(ws, """
                (() => {
                    const list = document.getElementById("profiles-list");
                    return list && list.children.length > 0;
                })()
                """, req_id)
                if pop_vis:
                    break
                await asyncio.sleep(0.2)

            # Capture Populated State
            print("\nCapturing POPULATED state after screenshots...")
            for lang in langs:
                req_id += 1
                await eval_js(ws, f"""
                (() => {{
                    const langBtn = document.getElementById("lang-{lang}");
                    if (langBtn) langBtn.click();
                }})()
                """, req_id)
                await asyncio.sleep(0.3)

                for vp_name, w, h in viewports:
                    req_id += 1
                    await set_viewport(ws, w, h, req_id)
                    fname = f"dash_after_pop_{lang}_{vp_name}px.png"
                    await capture_screen(ws, os.path.join(OUTPUT_DIR, fname), req_id)

            # Clean up test data
            print("\nCleaning up temporary test data...")
            req_id += 1
            await eval_js(ws, """
            (async () => {
                if (window.GovDB && window.GovDB.isAvailable()) {
                    await window.GovDB.clearAllBeneficiaryData();
                }
            })()
            """, req_id)
            print("Cleanup complete.")

    finally:
        browser.terminate()
        try:
            browser.wait(timeout=2)
        except Exception:
            browser.kill()

if __name__ == "__main__":
    asyncio.run(main())
