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

async def record_baseline():
    print("Recording Stage P1 baseline for all 7 personas...")
    user_data = r"C:\gov scheme\temp_edge_baseline"
    if os.path.exists(user_data):
        shutil.rmtree(user_data, ignore_errors=True)

    proc = subprocess.Popen([
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "--headless=new",
        "--remote-debugging-port=9228",
        f"--user-data-dir={user_data}",
        "http://localhost:8000/"
    ])
    await asyncio.sleep(2.0)

    try:
        req = urllib.request.urlopen("http://localhost:9228/json")
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

            baseline = {}
            req_id = 10
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
                        eval_data = data["result"]["result"]["value"]
                        baseline[p["id"]] = eval_data
                        print(f"  [OK] Evaluated persona '{p['id']}' ({p['name']}): {len(eval_data)} rules")
                        break

            out_path = r"C:\gov scheme\scripts\stage_p1_baseline.json"
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(baseline, f, indent=2, sort_keys=True)
            print(f"Successfully recorded Stage P1 baseline for 7 personas to: {out_path}")

    finally:
        proc.terminate()
        shutil.rmtree(user_data, ignore_errors=True)

if __name__ == "__main__":
    asyncio.run(record_baseline())
