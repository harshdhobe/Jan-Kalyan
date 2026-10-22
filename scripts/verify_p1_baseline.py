import asyncio
import json
import os
import shutil
import subprocess
import urllib.request
import websockets

PERSONAS = [
    {
        "id": "persona_1",
        "name": "Ramcharan (70M, Rural Elder, SC)",
        "facts": {
            "age": 70,
            "gender": "male",
            "has_bank_account": True,
            "household": {
                "state": "Uttar Pradesh",
                "area_type": "rural",
                "bpl": True,
                "is_sc_st": True,
                "owns_pucca_house": False,
                "house_type": "kutcha",
                "rooms": 1,
                "owns_cultivable_land": False,
                "has_lpg": False,
            }
        }
    },
    {
        "id": "persona_2",
        "name": "Sunita (52F, Rural Maharashtra Widow)",
        "facts": {
            "age": 52,
            "gender": "female",
            "marital_status": "widowed",
            "has_bank_account": True,
            "has_aadhaar_linked_bank_account": True,
            "is_destitute": True,
            "domicile_years_maharashtra": 20,
            "household": {
                "state": "Maharashtra",
                "area_type": "rural",
                "bpl": True,
                "income": 18000,
                "ration_card_type": "yellow",
                "has_domicile_certificate": True,
                "owns_pucca_house": False,
                "house_type": "kutcha",
                "rooms": 1,
                "has_lpg": False,
                "is_sc_st": False,
                "owns_cultivable_land": False,
            }
        }
    },
    {
        "id": "persona_3",
        "name": "Ramesh (28M, Urban Street Vendor, Delhi)",
        "facts": {
            "age": 28,
            "gender": "male",
            "marital_status": "married",
            "has_bank_account": True,
            "has_aadhaar": True,
            "has_mobile": True,
            "is_street_vendor": True,
            "vendor_status": "has_certificate_or_id",
            "wants_business_loan": True,
            "is_loan_defaulter": False,
            "is_unorganised_worker": True,
            "monthly_income": 12000,
            "household": {
                "state": "Delhi",
                "area_type": "urban",
                "bpl": False,
                "income": 144000,
                "owns_pucca_house": False,
                "used_housing_scheme_before": False,
                "has_listed_urban_worker": True,
                "has_lpg": True,
            }
        }
    },
    {
        "id": "persona_4",
        "name": "Ganesh (36M, Smallholder Farmer, Maharashtra)",
        "facts": {
            "age": 36,
            "gender": "male",
            "has_bank_account": True,
            "has_aadhaar": True,
            "owns_land_in_own_name": True,
            "land_hectares": 1.5,
            "name_in_land_records_aug2019": True,
            "household": {
                "state": "Maharashtra",
                "owns_cultivable_land": True,
                "area_type": "rural",
                "bpl": False,
                "income": 120000,
                "ration_card_type": "orange",
                "has_domicile_certificate": True,
                "owns_pucca_house": True,
                "has_lpg": True,
            }
        }
    },
    {
        "id": "persona_5",
        "name": "Pooja (32F, Urban Salaried Middle-Class, Maharashtra)",
        "facts": {
            "age": 32,
            "gender": "female",
            "marital_status": "married",
            "has_bank_account": True,
            "has_aadhaar_linked_bank_account": True,
            "household": {
                "state": "Maharashtra",
                "area_type": "urban",
                "income": 1200000,
                "owns_pucca_house": False,
                "used_housing_scheme_before": False,
                "has_listed_urban_worker": False,
                "special_vulnerable_group": False,
                "bpl": False,
                "has_lpg": True,
                "has_domicile_certificate": True,
                "ration_card_type": "white",
                "owns_cultivable_land": False,
            }
        }
    },
    {
        "id": "persona_6",
        "name": "Vikas (24M, Young Severe Disability Candidate, Bihar)",
        "facts": {
            "age": 24,
            "gender": "male",
            "has_disability": True,
            "disability_percent": 85,
            "has_bank_account": True,
            "is_destitute": False,
            "household": {
                "state": "Bihar",
                "area_type": "rural",
                "bpl": True,
                "income": 30000,
                "owns_pucca_house": False,
                "house_type": "kutcha",
                "rooms": 2,
                "disabled_member_no_able_adult": True,
                "is_sc_st": False,
                "has_lpg": True,
                "owns_cultivable_land": False,
            }
        }
    },
    {
        "id": "persona_7",
        "name": "Priya (22F, Partial Profile / 3-Valued Logic Short-Circuit)",
        "facts": {
            "age": 22,
            "gender": "female",
        }
    }
]

