"""
capture_polish_after.py
Capture "after" screenshots for Stage DASH-POLISH into docs/ui-checks/polish-after/
Viewports: 1440px, 1024px, 360px
Languages: en, hi, mr
States: empty, populated
Temporary test data only (cleans up after capture).
"""

import asyncio
import base64
import json
import os
import shutil
import subprocess
import urllib.request
import websockets

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
CDP_PORT = 9278
OUTPUT_DIR = os.path.join(r"c:\gov scheme", "docs", "ui-checks", "polish-after")

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

async def wait_for_dash_visible(ws, req_id):
    for _ in range(30):
        req_id += 1
        vis = await eval_js(ws, """
        (() => {
            const el = document.getElementById("dashboard-view");
            return el && window.getComputedStyle(el).display !== "none";
        })()
        """, req_id)
        if vis:
            return True
        await asyncio.sleep(0.2)
    return False

async def main():
    print("Capturing DASH-POLISH after screenshots...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    user_data = os.path.join(os.environ.get("TEMP", r"C:\TEMP"), "edge_polish_after_clean")
    shutil.rmtree(user_data, ignore_errors=True)

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
        "http://localhost:8000/"
    ]
    browser = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(2.0)
    req_id = 1

    try:
        targets_url = f"http://localhost:{CDP_PORT}/json"
        req = urllib.request.Request(targets_url)
        with urllib.request.urlopen(req) as resp:
            targets = json.loads(resp.read().decode())
            ws_url = [t["webSocketDebuggerUrl"] for t in targets if t.get("type") == "page"][0]

        async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
            req_id += 1
            await send_cmd(ws, "Runtime.enable", {}, req_id)
            req_id += 1
            await send_cmd(ws, "Page.enable", {}, req_id)

            mock_cloud = """
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
                window.GovCloud.getUser = async () => ({ id: "test-helper-id", email: "helper@jankalyan.org" });
              }
            };
            window.__mockGovCloud();
            window.addEventListener("DOMContentLoaded", window.__mockGovCloud);
            """
            req_id += 1
            await send_cmd(ws, "Page.addScriptToEvaluateOnNewDocument", {"source": mock_cloud}, req_id)
            req_id += 1
            await eval_js(ws, mock_cloud, req_id)

            # Wait for app init
            for _ in range(30):
                req_id += 1
                val = await eval_js(ws, "window.__INIT_DONE === true", req_id)
                if val is True:
                    break
                await asyncio.sleep(0.2)

            viewports = [
                ("1440", 1440, 900),
                ("1024", 1024, 800),
                ("360", 360, 740)
            ]
            languages = ["en", "hi", "mr"]

            # 1. EMPTY STATE
            print("\nCapturing EMPTY state...")
            clear_script = """
            (async () => {
                if (window.__mockGovCloud) window.__mockGovCloud();
                if (window.GovDB && window.GovDB.isAvailable()) {
                    await window.GovDB.clearAllBeneficiaryData();
                    await window.GovDB.setMeta("helper_account", {
                        id: "test-helper-id",
                        name: "Sunita",
                        helper_type: "ASHA",
                        district: "Pune",
                        language: "en"
                    });
                }
                window.location.hash = "#/";
                setTimeout(() => { window.location.hash = "#/helper"; }, 50);
            })()
            """
            req_id += 1
            await eval_js(ws, clear_script, req_id)
            await wait_for_dash_visible(ws, req_id)
            await asyncio.sleep(0.5)

            for lang in languages:
                req_id += 1
                await eval_js(ws, f"window.setAppLanguage ? window.setAppLanguage('{lang}') : (document.getElementById('lang-{lang}') && document.getElementById('lang-{lang}').click());", req_id)
                await asyncio.sleep(0.4)

                for vp_name, w, h in viewports:
                    req_id += 1
                    await set_viewport(ws, w, h, req_id)
                    filename = f"empty_{vp_name}_{lang}.png"
                    filepath = os.path.join(OUTPUT_DIR, filename)
                    req_id += 1
                    await capture_screen(ws, filepath, req_id)

            # 2. POPULATED STATE
            print("\nCapturing POPULATED state...")
            seed_script = """
            (async () => {
                if (!window.GovDB || !window.GovDB.isAvailable()) return false;
                const now = new Date();
                const daysAgo = (d) => new Date(now.getTime() - d * 86400000).toISOString();

                await window.GovDB.setMeta("helper_account", {
                    id: "test-helper-id",
                    name: "Sunita",
                    helper_type: "ASHA",
                    district: "Pune",
                    language: "en"
                });
                await window.GovDB.setMeta("last_backup_at", daysAgo(2));

                const profiles = [
                    { id: "p1", name: "Ramesh Pawar", consent: true, consentGiven: true, facts: { age: 48, gender: "male" } },
                    { id: "p2", name: "Kamla Bai", consent: true, consentGiven: true, facts: { age: 67, gender: "female" } },
                    { id: "p3", name: "Sunita Jadhav", consent: true, consentGiven: true, facts: { age: 34, gender: "female" } },
                    { id: "p4", name: "Geeta Shinde", consent: true, consentGiven: true, facts: { age: 52, gender: "female" } },
                    { id: "p5", name: "Anil Kale", consent: true, consentGiven: true, facts: { age: 60, gender: "male" } },
                    { id: "p6", name: "Meena Gaikwad", consent: true, consentGiven: true, facts: { age: 29, gender: "female" } }
                ];
                for (const p of profiles) {
                    await window.GovDB.saveProfile(p);
                }

                const applications = [
                    { id: "a1", profileId: "p1", schemeId: "pm-kisan", status: "Ready to apply", statusUpdatedAt: daysAgo(3), schemeTitle: "PM-KISAN" },
                    { id: "a2", profileId: "p1", schemeId: "ab-pmjay", status: "Documents pending", statusUpdatedAt: daysAgo(8), schemeTitle: "Ayushman Bharat" },
                    { id: "a3", profileId: "p2", schemeId: "nsap-ignoaps", status: "Documents pending", statusUpdatedAt: daysAgo(9), schemeTitle: "Old-age pension" },
                    { id: "a4", profileId: "p3", schemeId: "ab-pmjay", status: "Applied", statusUpdatedAt: daysAgo(34), schemeTitle: "Ayushman Bharat" },
                    { id: "a5", profileId: "p3", schemeId: "pm-kisan", status: "Documents pending", statusUpdatedAt: daysAgo(2), schemeTitle: "PM-KISAN" },
                    { id: "a6", profileId: "p3", schemeId: "pmsby", status: "Ready to apply", statusUpdatedAt: daysAgo(5), schemeTitle: "Suraksha Bima" },
                    { id: "a7", profileId: "p4", schemeId: "pmay-g", status: "Rejected", statusUpdatedAt: daysAgo(2), schemeTitle: "Awas Yojana (Gramin)" },
                    { id: "a8", profileId: "p5", schemeId: "ab-pmjay", status: "Benefit received", statusUpdatedAt: daysAgo(15), schemeTitle: "Ayushman Bharat" },
                    { id: "a9", profileId: "p5", schemeId: "pm-kisan", status: "Benefit received", statusUpdatedAt: daysAgo(20), schemeTitle: "PM-KISAN" },
                    { id: "a10", profileId: "p6", schemeId: "pm-kisan", status: "Documents pending", statusUpdatedAt: daysAgo(4), schemeTitle: "PM-KISAN" },
                    { id: "a11", profileId: "p6", schemeId: "ab-pmjay", status: "Ready to apply", statusUpdatedAt: daysAgo(1), schemeTitle: "Ayushman Bharat" }
                ];
                for (const a of applications) {
                    await window.GovDB.saveApplication(a);
                }

                window.location.hash = "#/";
                setTimeout(() => { window.location.hash = "#/helper"; }, 50);
                return true;
            })()
            """
            req_id += 1
            await eval_js(ws, seed_script, req_id)
            await wait_for_dash_visible(ws, req_id)
            await asyncio.sleep(0.5)

            for lang in languages:
                req_id += 1
                await eval_js(ws, f"window.setAppLanguage ? window.setAppLanguage('{lang}') : (document.getElementById('lang-{lang}') && document.getElementById('lang-{lang}').click());", req_id)
                await asyncio.sleep(0.4)

                for vp_name, w, h in viewports:
                    req_id += 1
                    await set_viewport(ws, w, h, req_id)
                    filename = f"populated_{vp_name}_{lang}.png"
                    filepath = os.path.join(OUTPUT_DIR, filename)
                    req_id += 1
                    await capture_screen(ws, filepath, req_id)

            # Clean up temporary test data
            print("\nCleaning up temporary test data...")
            cleanup_script = """
            (async () => {
                if (window.GovDB && window.GovDB.isAvailable()) {
                    await window.GovDB.clearAllBeneficiaryData();
                }
            })()
            """
            req_id += 1
            await eval_js(ws, cleanup_script, req_id)
            print("Temporary data cleared.")

    finally:
        browser.kill()
    print("Done capturing after screenshots!")

if __name__ == "__main__":
    asyncio.run(main())
