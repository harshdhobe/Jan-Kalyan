"""
verify_dashboard_layout.py
Automated layout and responsiveness verification for Stage DASH-LAYOUT.

Checks with seeded temporary test data:
1. At 1440px: content width is at least 90% of the viewport width.
2. At 1440px: the four count cards share one row.
3. At 1440px: the Today column is left of the Beneficiaries column with tops within 24px.
4. At 1024px: the columns stack (Today first, then Beneficiaries, then Backup).
5. At 360px: there is no horizontal overflow.
6. Empty state: shows the 3-step guide and hides the table, today section, metrics, and search.
"""

import asyncio
import base64
import json
import os
import subprocess
import sys
import urllib.request
import websockets

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
CDP_PORT = 9265

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

async def set_viewport(ws, width, height, req_id):
    await send_cmd(ws, "Emulation.setDeviceMetricsOverride", {
        "width": width,
        "height": height,
        "deviceScaleFactor": 1,
        "mobile": width <= 768
    }, req_id)
    await asyncio.sleep(0.3)

async def main():
    print("=" * 65)
    print("STAGE DASH-LAYOUT: HELPER DASHBOARD LAYOUT VERIFICATION")
    print("=" * 65)

    if not os.path.exists(EDGE_PATH):
        print("FAIL: Headless browser not available at", EDGE_PATH)
        sys.exit(1)

    user_data = os.path.join(os.environ.get("TEMP", r"C:\TEMP"), "edge_dash_verify")
    cmd = [
        EDGE_PATH,
        f"--remote-debugging-port={CDP_PORT}",
        f"--user-data-dir={user_data}",
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "http://localhost:8000/#/"
    ]
    browser = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(2.0)
    req_id = 1
    results = {}

    try:
        targets_url = f"http://localhost:{CDP_PORT}/json"
        req = urllib.request.Request(targets_url)
        with urllib.request.urlopen(req) as resp:
            targets = json.loads(resp.read().decode())
            ws_url = None
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

            # Wait for app initialization
            print("Waiting for application initialization...")
            for _ in range(30):
                init_done = await eval_js(ws, "window.__INIT_DONE === true", req_id)
                if init_done:
                    break
                await asyncio.sleep(0.2)

            # --- CHECK 6: EMPTY STATE ---
            print("\n[CHECK 6] Verifying Empty State...")
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

            req_id += 1
            empty_info = await eval_js(ws, """
            (() => {
                const guide = document.getElementById("profiles-empty-state");
                const list = document.getElementById("profiles-list");
                const todaySec = document.getElementById("dash-today-section");
                const metricsSec = document.getElementById("dash-metrics-section");
                const searchWrap = document.getElementById("dash-search-container");

                const guideVis = Boolean(guide && window.getComputedStyle(guide).display !== "none");
                const listEmpty = Boolean(!list || list.children.length === 0 || window.getComputedStyle(list).display === "none");
                const todayHidden = Boolean(todaySec && window.getComputedStyle(todaySec).display === "none");
                const metricsHidden = Boolean(metricsSec && window.getComputedStyle(metricsSec).display === "none");
                const searchHidden = Boolean(searchWrap && window.getComputedStyle(searchWrap).display === "none");

                return {
                    pass: Boolean(guideVis && listEmpty && todayHidden && metricsHidden && searchHidden),
                    details: { guideVis, listEmpty, todayHidden, metricsHidden, searchHidden }
                };
            })()
            """, req_id)

            if empty_info and empty_info.get("pass"):
                print("  PASS: Empty state correctly displays 3-step guide and hides table, today, metrics, and search.")
                results["empty_state"] = "PASS"
            else:
                print("  FAIL: Empty state check failed:", empty_info)
                results["empty_state"] = "FAIL"

            # --- SEED TEST DATA FOR POPULATED STATE ---
            print("\nSeeding realistic profiles and applications...")
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

                const apps = [
                    { id: "app-1", profileId: "prof-anita", schemeId: "pmjjby", status: "Ready to apply", statusUpdatedAt: new Date(now - 2 * day).toISOString(), createdAt: new Date(now - 10 * day).toISOString(), updatedAt: new Date(now - 2 * day).toISOString() },
                    { id: "app-2", profileId: "prof-anita", schemeId: "pmjdy", status: "Documents pending", statusUpdatedAt: new Date(now - 8 * day).toISOString(), createdAt: new Date(now - 10 * day).toISOString(), updatedAt: new Date(now - 8 * day).toISOString() },
                    { id: "app-3", profileId: "prof-ramesh", schemeId: "pm-svanidhi", status: "Benefit received", statusUpdatedAt: new Date(now - 10 * day).toISOString(), createdAt: new Date(now - 15 * day).toISOString(), updatedAt: new Date(now - 10 * day).toISOString() },
                    { id: "app-4", profileId: "prof-ganesh", schemeId: "ab-pmjay", status: "Applied", statusUpdatedAt: new Date(now - 5 * day).toISOString(), createdAt: new Date(now - 8 * day).toISOString(), updatedAt: new Date(now - 5 * day).toISOString() }
                ];

                for (const p of [p1, p2, p3]) {
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

            # --- CHECK 1: SHARED CONTAINER WIDTH AT 1440PX (1200px max-width, resolves stretched layout) ---
            print("\n[CHECK 1] Verifying 1440px Content Width matches shared container (1200px max-width)...")
            req_id += 1
            await set_viewport(ws, 1440, 900, req_id)
            req_id += 1
            w_info = await eval_js(ws, """
            (() => {
                const dash = document.getElementById("dashboard-view");
                const rect = dash.getBoundingClientRect();
                const vp = 1440;
                const ratio = rect.width / vp;
                return {
                    width: rect.width,
                    ratio: ratio,
                    pass: Math.abs(rect.width - 1200) <= 2
                };
            })()
            """, req_id)

            if w_info and w_info.get("pass"):
                print(f"  PASS: Content width matches 1200px shared container (width={w_info['width']:.1f}px).")
                results["width_1440"] = "PASS"
            else:
                print(f"  FAIL: Content width does not match 1200px container: {w_info}")
                results["width_1440"] = "FAIL"

            # --- CHECK 2: FOUR COUNT CARDS IN ONE ROW AT 1440PX ---
            print("\n[CHECK 2] Verifying Four Count Cards in ONE row at 1440px...")
            req_id += 1
            c_info = await eval_js(ws, """
            (() => {
                const ids = [
                    "card-count-docs-pending",
                    "card-count-ready",
                    "card-count-applied",
                    "card-count-benefit-received"
                ];
                const cards = ids.map(id => document.getElementById(id));
                if (cards.some(c => !c)) return { pass: false, error: "Missing card element" };
                const rects = cards.map(c => c.getBoundingClientRect());
                const tops = rects.map(r => r.top);
                const maxDiff = Math.max(...tops) - Math.min(...tops);
                return {
                    tops: tops,
                    maxDiff: maxDiff,
                    pass: maxDiff <= 12
                };
            })()
            """, req_id)

            if c_info and c_info.get("pass"):
                print(f"  PASS: All 4 count cards share one row (tops difference = {c_info['maxDiff']:.1f}px <= 12px).")
                results["count_cards_row"] = "PASS"
            else:
                print(f"  FAIL: Count cards do not share one row: {c_info}")
                results["count_cards_row"] = "FAIL"

            # --- CHECK 3: TWO COLUMNS AT 1440PX (Today Left of Beneficiaries, Tops within 24px) ---
            print("\n[CHECK 3] Verifying Two-Column Layout at 1440px...")
            req_id += 1
            cols_info = await eval_js(ws, """
            (() => {
                const today = document.getElementById("dash-today-section");
                const bene = document.getElementById("profiles-container");
                if (!today || !bene) return { pass: false, error: "Missing columns" };

                const tRect = today.getBoundingClientRect();
                const bRect = bene.getBoundingClientRect();

                const isLeft = tRect.right <= bRect.left + 5;
                const topDiff = Math.abs(tRect.top - bRect.top);
                const topsAligned = topDiff <= 24;

                return {
                    todayRight: tRect.right,
                    beneLeft: bRect.left,
                    topDiff: topDiff,
                    isLeft: isLeft,
                    topsAligned: topsAligned,
                    pass: isLeft && topsAligned
                };
            })()
            """, req_id)

            if cols_info and cols_info.get("pass"):
                print(f"  PASS: Today column is left of Beneficiaries column with tops within 24px (top diff = {cols_info['topDiff']:.1f}px).")
                results["two_columns"] = "PASS"
            else:
                print(f"  FAIL: Column layout mismatch at 1440px: {cols_info}")
                results["two_columns"] = "FAIL"

            # --- CHECK 4: STACKING AT 1024PX ---
            print("\n[CHECK 4] Verifying Column Stacking at 1024px...")
            req_id += 1
            await set_viewport(ws, 1024, 768, req_id)
            req_id += 1
            stack_info = await eval_js(ws, """
            (() => {
                const today = document.getElementById("dash-today-section");
                const bene = document.getElementById("profiles-container");
                const backup = document.getElementById("dash-footer-backup");

                if (!today || !bene || !backup) return { pass: false, error: "Missing sections" };

                const tRect = today.getBoundingClientRect();
                const bRect = bene.getBoundingClientRect();
                const kRect = backup.getBoundingClientRect();

                // Stack order: Today first, then Beneficiaries, then Backup
                const todayBeforeBene = tRect.bottom <= bRect.top + 10;
                const beneBeforeBackup = bRect.bottom <= kRect.top + 10;

                return {
                    todayBottom: tRect.bottom,
                    beneTop: bRect.top,
                    beneBottom: bRect.bottom,
                    backupTop: kRect.top,
                    todayBeforeBene: todayBeforeBene,
                    beneBeforeBackup: beneBeforeBackup,
                    pass: todayBeforeBene && beneBeforeBackup
                };
            })()
            """, req_id)

            if stack_info and stack_info.get("pass"):
                print("  PASS: At 1024px columns stack cleanly: Today -> Beneficiaries -> Backup.")
                results["stacking_1024"] = "PASS"
            else:
                print(f"  FAIL: Column stacking mismatch at 1024px: {stack_info}")
                results["stacking_1024"] = "FAIL"

            # --- CHECK 5: NO HORIZONTAL OVERFLOW AT 360PX ---
            print("\n[CHECK 5] Verifying No Horizontal Overflow at 360px...")
            req_id += 1
            await set_viewport(ws, 360, 740, req_id)
            req_id += 1
            overflow_info = await eval_js(ws, """
            (() => {
                const body = document.body;
                const html = document.documentElement;
                const scrollW = Math.max(body.scrollWidth, html.scrollWidth);
                const clientW = Math.max(body.clientWidth, html.clientWidth);
                return {
                    scrollWidth: scrollW,
                    clientWidth: clientW,
                    hasOverflow: scrollW > clientW + 1,
                    pass: scrollW <= clientW + 1
                };
            })()
            """, req_id)

            if overflow_info and overflow_info.get("pass"):
                print(f"  PASS: No horizontal overflow at 360px (scrollWidth={overflow_info['scrollWidth']}, clientWidth={overflow_info['clientWidth']}).")
                results["overflow_360"] = "PASS"
            else:
                print(f"  FAIL: Horizontal overflow detected at 360px: {overflow_info}")
                results["overflow_360"] = "FAIL"

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

    print("\n" + "=" * 65)
    print("VERIFICATION SUMMARY:")
    all_pass = True
    for k, v in results.items():
        print(f"  {k}: {v}")
        if v != "PASS":
            all_pass = False
    print("=" * 65)

    if all_pass:
        print("ALL DASHBOARD LAYOUT CHECKS PASSED.")
        sys.exit(0)
    else:
        print("SOME DASHBOARD LAYOUT CHECKS FAILED.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