async def verify_p1():
    print("==================================================")
    print("STAGE P1 PERFORMANCE & BASELINE VERIFICATION")
    print("==================================================")

    # 1. Load baseline
    baseline_path = r"C:\gov scheme\scripts\stage_p1_baseline.json"
    assert os.path.exists(baseline_path), f"Baseline file not found at {baseline_path}!"
    with open(baseline_path, "r", encoding="utf-8") as f:
        expected_baseline = json.load(f)

    user_data = r"C:\gov scheme\temp_edge_verify_p1"
    if os.path.exists(user_data):
        shutil.rmtree(user_data, ignore_errors=True)

    proc = subprocess.Popen([
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "--headless=new",
        "--remote-debugging-port=9230",
        f"--user-data-dir={user_data}",
        "http://localhost:8000/?debug=1"
    ])
    await asyncio.sleep(2.0)

    try:
        req = urllib.request.urlopen("http://localhost:9230/json")
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

        assert ws_url, "Could not find websocket URL for Edge page."

        async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
            await ws.send(json.dumps({"id": 1, "method": "Runtime.enable"}))
            await asyncio.sleep(1.0)

            # Test 1: Baseline comparison for all 7 personas
            print("\n[CHECK 1] Validating identical evaluation results against Stage P1 baseline...")
            req_id = 100
            for p in PERSONAS:
                req_id += 1
                facts_json = json.dumps(p["facts"])
                script = f"""
                (function() {{
                    const rules = window.ALL_RULES || [];
                    const facts = {facts_json};
                    const evalResults = window.GovEngine.evaluateAll(rules, facts);
                    return evalResults.map(r => ({{
                        id: r.id,
                        result: r.result,
                        missingFields: r.missingFields ? [...r.missingFields].sort() : []
                    }}));
                }})()
                """
                await ws.send(json.dumps({
                    "id": req_id,
                    "method": "Runtime.evaluate",
                    "params": {"expression": script, "returnByValue": True}
                }))

                while True:
                    msg = await ws.recv()
                    data = json.loads(msg)
                    if data.get("id") == req_id:
                        actual = data["result"]["result"]["value"]
                        expected = expected_baseline[p["id"]]
                        assert len(actual) == len(expected), f"Length mismatch for {p['id']}: {len(actual)} vs {len(expected)}"
                        for i in range(len(actual)):
                            act_r = actual[i]
                            exp_r = expected[i]
                            assert act_r["id"] == exp_r["id"], f"Rule ID mismatch at index {i}: {act_r['id']} vs {exp_r['id']}"
                            assert act_r["result"] == exp_r["result"], f"Result mismatch for {act_r['id']}: {act_r['result']} vs {exp_r['result']}"
                            assert act_r["missingFields"] == exp_r["missingFields"], f"Missing fields mismatch for {act_r['id']}: {act_r['missingFields']} vs {exp_r['missingFields']}"
                        print(f"  [PASS] Persona '{p['id']}' ({p['name']}): 100% identical ({len(actual)} rules).")
                        break

            # Test 2: Prove single answer click triggers EXACTLY ONE evaluateAll call
            print("\n[CHECK 2] Validating exactly ONE evaluateAll call per answer click...")
            single_eval_script = """
            (async function() {
                // Navigate to quick check if not already there
                if (window.location.hash !== '#/quick') {
                    const quickBtn = document.getElementById('btn-landing-quick') || document.getElementById('btn-quick-check');
                    if (quickBtn) {
                        quickBtn.click();
                    } else {
                        window.location.hash = '#/quick';
                    }
                    await new Promise(r => setTimeout(r, 200));
                }
                const countBefore = window.__DEBUG_STATS ? window.__DEBUG_STATS.evalCount : 0;
                
                // Answer a question (e.g. click Yes or save an answer)
                const yesBtn = document.getElementById('choice-yes');
                const optBtn = document.querySelector('.stepper-option-btn');
                const enumSel = document.getElementById('stepper-enum-select');
                const textInp = document.getElementById('stepper-text-input');
                const numInp = document.getElementById('stepper-num-input');
                const saveBtn = document.getElementById('stepper-save-btn');

                if (yesBtn) {
                    yesBtn.click();
                } else if (optBtn) {
                    optBtn.click();
                } else if (enumSel && saveBtn) {
                    enumSel.selectedIndex = 1;
                    saveBtn.click();
                } else if (numInp && saveBtn) {
                    numInp.value = '35';
                    saveBtn.click();
                } else if (textInp && saveBtn) {
                    textInp.value = 'Test';
                    saveBtn.click();
                }

                const countAfter = window.__DEBUG_STATS ? window.__DEBUG_STATS.evalCount : 0;
                return {
                    hash: window.location.hash,
                    quickBtnFound: !!(document.getElementById('btn-landing-quick') || document.getElementById('btn-quick-check')),
                    yesBtnFound: !!document.getElementById('choice-yes'),
                    optBtnFound: !!document.querySelector('.stepper-option-btn'),
                    enumSelFound: !!document.getElementById('stepper-enum-select'),
                    textInpFound: !!document.getElementById('stepper-text-input'),
                    numInpFound: !!document.getElementById('stepper-num-input'),
                    saveBtnFound: !!document.getElementById('stepper-save-btn'),
                    countBefore,
                    countAfter,
                    delta: countAfter - countBefore,
                    lastEvalMs: window.__DEBUG_STATS ? window.__DEBUG_STATS.lastEvalMs : 0,
                    lastRenderMs: window.__DEBUG_STATS ? window.__DEBUG_STATS.lastRenderMs : 0
                };
            })()
            """
            await ws.send(json.dumps({
                "id": 200,
                "method": "Runtime.evaluate",
                "params": {"expression": single_eval_script, "awaitPromise": True, "returnByValue": True}
            }))
            while True:
                msg = await ws.recv()
                data = json.loads(msg)
                if data.get("id") == 200:
                    res = data["result"]["result"]["value"]
                    print(f"  Diagnostics: {res}")
                    print(f"  Evaluation counter before: {res['countBefore']}, after: {res['countAfter']}, delta: {res['delta']}")
                    print(f"  Last eval ms: {res['lastEvalMs']}, Last render ms: {res['lastRenderMs']}")
                    assert res["delta"] == 1, f"Expected delta of 1, got {res['delta']}! evaluateAll called more than once!"
                    print("  [PASS] Answer click triggered EXACTLY 1 evaluateAll call!")
                    break

            # Test 3: Verify search reuse of cached evaluation (delta = 0 evaluateAll calls)
            print("\n[CHECK 3] Validating search input reuses cached evaluation (0 evaluateAll calls)...")
            search_script = """
            (async function() {
                const countBefore = window.__DEBUG_STATS ? window.__DEBUG_STATS.evalCount : 0;
                const searchInp = document.getElementById('search-input');
                searchInp.value = 'kisan';
                searchInp.dispatchEvent(new Event('input', { bubbles: true }));
                // Wait 250ms for debounce
                await new Promise(r => setTimeout(r, 250));
                const countAfter = window.__DEBUG_STATS ? window.__DEBUG_STATS.evalCount : 0;
                const resultsSummary = document.getElementById('results-summary').textContent;
                return {
                    countBefore,
                    countAfter,
                    delta: countAfter - countBefore,
                    resultsSummary
                };
            })()
            """
            await ws.send(json.dumps({
                "id": 300,
                "method": "Runtime.evaluate",
                "params": {"expression": search_script, "awaitPromise": True, "returnByValue": True}
            }))
            while True:
                msg = await ws.recv()
                data = json.loads(msg)
                if data.get("id") == 300:
                    res = data["result"]["result"]["value"]
                    print(f"  Search evaluateAll delta: {res['delta']}, Summary: {res['resultsSummary']}")
                    assert res["delta"] == 0, f"Expected search delta of 0, got {res['delta']}! Search must not call evaluateAll!"
                    print("  [PASS] Search reused cached evaluation without any extra evaluateAll calls!")
                    break

            # Test 4: Show more functionality
            print("\n[CHECK 4] Validating 'Show more' batching (30 cards per page)...")
            show_more_script = """
            (async function() {
                const searchInp = document.getElementById('search-input');
                if (searchInp && searchInp.value) {
                    searchInp.value = '';
                    searchInp.dispatchEvent(new Event('input', { bubbles: true }));
                    await new Promise(r => setTimeout(r, 250));
                }
                // Switch to Unknown tab
                document.getElementById('tab-unknown').click();
                const cardsBefore = document.querySelectorAll('.scheme-row').length;
                const showMoreBtn = document.getElementById('btn-show-more');
                let clicked = false;
                if (showMoreBtn) {
                    showMoreBtn.click();
                    clicked = true;
                }
                const cardsAfter = document.querySelectorAll('.scheme-row').length;
                return {
                    cardsBefore,
                    cardsAfter,
                    clicked,
                    deltaCards: cardsAfter - cardsBefore
                };
            })()
            """
            await ws.send(json.dumps({
                "id": 400,
                "method": "Runtime.evaluate",
                "params": {"expression": show_more_script, "awaitPromise": True, "returnByValue": True}
            }))
            while True:
                msg = await ws.recv()
                data = json.loads(msg)
                if data.get("id") == 400:
                    res = data["result"]["result"]["value"]
                    print(f"  Cards before: {res['cardsBefore']}, after: {res['cardsAfter']}, delta: {res['deltaCards']}")
                    assert res["cardsBefore"] == 30, f"Initial cards batch should be 30, got {res['cardsBefore']}"
                    if res["clicked"]:
                        assert res["cardsAfter"] == 60, f"After show more should be 60, got {res['cardsAfter']}"
                    print("  [PASS] Cards correctly chunked at 30 with Show more loading 30 more!")
                    break

            print("\n==================================================")
            print("ALL STAGE P1 PERFORMANCE CHECKS PASSED PERFECTLY!")
            print("==================================================")

    finally:
        proc.terminate()
        shutil.rmtree(user_data, ignore_errors=True)

if __name__ == "__main__":
    asyncio.run(verify_p1())
