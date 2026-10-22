import asyncio
import json
import os
import shutil
import subprocess
import time
import urllib.request
import websockets

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
USER_DATA_DIR = r"C:\gov scheme\temp_edge_stage4_verify"

async def run_stage4_verification():
    print("==================================================")
    print("STAGE 4 ACCEPTANCE VERIFICATION SUITE")
    print("==================================================")

    if os.path.exists(USER_DATA_DIR):
        shutil.rmtree(USER_DATA_DIR, ignore_errors=True)

    proc = subprocess.Popen([
        EDGE_PATH,
        "--headless=new",
        "--remote-debugging-port=9250",
        f"--user-data-dir={USER_DATA_DIR}",
        "http://localhost:8000/"
    ])
    await asyncio.sleep(2.0)

    try:
        req = urllib.request.urlopen("http://localhost:9250/json")
        targets = json.loads(req.read().decode("utf-8"))
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
        assert ws_url, "Could not connect to Edge via CDP."

        async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
            await ws.send(json.dumps({"id": 1, "method": "Runtime.enable"}))
            await ws.recv()
            await asyncio.sleep(0.5)

            # ----------------------------------------------------
            # (a) First-time visit shows Landing page (#/)
            # ----------------------------------------------------
            print("\n[CRITERION A] First-time visit shows Landing page (#/)...")
            script_a = """
            (function() {
                return {
                    hash: window.location.hash,
                    landingDisplay: document.getElementById('landing-view').style.display,
                    dashboardDisplay: document.getElementById('dashboard-view').style.display,
                    finderDisplay: document.getElementById('finder-view').style.display,
                    setupDisplay: document.getElementById('setup-view').style.display,
                    hasLandingHelperBtn: !!document.getElementById('btn-landing-helper'),
                    hasLandingQuickBtn: !!document.getElementById('btn-landing-quick'),
                    privacyNote: document.getElementById('landing-privacy-note') ? document.getElementById('landing-privacy-note').textContent : ''
                };
            })()
            """
            await ws.send(json.dumps({"id": 10, "method": "Runtime.evaluate", "params": {"expression": script_a, "returnByValue": True}}))
            while True:
                msg = await ws.recv()
                d = json.loads(msg)
                if d.get("id") == 10:
                    res = d["result"]["result"]["value"]
                    print(f"  Landing state: hash={res['hash']}, landingDisplay={res['landingDisplay']}")
                    assert res["landingDisplay"] == "block", f"Landing view is not block: {res}"
                    assert res["dashboardDisplay"] == "none", "Dashboard should be hidden on first visit"
                    assert res["finderDisplay"] == "none", "Finder should be hidden on first visit"
                    assert res["hasLandingHelperBtn"], "Missing 'I\\'m a Helper' button"
                    assert res["hasLandingQuickBtn"], "Missing 'Quick check' button"
                    assert "Aadhaar is never stored" in res["privacyNote"], f"Privacy note mismatch: {res['privacyNote']}"
                    print("  [PASS] (a) First-time visit correctly shows landing view with CTAs and privacy note.")
                    break

            # ----------------------------------------------------
            # (b) Quick check works with no account and saves nothing
            # ----------------------------------------------------
            print("\n[CRITERION B] Quick check works with no account and saves nothing...")
            script_b = """
            (async function() {
                // Click quick check button
                document.getElementById('btn-landing-quick').click();
                await new Promise(r => setTimeout(r, 400));

                // Check banner and prompt card
                const bannerDisplay = document.getElementById('quick-check-banner').style.display;
                const bannerText = document.getElementById('quick-check-banner-text').textContent;
                const convertCardDisplay = document.getElementById('quick-convert-card').style.display;

                // Load sample persona Ganesh (persona_4)
                const select = document.getElementById('persona-select');
                select.value = 'persona_4';
                select.dispatchEvent(new Event('change', { bubbles: true }));
                await new Promise(r => setTimeout(r, 500));

                // Check answers and schemes
                const eligibleCount = parseInt(document.getElementById('count-eligible').textContent, 10);
                const factsCount = parseInt(document.getElementById('facts-count').textContent, 10);

                // Check IndexedDB counts
                const profs = await window.GovDB.getAllProfiles();
                const apps = await window.GovDB.getAllApplications();

                return {
                    hash: window.location.hash,
                    bannerDisplay,
                    bannerText,
                    convertCardDisplay,
                    eligibleCount,
                    factsCount,
                    dbProfilesCount: profs.length,
                    dbAppsCount: apps.length
                };
            })()
            """
            await ws.send(json.dumps({"id": 20, "method": "Runtime.evaluate", "params": {"expression": script_b, "awaitPromise": True, "returnByValue": True}}))
            while True:
                msg = await ws.recv()
                d = json.loads(msg)
                if d.get("id") == 20:
                    res = d["result"]["result"]["value"]
                    print(f"  Quick check state: hash={res['hash']}, banner={res['bannerText']}, eligible={res['eligibleCount']}, dbProfiles={res['dbProfilesCount']}")
                    assert res["hash"] == "#/quick", f"Hash is not #/quick: {res['hash']}"
                    assert "nothing is saved" in res["bannerText"].lower(), f"Banner text missing 'nothing is saved': {res['bannerText']}"
                    assert res["eligibleCount"] > 0, f"Persona 4 should have eligible schemes: {res['eligibleCount']}"
                    assert res["dbProfilesCount"] == 0, f"Quick check MUST NOT save profiles to DB! Found: {res['dbProfilesCount']}"
                    assert res["dbAppsCount"] == 0, f"Quick check MUST NOT save applications to DB! Found: {res['dbAppsCount']}"
                    print("  [PASS] (b) Quick check evaluated schemes without saving any profile or application.")
                    break

            # ----------------------------------------------------
            # (d) Quick check can be turned into a saved profile with its answers
            # ----------------------------------------------------
            print("\n[CRITERION D] Quick check can be turned into a saved profile with its answers...")
            script_d1 = """
            (async function() {
                // Click convert button
                document.getElementById('btn-quick-convert').click();
                await new Promise(r => setTimeout(r, 300));
                return {
                    hash: window.location.hash,
                    setupDisplay: document.getElementById('setup-view').style.display,
                    noticeText: document.getElementById('setup-notice-text').textContent
                };
            })()
            """
            await ws.send(json.dumps({"id": 30, "method": "Runtime.evaluate", "params": {"expression": script_d1, "awaitPromise": True, "returnByValue": True}}))
            while True:
                msg = await ws.recv()
                d = json.loads(msg)
                if d.get("id") == 30:
                    res = d["result"]["result"]["value"]
                    print(f"  Setup redirect: hash={res['hash']}, notice={res['noticeText']}")
                    assert res["hash"] == "#/setup", f"Expected #/setup, got {res['hash']}"
                    assert res["setupDisplay"] == "block", "Setup view should be visible"
                    assert "Secure login will be added later" in res["noticeText"], "Missing honest setup notice"
                    break

            # Fill Helper setup and save
            script_d2 = """
            (async function() {
                document.getElementById('input-helper-name').value = 'Sunita Patil';
                document.getElementById('select-helper-type').value = 'ASHA';
                document.getElementById('input-helper-district').value = 'Kolhapur';
                document.getElementById('select-helper-language').value = 'en';

                // Save setup
                document.getElementById('btn-save-setup').click();
                await new Promise(r => setTimeout(r, 500));

                // Should now open Add Profile Modal because pendingQuickCheckConversion is true
                const modalDisplay = document.getElementById('modal-add-profile').style.display;
                const helperMeta = await window.GovDB.getMeta('helper_account');

                // Fill beneficiary details
                document.getElementById('input-profile-name').value = 'Ganesh Farmer';
                document.getElementById('check-profile-consent').checked = true;

                // Click create
                document.getElementById('btn-create-profile').click();
                await new Promise(r => setTimeout(r, 600));

                const activeName = document.getElementById('active-profile-name').textContent;
                const eligibleCount = parseInt(document.getElementById('count-eligible').textContent, 10);
                const profs = await window.GovDB.getAllProfiles();

                return {
                    helperSaved: !!helperMeta,
                    helperName: helperMeta ? helperMeta.name : null,
                    helperType: helperMeta ? helperMeta.helper_type : null,
                    activeHash: window.location.hash,
                    activeName,
                    eligibleCount,
                    savedProfilesCount: profs.length,
                    savedProfileFacts: profs.length > 0 ? profs[0].facts : null
                };
            })()
            """
            await ws.send(json.dumps({"id": 31, "method": "Runtime.evaluate", "params": {"expression": script_d2, "awaitPromise": True, "returnByValue": True}}))
            while True:
                msg = await ws.recv()
                d = json.loads(msg)
                if d.get("id") == 31:
                    res = d["result"]["result"]["value"]
                    print(f"  Profile created: hash={res['activeHash']}, name={res['activeName']}, helper={res['helperName']} ({res['helperType']})")
                    assert res["helperSaved"], "Helper account was not saved to meta store!"
                    assert res["helperName"] == "Sunita Patil"
                    assert res["helperType"] == "ASHA"
                    assert res["savedProfilesCount"] == 1, f"Expected 1 saved profile, got {res['savedProfilesCount']}"
                    assert res["activeName"] == "Ganesh Farmer"
                    assert res["savedProfileFacts"]["age"] == 36, "Quick check answers (age=36) were not preserved in converted profile!"
                    assert res["savedProfileFacts"]["household"]["state"] == "Maharashtra", "Quick check household state not preserved!"
                    assert res["eligibleCount"] > 0, "Converted profile should show eligible schemes"
                    print("  [PASS] (d) Quick check converted to saved profile with all answers preserved and consent recorded.")
                    break

            # ----------------------------------------------------
            # (c) & (e) Helper home, revisiting goes straight to Helper home, refresh & back button
            # ----------------------------------------------------
            print("\n[CRITERION C & E] Helper setup, revisiting goes straight to Helper home, refresh & back button...")
            script_c = """
            (async function() {
                // Navigate back to Helper home
                document.getElementById('btn-back-to-dashboard').click();
                await new Promise(r => setTimeout(r, 300));

                const hashAfterBack = window.location.hash;
                const dashboardDisplay = document.getElementById('dashboard-view').style.display;
                const helperName = document.getElementById('header-helper-name').textContent;
                const helperRole = document.getElementById('header-helper-role').textContent;
                const totalProfiles = document.getElementById('stat-total-profiles').textContent;

                return {
                    hashAfterBack,
                    dashboardDisplay,
                    helperName,
                    helperRole,
                    totalProfiles
                };
            })()
            """
            await ws.send(json.dumps({"id": 40, "method": "Runtime.evaluate", "params": {"expression": script_c, "awaitPromise": True, "returnByValue": True}}))
            while True:
                msg = await ws.recv()
                d = json.loads(msg)
                if d.get("id") == 40:
                    res = d["result"]["result"]["value"]
                    print(f"  Helper home: hash={res['hashAfterBack']}, helper={res['helperName']} ({res['helperRole']}), totalProfiles={res['totalProfiles']}")
                    assert res["hashAfterBack"] == "#/helper", f"Expected #/helper, got {res['hashAfterBack']}"
                    assert res["dashboardDisplay"] == "block", "Helper home view not visible"
                    assert res["helperName"] == "Sunita Patil"
                    assert res["helperRole"] == "ASHA"
                    assert res["totalProfiles"] == "1"
                    print("  [PASS] (c1) Helper home correctly displayed with helper credentials and profile count.")
                    break

            # Test revisiting URL without hash -> redirects straight to #/helper
            print("  Testing revisiting root URL (http://localhost:8000/)...")
            await ws.send(json.dumps({"id": 41, "method": "Page.navigate", "params": {"url": "http://localhost:8000/"}}))
            await asyncio.sleep(1.0)
            script_revisit = """
            (function() {
                return {
                    hash: window.location.hash,
                    dashboardDisplay: document.getElementById('dashboard-view').style.display,
                    landingDisplay: document.getElementById('landing-view').style.display,
                    helperName: document.getElementById('header-helper-name').textContent
                };
            })()
            """
            await ws.send(json.dumps({"id": 42, "method": "Runtime.evaluate", "params": {"expression": script_revisit, "returnByValue": True}}))
            while True:
                msg = await ws.recv()
                d = json.loads(msg)
                if d.get("id") == 42:
                    res = d["result"]["result"]["value"]
                    print(f"  Revisit result: hash={res['hash']}, dashboardDisplay={res['dashboardDisplay']}")
                    assert res["hash"] == "#/helper", f"Revisiting did not redirect to #/helper! Got {res['hash']}"
                    assert res["dashboardDisplay"] == "block"
                    assert res["landingDisplay"] == "none"
                    print("  [PASS] (c2) Revisiting root URL automatically routes to Helper home (#/helper).")
                    break

            # Test refresh and back button maintaining screen
            print("  Testing refresh on profile screen and browser back/forward navigation...")
            script_nav = """
            (async function() {
                // Click on the Ganesh Farmer profile card
                const card = document.querySelector('.profile-card');
                if (!card) return { error: 'No profile card found' };
                card.click();
                await new Promise(r => setTimeout(r, 400));

                const hashBeforeReload = window.location.hash;
                return { hashBeforeReload };
            })()
            """
            await ws.send(json.dumps({"id": 43, "method": "Runtime.evaluate", "params": {"expression": script_nav, "awaitPromise": True, "returnByValue": True}}))
            while True:
                msg = await ws.recv()
                d = json.loads(msg)
                if d.get("id") == 43:
                    res = d["result"]["result"]["value"]
                    assert res["hashBeforeReload"].startswith("#/profile/"), f"Did not navigate to profile: {res}"
                    break

            # Reload page at #/profile/<id>
            print("  Reloading page at profile URL...")
            await ws.send(json.dumps({"id": 44, "method": "Page.reload"}))
            await asyncio.sleep(1.2)

            script_after_reload = """
            (function() {
                return {
                    hash: window.location.hash,
                    finderDisplay: document.getElementById('finder-view').style.display,
                    activeName: document.getElementById('active-profile-name').textContent,
                    eligibleCount: parseInt(document.getElementById('count-eligible').textContent, 10)
                };
            })()
            """
            await ws.send(json.dumps({"id": 45, "method": "Runtime.evaluate", "params": {"expression": script_after_reload, "returnByValue": True}}))
            while True:
                msg = await ws.recv()
                d = json.loads(msg)
                if d.get("id") == 45:
                    res = d["result"]["result"]["value"]
                    print(f"  After reload: hash={res['hash']}, activeName={res['activeName']}, eligible={res['eligibleCount']}")
                    assert res["hash"].startswith("#/profile/"), f"Reload changed hash: {res['hash']}"
                    assert res["activeName"] == "Ganesh Farmer", f"Reload lost active profile name: {res['activeName']}"
                    assert res["eligibleCount"] > 0, "Reload lost evaluation state"
                    print("  [PASS] (e1) Page reload maintained the profile view and loaded profile data correctly.")
                    break

            # Test back button via history.back()
            print("  Testing browser back button...")
            script_history_back = """
            (async function() {
                window.history.back();
                await new Promise(r => setTimeout(r, 400));
                return {
                    hash: window.location.hash,
                    dashboardDisplay: document.getElementById('dashboard-view').style.display
                };
            })()
            """
            await ws.send(json.dumps({"id": 46, "method": "Runtime.evaluate", "params": {"expression": script_history_back, "awaitPromise": True, "returnByValue": True}}))
            while True:
                msg = await ws.recv()
                d = json.loads(msg)
                if d.get("id") == 46:
                    res = d["result"]["result"]["value"]
                    print(f"  After history.back(): hash={res['hash']}, dashboardDisplay={res['dashboardDisplay']}")
                    assert res["hash"] == "#/helper", f"Expected #/helper, got {res['hash']}"
                    assert res["dashboardDisplay"] == "block", "Dashboard view should be visible after back"
                    print("  [PASS] (e2) Browser back button navigated smoothly to Helper home.")
                    break

            # ----------------------------------------------------
            # (f) Follow-up list shows real day counts (>= 7 days, oldest first)
            # ----------------------------------------------------
            print("\n[CRITERION F] Follow-up list shows real day counts (>= 7 days, oldest first)...")
            script_f_setup = """
            (async function() {
                const profs = await window.GovDB.getAllProfiles();
                const pid = profs[0].id;
                const now = Date.now();
                const ONE_DAY = 24 * 60 * 60 * 1000;

                // Create test applications:
                // 1. Ready to apply, 15 days ago (SHOULD APPEAR, oldest first)
                await window.GovDB.saveApplication({
                    profileId: pid,
                    schemeId: 'pm-kisan',
                    status: 'Ready to apply',
                    statusUpdatedAt: new Date(now - 15 * ONE_DAY).toISOString(),
                    docsDone: [0, 1],
                    note: 'Waiting for CSC submission'
                });

                // 2. Documents pending, 8 days ago (SHOULD APPEAR, second)
                await window.GovDB.saveApplication({
                    profileId: pid,
                    schemeId: 'mjpjay',
                    status: 'Documents pending',
                    statusUpdatedAt: new Date(now - 8 * ONE_DAY).toISOString(),
                    docsDone: [],
                    note: 'Ration card copy needed'
                });

                // 3. Documents pending, 3 days ago (< 7 days, MUST NOT APPEAR)
                await window.GovDB.saveApplication({
                    profileId: pid,
                    schemeId: 'apy',
                    status: 'Documents pending',
                    statusUpdatedAt: new Date(now - 3 * ONE_DAY).toISOString(),
                    docsDone: [],
                    note: 'Recent'
                });

                // 4. Applied, 20 days ago (Status is Applied, NOT pending/ready, MUST NOT APPEAR)
                await window.GovDB.saveApplication({
                    profileId: pid,
                    schemeId: 'pmjjby',
                    status: 'Applied',
                    statusUpdatedAt: new Date(now - 20 * ONE_DAY).toISOString(),
                    docsDone: [],
                    note: 'Submitted'
                });

                return { saved: true };
            })()
            """
            await ws.send(json.dumps({"id": 50, "method": "Runtime.evaluate", "params": {"expression": script_f_setup, "awaitPromise": True, "returnByValue": True}}))
            while True:
                msg = await ws.recv()
                d = json.loads(msg)
                if d.get("id") == 50:
                    break

            # Reload to refresh helper home with newly persisted applications
            await ws.send(json.dumps({"id": 51, "method": "Page.reload"}))
            await asyncio.sleep(1.5)

            script_f_check = """
            (async function() {
                // Wait up to 3 seconds for dashboard to load applications and render follow-up
                for (let i = 0; i < 30; i++) {
                    const badge = document.getElementById('followup-badge');
                    const statReady = document.getElementById('stat-ready-apply');
                    if (badge && statReady && statReady.textContent !== '0') {
                        break;
                    }
                    await new Promise(r => setTimeout(r, 100));
                }

                const badgeEl = document.getElementById('followup-badge');
                const badgeCount = badgeEl ? parseInt(badgeEl.textContent, 10) : 0;
                const cards = document.querySelectorAll('.followup-card');
                const cardDetails = Array.from(cards).map(c => {
                    const profileName = c.querySelector('.followup-beneficiary') ? c.querySelector('.followup-beneficiary').textContent : '';
                    const schemeName = c.querySelector('.followup-scheme') ? c.querySelector('.followup-scheme').textContent : '';
                    const statusText = c.querySelector('.followup-status-tag') ? c.querySelector('.followup-status-tag').textContent.trim() : '';
                    const daysBadge = c.querySelector('.followup-days-badge') ? c.querySelector('.followup-days-badge').textContent : '';
                    return { profileName, schemeName, statusText, daysBadge };
                });

                const statTotal = document.getElementById('stat-total-profiles') ? document.getElementById('stat-total-profiles').textContent : '';
                const statDocsPending = document.getElementById('stat-docs-pending') ? document.getElementById('stat-docs-pending').textContent : '';
                const statReady = document.getElementById('stat-ready-apply') ? document.getElementById('stat-ready-apply').textContent : '';
                const statApplied = document.getElementById('stat-applied') ? document.getElementById('stat-applied').textContent : '';

                return {
                    badgeCount,
                    cardsLength: cards.length,
                    cardDetails,
                    summaryTiles: {
                        total: statTotal,
                        docsPending: statDocsPending,
                        ready: statReady,
                        applied: statApplied
                    }
                };
            })()
            """
            await ws.send(json.dumps({"id": 52, "method": "Runtime.evaluate", "params": {"expression": script_f_check, "awaitPromise": True, "returnByValue": True}}))
            while True:
                msg = await ws.recv()
                d = json.loads(msg)
                if d.get("id") == 52:
                    if "exceptionDetails" in d.get("result", {}):
                        print("EXCEPTION in script_f_check:", json.dumps(d["result"]["exceptionDetails"], indent=2))
                    res = d["result"]["result"]["value"]
                    print(f"  Follow-up badge: {res['badgeCount']}, cards found: {res['cardsLength']}")
                    for i, c in enumerate(res["cardDetails"]):
                        print(f"    [{i+1}] {c['profileName']} - {c['schemeName']} ({c['statusText']}) -> {c['daysBadge']}")
                    print(f"  Summary tiles: {res['summaryTiles']}")

                    assert res["badgeCount"] == 2, f"Expected 2 follow-ups, got {res['badgeCount']}"
                    assert res["cardsLength"] == 2, f"Expected 2 follow-up cards, got {res['cardsLength']}"
                    # Oldest first: 15 days card first, then 8 days card
                    assert "15" in res["cardDetails"][0]["daysBadge"], f"Expected 15 days on first card, got {res['cardDetails'][0]['daysBadge']}"
                    assert "8" in res["cardDetails"][1]["daysBadge"], f"Expected 8 days on second card, got {res['cardDetails'][1]['daysBadge']}"
                    assert res["summaryTiles"]["total"] == "1"
                    assert res["summaryTiles"]["docsPending"] == "2"
                    assert res["summaryTiles"]["ready"] == "1"
                    assert res["summaryTiles"]["applied"] == "1"
                    print("  [PASS] (f) Follow-up list correctly filtered >= 7 days, sorted oldest-first with real day counts.")
                    break

            print("\n==================================================")
            print("ALL STAGE 4 VERIFICATION TESTS PASSED PERFECTLY!")
            print("==================================================")

    finally:
        proc.terminate()
        shutil.rmtree(USER_DATA_DIR, ignore_errors=True)

if __name__ == "__main__":
    asyncio.run(run_stage4_verification())
