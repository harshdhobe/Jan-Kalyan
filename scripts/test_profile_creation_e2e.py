import asyncio
import json
import os
import shutil
import subprocess
import time
import urllib.request
import websockets

async def run_e2e():
    print("==================================================")
    print("RUNNING E2E CDP PROFILE CREATION & SCHEMES TEST")
    print("==================================================")

    edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    user_data = r"C:\gov scheme\temp_edge_user_e2e"
    if os.path.exists(user_data):
        shutil.rmtree(user_data, ignore_errors=True)

    proc = subprocess.Popen([
        edge_path,
        "--headless=new",
        "--remote-debugging-port=9223",
        f"--user-data-dir={user_data}",
        "http://localhost:8000/"
    ])

    await asyncio.sleep(2.0)

    try:
        req = urllib.request.urlopen("http://localhost:9223/json")
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

        assert ws_url, "No page websocket URL found!"

        async with websockets.connect(ws_url) as ws:
            await ws.send(json.dumps({"id": 1, "method": "Runtime.enable"}))
            await ws.send(json.dumps({"id": 2, "method": "Log.enable"}))
            await ws.send(json.dumps({"id": 3, "method": "Page.navigate", "params": {"url": "http://localhost:8000/"}}))
            await asyncio.sleep(1.5)

            # Test 1: Open Add Profile modal, fill details as in user's screenshot ("treer", consent checked), click Create & Check Schemes
            create_script = """
            (async function() {
                document.getElementById('btn-add-profile').click();
                await new Promise(r => setTimeout(r, 200));
                var inp = document.getElementById('input-profile-name');
                var chk = document.getElementById('check-profile-consent');
                var btn = document.getElementById('btn-create-profile');
                inp.value = 'treer';
                chk.checked = true;
                btn.click();
                await new Promise(r => setTimeout(r, 600));
                return {
                    modalDisplay: document.getElementById('modal-add-profile').style.display,
                    finderViewDisplay: document.getElementById('finder-view').style.display,
                    dashboardViewDisplay: document.getElementById('dashboard-view').style.display,
                    activeProfileName: document.getElementById('active-profile-name') ? document.getElementById('active-profile-name').textContent : null,
                    activeProfilePill: document.getElementById('active-profile-pill') ? document.getElementById('active-profile-pill').style.display : null,
                    errorDisplay: document.getElementById('add-profile-error').style.display
                };
            })()
            """
            await ws.send(json.dumps({
                "id": 10,
                "method": "Runtime.evaluate",
                "params": {"expression": create_script, "awaitPromise": True, "returnByValue": True}
            }))

            while True:
                msg = await ws.recv()
                data = json.loads(msg)
                if data.get("id") == 10:
                    res = data["result"]["result"]["value"]
                    print("Test 1 (Click Create Button) result:", res)
                    assert res["modalDisplay"] == "none", f"Modal did not close! State: {res}"
                    assert res["finderViewDisplay"] != "none", "Did not navigate to finder view!"
                    assert res["activeProfileName"] == "treer", f"Profile name mismatch: {res['activeProfileName']}"
                    print("  [PASS] Profile 'treer' created and finder view displayed!")
                    break

            # Test 2: In finder view, save first scheme and verify saved tab updates
            save_scheme_script = """
            (async function() {
                document.getElementById('tab-unknown').click();
                await new Promise(r => setTimeout(r, 400));
                var saveBtns = document.querySelectorAll('.btn-save-scheme');
                if (saveBtns.length === 0) return { error: "No save buttons found" };
                saveBtns[0].click();
                await new Promise(r => setTimeout(r, 500));
                var countSaved = document.getElementById('count-saved').textContent;
                return {
                    savedCount: countSaved,
                    hasChip: !!document.querySelector('.status-chip')
                };
            })()
            """
            await ws.send(json.dumps({
                "id": 11,
                "method": "Runtime.evaluate",
                "params": {"expression": save_scheme_script, "awaitPromise": True, "returnByValue": True}
            }))

            while True:
                msg = await ws.recv()
                data = json.loads(msg)
                if data.get("id") == 11:
                    res = data["result"]["result"]["value"]
                    print("Test 2 (Save Scheme) result:", res)
                    assert int(res["savedCount"]) >= 1, f"Saved count was not updated: {res}"
                    print("  [PASS] Scheme saved successfully, count updated to", res["savedCount"])
                    break

            # Test 3: Navigate back to dashboard, verify profile appears in dashboard list
            back_to_dash_script = """
            (async function() {
                document.getElementById('btn-back-to-dashboard').click();
                await new Promise(r => setTimeout(r, 600));
                var cards = document.querySelectorAll('.profile-card');
                return {
                    dashDisplay: document.getElementById('dashboard-view').style.display,
                    finderDisplay: document.getElementById('finder-view').style.display,
                    profileCardsCount: cards.length,
                    firstCardName: cards.length > 0 ? (cards[0].querySelector('.profile-card-name') ? cards[0].querySelector('.profile-card-name').textContent : '') : null
                };
            })()
            """
            await ws.send(json.dumps({
                "id": 12,
                "method": "Runtime.evaluate",
                "params": {"expression": back_to_dash_script, "awaitPromise": True, "returnByValue": True}
            }))

            while True:
                msg = await ws.recv()
                data = json.loads(msg)
                if data.get("id") == 12:
                    print("RAW DATA FOR ID 12:", json.dumps(data, indent=2))
                    res = data["result"]["result"].get("value", {})
                    print("Test 3 (Return to Dashboard) result:", res)
                    assert res.get("profileCardsCount", 0) >= 1, f"Profile card not shown in dashboard! Data: {res}"
                    assert "treer" in res.get("firstCardName", ""), f"Profile name mismatch: {res.get('firstCardName')}"
                    print("  [PASS] Dashboard shows profile card for 'treer'!")
                    break

            # Test 4: Create a second profile via form submit (pressing ENTER on input)
            enter_submit_script = """
            (async function() {
                document.getElementById('btn-add-profile').click();
                await new Promise(r => setTimeout(r, 200));
                var inp = document.getElementById('input-profile-name');
                var chk = document.getElementById('check-profile-consent');
                inp.value = 'Sunita Rao';
                chk.checked = true;
                // Dispatch submit event on the form
                document.getElementById('form-add-profile').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                await new Promise(r => setTimeout(r, 600));
                return {
                    modalDisplay: document.getElementById('modal-add-profile').style.display,
                    finderViewDisplay: document.getElementById('finder-view').style.display,
                    activeProfileName: document.getElementById('active-profile-name').textContent
                };
            })()
            """
            await ws.send(json.dumps({
                "id": 13,
                "method": "Runtime.evaluate",
                "params": {"expression": enter_submit_script, "awaitPromise": True, "returnByValue": True}
            }))

            while True:
                msg = await ws.recv()
                data = json.loads(msg)
                if data.get("id") == 13:
                    res = data["result"]["result"]["value"]
                    print("Test 4 (Submit on Enter) result:", res)
                    assert res["modalDisplay"] == "none", "Modal did not close on Enter submit!"
                    assert res["activeProfileName"] == "Sunita Rao", f"Profile name mismatch: {res['activeProfileName']}"
                    print("  [PASS] Profile 'Sunita Rao' created via form submit / ENTER!")
                    break

            print("\n==================================================")
            print("ALL E2E CDP TESTS PASSED PERFECTLY!")
            print("==================================================")

    finally:
        proc.terminate()
        shutil.rmtree(user_data, ignore_errors=True)

if __name__ == "__main__":
    asyncio.run(run_e2e())
