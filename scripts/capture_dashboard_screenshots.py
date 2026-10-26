"""
capture_dashboard_screenshots.py
Stage UI-3: Headless Edge CDP automation to capture #/helper screenshots
in empty state and populated state across 1440px, 768px, and 360px
in English (en), Hindi (hi), and Marathi (mr).
Also checks 360px horizontal overflow in all three languages.
"""

import asyncio
import base64
import json
import os
import subprocess
import urllib.request
import websockets

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
CDP_PORT = 9250
SCREENSHOTS_DIR = os.path.join(r"c:\gov scheme", "docs", "ui-checks")

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

async def check_overflow(ws, req_id):
    return await eval_js(ws, """
    (() => {
        const body = document.body;
        const html = document.documentElement;
        const scrollWidth = Math.max(body.scrollWidth, html.scrollWidth);
        const clientWidth = Math.max(body.clientWidth, html.clientWidth);
        return {
            scrollWidth: scrollWidth,
            clientWidth: clientWidth,
            hasOverflow: scrollWidth > clientWidth + 1
        };
    })()
    """, req_id)

async def main():
    print("=" * 60)
    print("STAGE UI-3 VISUAL SCREENSHOTS & OVERFLOW CHECKS")
    print("=" * 60)

    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
    user_data = os.path.join(os.environ.get("TEMP", r"C:\TEMP"), "edge_ui3_profile")
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

            # Step 1: Mock script for GovCloud session
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

            # Mock auth session and initialize helper account immediately
            setup_script = """
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
            """
            req_id += 1
            await eval_js(ws, setup_script, req_id)
            await asyncio.sleep(0.5)

            # Step 2: Navigate to #/helper in empty state
            req_id += 1
            await eval_js(ws, "window.location.hash = '#/helper';", req_id)
            await asyncio.sleep(1.2)

            # Verify empty state elements
            req_id += 1
            debug_info = await eval_js(ws, """
            (() => {
                return {
                    hash: window.location.hash,
                    dashDisplay: document.getElementById('dashboard-view') ? document.getElementById('dashboard-view').style.display : null,
                    guideElDisplay: document.getElementById('profiles-empty-state') ? document.getElementById('profiles-empty-state').style.display : null,
                    todayElDisplay: document.getElementById('dash-today-section') ? document.getElementById('dash-today-section').style.display : null,
                    helperMeta: window.GovDB ? 'GovDB exists' : 'no GovDB'
                };
            })()
            """, req_id)
            print("[DEBUG INFO]:", debug_info)

            req_id += 1
            empty_info = await eval_js(ws, """
            (() => {
                const guide = document.getElementById("profiles-empty-state");
                const todaySec = document.getElementById("dash-today-section");
                const countCards = document.getElementById("dash-metrics-section");
                const searchWrap = document.getElementById("dash-search-container");
                const listWrap = document.getElementById("profiles-list");

                return {
                    guideVisible: guide ? window.getComputedStyle(guide).display !== "none" : false,
                    todayHidden: todaySec ? window.getComputedStyle(todaySec).display === "none" : false,
                    cardsHidden: countCards ? window.getComputedStyle(countCards).display === "none" : false,
                    searchHidden: searchWrap ? window.getComputedStyle(searchWrap).display === "none" : false,
                    listHidden: listWrap ? window.getComputedStyle(listWrap).display === "none" || listWrap.children.length === 0 : false
                };
            })()
            """, req_id)
            print("[EMPTY STATE CHECK]:", empty_info)
            assert empty_info["guideVisible"], "3-step guide must be visible in empty state"
            assert empty_info["todayHidden"], "Today section must be hidden in empty state"
            assert empty_info["cardsHidden"], "Count cards must be hidden in empty state"
            assert empty_info["searchHidden"], "Search container must be hidden in empty state"

            # Capture Empty State Screenshots: 1440px, 768px, 360px for en, hi, mr
            print("\n--- Capturing Empty State Screenshots ---")
            viewports = [("1440px", 1440, 900), ("768px", 768, 1024), ("360px", 360, 740)]
            langs = ["en", "hi", "mr"]

            for lang in langs:
                req_id += 1
                await eval_js(ws, f"document.getElementById('lang-{lang}').click();", req_id)
                await asyncio.sleep(0.5)

                for name, w, h in viewports:
                    req_id += 1
                    await set_viewport(ws, w, h, req_id)
                    out_path = os.path.join(SCREENSHOTS_DIR, f"helper_empty_{name}_{lang}.png")
                    req_id += 1
                    await capture_screen(ws, out_path, req_id)

                    if name == "360px":
                        req_id += 1
                        of = await check_overflow(ws, req_id)
                        print(f"  [OVERFLOW CHECK {lang} 360px]: scroll={of['scrollWidth']}, client={of['clientWidth']}, hasOverflow={of['hasOverflow']}")
                        assert not of["hasOverflow"], f"Horizontal overflow detected at 360px in {lang}!"

            # Reset language to en
            req_id += 1
            await eval_js(ws, "document.getElementById('lang-en').click();", req_id)
            await asyncio.sleep(0.4)

            # Step 2: Seed realistic test data
            print("\n--- Seeding Test Data for Populated State ---")
            req_id += 1
            seed_res = await eval_js(ws, """
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
                    // Anita:
                    // 1. Ready to apply (2 days ago) -> Today list "Apply now"
                    { id: "app-1", profileId: "prof-anita", schemeId: "pmjjby", status: "Ready to apply", statusUpdatedAt: new Date(now - 2 * day).toISOString(), createdAt: new Date(now - 10 * day).toISOString(), updatedAt: new Date(now - 2 * day).toISOString() },
                    // 2. Documents pending (8 days ago >= 7) -> Today list "Collect documents"
                    { id: "app-2", profileId: "prof-anita", schemeId: "pmjdy", status: "Documents pending", statusUpdatedAt: new Date(now - 8 * day).toISOString(), createdAt: new Date(now - 10 * day).toISOString(), updatedAt: new Date(now - 8 * day).toISOString() },
                    // 3. Applied (35 days ago >= 30) -> Today list "Check status"
                    { id: "app-3", profileId: "prof-anita", schemeId: "pm-kisan", status: "Applied", statusUpdatedAt: new Date(now - 35 * day).toISOString(), createdAt: new Date(now - 35 * day).toISOString(), updatedAt: new Date(now - 35 * day).toISOString() },
                    // 4. Rejected (5 days ago <= 14) -> Today list "Rejected: review"
                    { id: "app-4", profileId: "prof-anita", schemeId: "mmlby", status: "Rejected", statusUpdatedAt: new Date(now - 5 * day).toISOString(), createdAt: new Date(now - 10 * day).toISOString(), updatedAt: new Date(now - 5 * day).toISOString() },

                    // Ramesh:
                    // 5. Benefit received
                    { id: "app-5", profileId: "prof-ramesh", schemeId: "pm-svanidhi", status: "Benefit received", statusUpdatedAt: new Date(now - 10 * day).toISOString(), createdAt: new Date(now - 15 * day).toISOString(), updatedAt: new Date(now - 10 * day).toISOString() },
                    // 6. Documents pending (3 days ago < 7, NOT in today list)
                    { id: "app-6", profileId: "prof-ramesh", schemeId: "apy", status: "Documents pending", statusUpdatedAt: new Date(now - 3 * day).toISOString(), createdAt: new Date(now - 15 * day).toISOString(), updatedAt: new Date(now - 3 * day).toISOString() },

                    // Ganesh:
                    // 7. Ready to apply (5 days ago) -> Today list "Apply now"
                    { id: "app-7", profileId: "prof-ganesh", schemeId: "ab-pmjay", status: "Ready to apply", statusUpdatedAt: new Date(now - 5 * day).toISOString(), createdAt: new Date(now - 8 * day).toISOString(), updatedAt: new Date(now - 5 * day).toISOString() },
                    // 8. Saved (not in today list)
                    { id: "app-8", profileId: "prof-ganesh", schemeId: "pmmy", status: "Saved", statusUpdatedAt: new Date(now - 1 * day).toISOString(), createdAt: new Date(now - 8 * day).toISOString(), updatedAt: new Date(now - 1 * day).toISOString() },

                    // Pooja:
                    // 9. Applied (12 days ago < 30, NOT in today list)
                    { id: "app-9", profileId: "prof-pooja", schemeId: "pmuy", status: "Applied", statusUpdatedAt: new Date(now - 12 * day).toISOString(), createdAt: new Date(now - 20 * day).toISOString(), updatedAt: new Date(now - 12 * day).toISOString() },

                    // Vikas:
                    // 10. Documents pending (15 days ago >= 7) -> Today list "Collect documents"
                    { id: "app-10", profileId: "prof-vikas", schemeId: "igndps", status: "Documents pending", statusUpdatedAt: new Date(now - 15 * day).toISOString(), createdAt: new Date(now - 25 * day).toISOString(), updatedAt: new Date(now - 15 * day).toISOString() },

                    // Sunita More:
                    // 11. Rejected (10 days ago <= 14) -> Today list "Rejected: review"
                    { id: "app-11", profileId: "prof-sunita", schemeId: "ignwps", status: "Rejected", statusUpdatedAt: new Date(now - 10 * day).toISOString(), createdAt: new Date(now - 30 * day).toISOString(), updatedAt: new Date(now - 10 * day).toISOString() }
                ];

                const profPromises = [p1, p2, p3, p4, p5, p6].map(p => window.GovDB.saveProfile(p));
                const appPromises = apps.map(a => window.GovDB.saveApplication(a));
                await Promise.all([...profPromises, ...appPromises]);
                window.location.reload();
                return true;
            })()
            """, req_id)
            await asyncio.sleep(2.0)

            # Verify populated state elements
            req_id += 1
            pop_info = await eval_js(ws, """
            (() => {
                const guide = document.getElementById("profiles-empty-state");
                const todaySec = document.getElementById("dash-today-section");
                const countCards = document.getElementById("dash-metrics-section");
                const actionRows = document.querySelectorAll(".dash-action-row");
                const profCards = document.querySelectorAll(".profile-card");
                const docsPendingCount = document.getElementById("stat-docs-pending").textContent.trim();
                const readyApplyCount = document.getElementById("stat-ready-apply").textContent.trim();
                const appliedCount = document.getElementById("stat-applied").textContent.trim();
                const benefitCount = document.getElementById("stat-benefit-received").textContent.trim();

                return {
                    guideHidden: guide ? window.getComputedStyle(guide).display === "none" : true,
                    todayVisible: todaySec ? window.getComputedStyle(todaySec).display !== "none" : false,
                    cardsVisible: countCards ? window.getComputedStyle(countCards).display !== "none" : false,
                    actionRowsCount: actionRows.length,
                    profCardsCount: profCards.length,
                    counts: {
                        docsPending: docsPendingCount,
                        readyApply: readyApplyCount,
                        applied: appliedCount,
                        benefit: benefitCount
                    }
                };
            })()
            """, req_id)
            print("[POPULATED STATE CHECK]:", pop_info)
            assert pop_info["guideHidden"], "Empty guide must be hidden when profiles exist"
            assert pop_info["todayVisible"], "Today section must be visible"
            assert pop_info["cardsVisible"], "Count cards must be visible"
            assert pop_info["actionRowsCount"] == 5, f"Top 5 action rows should be shown initially, got {pop_info['actionRowsCount']}"
            assert pop_info["profCardsCount"] == 6, f"All 6 profiles should be listed, got {pop_info['profCardsCount']}"
            # 3 Documents pending (Anita 8d, Ramesh 3d, Vikas 15d) -> 3
            # 2 Ready to apply (Anita 2d, Ganesh 5d) -> 2
            # 2 Applied (Anita 35d, Pooja 12d) -> 2
            # 1 Benefit received (Ramesh 10d) -> 1
            assert pop_info["counts"]["docsPending"] == "3"
            assert pop_info["counts"]["readyApply"] == "2"
            assert pop_info["counts"]["applied"] == "2"
            assert pop_info["counts"]["benefit"] == "1"

            # Check that no card looks selected on load
            req_id += 1
            selected_cards = await eval_js(ws, """
            (() => {
                const activeCards = document.querySelectorAll(".dash-count-card.active");
                return activeCards.length;
            })()
            """, req_id)
            assert selected_cards == 0, f"Expected 0 active count cards on initial load, got {selected_cards}"

            # Capture Populated State Screenshots
            print("\n--- Capturing Populated State Screenshots ---")
            for lang in langs:
                req_id += 1
                await eval_js(ws, f"document.getElementById('lang-{lang}').click();", req_id)
                await asyncio.sleep(0.5)

                for name, w, h in viewports:
                    req_id += 1
                    await set_viewport(ws, w, h, req_id)
                    out_path = os.path.join(SCREENSHOTS_DIR, f"helper_populated_{name}_{lang}.png")
                    req_id += 1
                    await capture_screen(ws, out_path, req_id)

                    if name == "360px":
                        req_id += 1
                        of = await check_overflow(ws, req_id)
                        print(f"  [OVERFLOW CHECK {lang} 360px]: scroll={of['scrollWidth']}, client={of['clientWidth']}, hasOverflow={of['hasOverflow']}")
                        assert not of["hasOverflow"], f"Horizontal overflow detected at 360px in {lang}!"

            # Reset language to en
            req_id += 1
            await eval_js(ws, "document.getElementById('lang-en').click();", req_id)
            await asyncio.sleep(0.4)

            # Test "Show all" expand in Today list
            print("\n--- Testing Today List Expand ---")
            req_id += 1
            await eval_js(ws, "document.getElementById('btn-dash-today-toggle').click();", req_id)
            await asyncio.sleep(0.4)
            req_id += 1
            expanded_rows = await eval_js(ws, "document.querySelectorAll('.dash-action-row').length;", req_id)
            print(f"  Today rows after expand: {expanded_rows} (Total qualified: 7)")
            assert expanded_rows == 7, f"Expected 7 action rows when expanded, got {expanded_rows}"

            # Capture expanded view at 1440px
            req_id += 1
            await set_viewport(ws, 1440, 900, req_id)
            out_expanded = os.path.join(SCREENSHOTS_DIR, "helper_today_expanded_1440px.png")
            req_id += 1
            await capture_screen(ws, out_expanded, req_id)

            # Test Count Card Click / Filtering
            print("\n--- Testing Count Card Filter & Active Style ---")
            req_id += 1
            # Click "Collect documents" card
            await eval_js(ws, "document.getElementById('card-count-docs-pending').click();", req_id)
            await asyncio.sleep(0.4)

            req_id += 1
            filter_check = await eval_js(ws, """
            (() => {
                const cardActive = document.getElementById('card-count-docs-pending').classList.contains('active');
                const barVisible = window.getComputedStyle(document.getElementById('dash-filter-active-bar')).display !== 'none';
                const filteredCards = document.querySelectorAll('.profile-card');
                return {
                    cardActive: cardActive,
                    barVisible: barVisible,
                    filteredCardsCount: filteredCards.length
                };
            })()
            """, req_id)
            print("[FILTER CHECK]:", filter_check)
            assert filter_check["cardActive"], "Collect documents card must have .active class"
            assert filter_check["barVisible"], "Filter active notification bar must be visible"
            # Anita, Ramesh, Vikas have Documents pending -> 3 profiles
            assert filter_check["filteredCardsCount"] == 3, f"Expected 3 filtered profiles, got {filter_check['filteredCardsCount']}"

            # Capture filtered state at 360px
            req_id += 1
            await set_viewport(ws, 360, 740, req_id)
            out_filter = os.path.join(SCREENSHOTS_DIR, "helper_filter_active_360px.png")
            req_id += 1
            await capture_screen(ws, out_filter, req_id)

            # Test Clear Filter
            print("\n--- Testing Clear Filter ---")
            req_id += 1
            await eval_js(ws, "document.getElementById('btn-dash-clear-filter').click();", req_id)
            await asyncio.sleep(0.4)

            req_id += 1
            cleared_check = await eval_js(ws, """
            (() => {
                const activeCards = document.querySelectorAll('.dash-count-card.active');
                const barHidden = window.getComputedStyle(document.getElementById('dash-filter-active-bar')).display === 'none';
                const profCards = document.querySelectorAll('.profile-card');
                return {
                    activeCardsCount: activeCards.length,
                    barHidden: barHidden,
                    profCardsCount: profCards.length
                };
            })()
            """, req_id)
            print("[CLEARED FILTER CHECK]:", cleared_check)
            assert cleared_check["activeCardsCount"] == 0, "No cards should be active after clear"
            assert cleared_check["barHidden"], "Filter bar should be hidden after clear"
            assert cleared_check["profCardsCount"] == 6, "All 6 profiles should be restored"

            # Check Backup footer warning state
            print("\n--- Testing Backup Footer Warning State ---")
            req_id += 1
            backup_check = await eval_js(ws, """
            (() => {
                const footer = document.getElementById('dash-footer-backup');
                const warn = document.getElementById('dash-backup-warning');
                return {
                    hasWarningClass: footer ? footer.classList.contains('has-unbacked-changes') : false,
                    warningVisible: warn ? window.getComputedStyle(warn).display !== 'none' : false,
                    warningText: warn ? warn.textContent.trim() : null
                };
            })()
            """, req_id)
            print("[BACKUP FOOTER CHECK]:", backup_check)
            assert backup_check["hasWarningClass"], "Backup line must show has-unbacked-changes when unbacked-up changes exist"
            assert backup_check["warningVisible"], "'Changes not backed up' must be visible"

            print("\n==================================================")
            print("ALL VISUAL SCREENSHOTS AND INTERACTIVE CHECKS COMPLETED SUCCESSFULLY!")
            print("==================================================")

    finally:
        browser.kill()

if __name__ == "__main__":
    asyncio.run(main())
