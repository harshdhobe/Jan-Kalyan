"""
golden_personas.py
------------------
Step 4: Golden Persona Verification Test Suite.
Tests the eligibility engine against realistic personas covering all 20 Tier-1 schemes,
edge cases, negative cases, partial evaluation (3-valued logic), document checklists,
and next-question heuristics.

Run with:
    python packages/engine/tests/golden_personas.py
"""

import json
import sys
from pathlib import Path

# Fix Windows console encoding for terminal output
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ─────────────────────────────────────────────────────────────────────────────
# 1. 3-Valued Logic Engine (exact mirror of eval.js & engine.js)
# ─────────────────────────────────────────────────────────────────────────────

def resolve_path(facts, path):
    obj = facts
    for key in path.split("."):
        if not isinstance(obj, dict):
            return None
        obj = obj.get(key)
    return obj

def eval_node(node, facts):
    if "field" in node:
        actual = resolve_path(facts, node["field"])
        if actual is None:
            return "unknown"
        op = node["op"]
        val = node["value"]
        if op == "==": return actual == val
        if op == "!=": return actual != val
        if op == ">=": return actual >= val
        if op == "<=": return actual <= val
        if op == ">":  return actual > val
        if op == "<":  return actual < val
        if op == "in":
            if not isinstance(val, (list, tuple, set)):
                return False
            return actual in val
        raise ValueError(f"Unknown operator: {op}")

    if "all" in node:
        has_unknown = False
        for child in node["all"]:
            r = eval_node(child, facts)
            if r is False:
                return False
            if r == "unknown":
                has_unknown = True
        return "unknown" if has_unknown else True

    if "any" in node:
        has_unknown = False
        for child in node["any"]:
            r = eval_node(child, facts)
            if r is True:
                return True
            if r == "unknown":
                has_unknown = True
        return "unknown" if has_unknown else False

    raise ValueError(f"Invalid criterion node: {node}")

def collect_missing_fields(node, facts):
    missing = set()

    def _walk(n):
        if "field" in n:
            if resolve_path(facts, n["field"]) is None:
                missing.add(n["field"])
            return
        if "any" in n:
            for child in n["any"]:
                if eval_node(child, facts) is True:
                    return  # already satisfied
                _walk(child)
            return
        if "all" in n:
            for child in n["all"]:
                _walk(child)
            return

    _walk(node)
    return sorted(list(missing))

def evaluate_scheme(rule, facts):
    res = eval_node(rule["criteria"], facts)
    status = "eligible" if res is True else ("ineligible" if res is False else "unknown")
    missing = collect_missing_fields(rule["criteria"], facts) if status == "unknown" else []
    return {
        "id": rule["id"],
        "name": rule["name"],
        "result": status,
        "missingFields": missing,
        "documents": rule.get("documents", []) if status == "eligible" else [],
        "links": rule.get("links", {})
    }

def evaluate_all(rules, facts):
    return [evaluate_scheme(r, facts) for r in rules]

def next_question(rules, facts):
    results = evaluate_all(rules, facts)
    counts = {}
    for r in results:
        if r["result"] != "unknown":
            continue
        for field in r["missingFields"]:
            counts[field] = counts.get(field, 0) + 1
    if not counts:
        return None
    # Sort by frequency descending, then name
    sorted_fields = sorted(counts.items(), key=lambda x: (-x[1], x[0]))
    return {"field": sorted_fields[0][0], "schemeCount": sorted_fields[0][1]}

# ─────────────────────────────────────────────────────────────────────────────
# 2. Golden Personas Test Data
# ─────────────────────────────────────────────────────────────────────────────

GOLDEN_PERSONAS = [
    {
        "id": "persona_1",
        "name": "Ramcharan (70M, Rural BPL SC Elder, UP)",
        "description": "Elderly Dalit man living in rural UP in a single-room kutcha home with no land and no LPG.",
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
        },
        "expect_eligible": [
            "ab-pmjay",       # Rural BPL SC single-room kutcha
            "nsap-ignoaps",   # Age 70 >= 60, BPL
            "pmjdy",          # Age 70 >= 10
            "pmay-g",         # Rural, no pucca house, kutcha <= 2 rooms
        ],
        "expect_ineligible": [
            "apy",            # Exceeded age 40 limit (70)
            "pmjjby",         # Exceeded age 50 limit (70)
            "pm-sym",         # Exceeded age 40 limit (70)
            "pmkmdy",         # Exceeded age 40 limit (70)
            "mmlby",          # Male (only female) & not in Maharashtra
            "ignwps",         # Male (only female widow)
            "pmuy",           # Male (must be female head)
            "sbssps",         # Uttar Pradesh != Maharashtra
            "sgngs",          # Uttar Pradesh != Maharashtra
        ],
        "expect_documents": {
            "nsap-ignoaps": ["aadhaar_card", "age_proof", "bank_passbook", "ration_card"],
        }
    },
    {
        "id": "persona_2",
        "name": "Sunita (52F, Rural Maharashtra BPL Widow)",
        "description": "52-year-old destitute widow in rural Maharashtra, yellow ration card, no LPG, looking for support.",
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
        },
        "expect_eligible": [
            "ignwps",         # Widow age 40-79, BPL
            "mmlby",          # MH woman age 21-65, widowed, income <= 250k
            "mjpjay",         # MH state, yellow ration card
            "pmuy",           # Adult female, no LPG, BPL
            "sgngs",          # MH destitute widow, income <= 21k
            "pmjdy",          # Age 52 >= 10
            "ab-pmjay",       # Rural kutcha 1-room
            "pmay-g",         # Rural kutcha <= 2 rooms, no pucca house
        ],
        "expect_ineligible": [
            "nsap-ignoaps",   # Age 52 < 60
            "sbssps",         # Age 52 < 65
            "apy",            # Age 52 > 40
            "pmjjby",         # Age 52 > 50
            "pmkmdy",         # Age 52 > 40
            "pm-sym",         # Age 52 > 40
        ],
        "expect_documents": {
            "ignwps": ["husband_death_certificate", "bpl_card", "age_proof"],
            "mmlby": ["aadhaar_card", "domicile_certificate", "income_certificate", "bank_passbook"],
        }
    },
    {
        "id": "persona_3",
        "name": "Ramesh (28M, Urban Street Vendor & Informal Worker, Delhi)",
        "description": "28-year-old fruit vendor in Delhi holding municipal vending ID, seeking micro-credit and pension.",
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
        },
        "expect_eligible": [
            "pm-svanidhi",    # Registered street vendor
            "pmmy",           # Wants business loan, not defaulter
            "pm-sym",         # Age 28 unorganised worker, income <= 15000, bank+mobile
            "apy",            # Age 28 (18-40), bank account
            "pmjjby",         # Age 28 (18-50), bank account
            "pmjdy",          # Age 28 >= 10
            "pmay-u",         # Urban, income 144k <= 18L, no pucca house
            "ab-pmjay",       # Urban listed occupational worker
        ],
        "expect_ineligible": [
            "ignwps",         # Male, not widow
            "mmlby",          # Male, not MH
            "pmuy",           # Male, household already has LPG
            "pmay-g",         # Urban != rural
            "nsap-ignoaps",   # Age 28 < 60
            "sbssps",         # Age 28 < 65, not MH
        ],
        "expect_documents": {
            "pm-svanidhi": ["certificate_of_vending_or_id", "aadhaar_card"],
            "pm-sym": ["aadhaar_card", "bank_passbook", "mobile_number", "self_certification"],
        }
    },
    {
        "id": "persona_4",
        "name": "Ganesh (36M, Smallholder Farmer, Maharashtra)",
        "description": "36-year-old small farmer in Maharashtra owning 1.5 hectares of farmland registered in Aug 2019.",
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
        },
        "expect_eligible": [
            "pm-kisan",                            # Owns cultivable land
            "namo-shetkari-mahasanman-nidhi-yojana", # MH state + cultivable land
            "pmkmdy",                              # Age 36, land <= 2ha in own name registered 2019
            "mjpjay",                              # MH state + orange ration card
            "apy",                                 # Age 36 (18-40), bank account
            "pmjjby",                              # Age 36 (18-50), bank account
            "pmjdy",                               # Age 36 >= 10
        ],
        "expect_ineligible": [
            "pmay-g",         # Owns pucca house (fails owns_pucca_house == False)
            "pmay-u",         # Rural != urban
            "mmlby",          # Male
            "pmuy",           # Male, already has LPG
            "ignwps",         # Male, not widow
            "nsap-ignoaps",   # Age 36 < 60
            "sbssps",         # Age 36 < 65
        ],
        "expect_documents": {
            "pm-kisan": ["aadhaar_card", "land_records", "bank_account"],
            "namo-shetkari-mahasanman-nidhi-yojana": ["aadhaar_card", "land_record_7_12", "land_record_8a", "ration_card"],
        }
    },
    {
        "id": "persona_5",
        "name": "Pooja (32F, Urban Salaried Middle-Class, Maharashtra)",
        "description": "32-year-old married urban woman in Pune earning 12 LPA, owns no home, applying for urban housing.",
        "facts": {
            "age": 32,
            "gender": "female",
            "marital_status": "married",
            "has_bank_account": True,
            "has_aadhaar_linked_bank_account": True,
            "household": {
                "state": "Maharashtra",
                "area_type": "urban",
                "income": 1200000,   # 12 Lakhs/year
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
        },
        "expect_eligible": [
            "pmay-u",         # Urban, income 12L <= 18L, no pucca house, not used before
            "mjpjay",         # MH state, white ration card / domicile
            "apy",            # Age 32 (18-40), bank account
            "pmjjby",         # Age 32 (18-50), bank account
            "pmjdy",          # Age 32 >= 10
        ],
        "expect_ineligible": [
            "mmlby",          # Income 12L > 2.5L limit
            "pmay-g",         # Urban != rural
            "pmuy",           # Has LPG, income not poor/BPL
            "ab-pmjay",       # Urban non-listed worker, non-vulnerable
            "ignwps",         # Married != widowed
            "nsap-ignoaps",   # Age 32 < 60
            "sbssps",         # Age 32 < 65
        ],
        "expect_documents": {
            "pmay-u": ["aadhaar_card", "income_proof", "identity_residence_proof"],
        }
    },
    {
        "id": "persona_6",
        "name": "Vikas (24M, Young Severe Disability Candidate, Bihar)",
        "description": "24-year-old youth with 85% locational disability in a rural BPL household in Bihar.",
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
        },
        "expect_eligible": [
            "igndps",         # Age 24 >= 18, disability 85% >= 80%, BPL
            "ab-pmjay",       # Rural with disabled member and no able adult
            "pmay-g",         # Rural, no pucca house, kutcha <= 2 rooms
            "pmjdy",          # Age 24 >= 10
            "pmjjby",         # Age 24 (18-50), bank account
            "apy",            # Age 24 (18-40), bank account
        ],
        "expect_ineligible": [
            "ignwps",         # Male, not widow
            "mmlby",          # Male, Bihar != MH
            "pmuy",           # Male, has LPG
            "sbssps",         # Age 24 < 65, Bihar != MH
            "sgngs",          # Bihar != MH
            "nsap-ignoaps",   # Age 24 < 60
        ],
        "expect_documents": {
            "igndps": ["disability_certificate", "bpl_card", "aadhaar_card", "age_proof"],
        }
    },
    {
        "id": "persona_7",
        "name": "Priya (22F, Partial Profile / 3-Valued Logic Short-Circuit)",
        "description": "22-year-old female who only answered age and gender. Verifies 3-valued logic, short-circuiting, and question heuristic.",
        "facts": {
            "age": 22,
            "gender": "female",
        },
        "expect_eligible": [
            "pmjdy",          # Age 22 >= 10 (satisfied with just age!)
        ],
        "expect_ineligible": [
            "nsap-ignoaps",   # Age 22 < 60 (definitively false despite BPL unknown!)
            "sbssps",         # Age 22 < 65 (definitively false despite state/income unknown!)
            "ignwps",         # Age 22 < 40 (definitively false despite widow/bpl unknown!)
        ],
        "expect_unknown": [
            "apy",            # Needs has_bank_account
            "pmjjby",         # Needs has_bank_account
            "pm-sym",         # Age 22 is in [18,40], needs unorganised, income, bank, mobile
            "mmlby",          # Age 22 is in [21,65], needs state, income, bank account, marital status
            "pmuy",           # Needs has_lpg, household.bpl
        ],
    }
]

# ─────────────────────────────────────────────────────────────────────────────
# 3. Test Runner
# ─────────────────────────────────────────────────────────────────────────────

def run_tests():
    repo_root = Path(__file__).resolve().parents[3]
    tier1_dir = repo_root / "data" / "rules" / "tier1"

    rule_files = sorted(tier1_dir.glob("*.json"))
    if not rule_files:
        print(f"ERROR: No Tier-1 rules found in {tier1_dir}")
        return False

    rules = [json.loads(f.read_text(encoding="utf-8")) for f in rule_files]
    print(f"Loaded {len(rules)} Tier-1 rules from {tier1_dir}\n")

    total_assertions = 0
    passed_assertions = 0
    failed_assertions = []

    print("=" * 70)
    print("STEP 4: GOLDEN PERSONA VERIFICATION TEST SUITE")
    print("=" * 70)

    for p in GOLDEN_PERSONAS:
        print(f"\n>> [{p['id'].upper()}] {p['name']}")
        print(f"   {p['description']}")
        print(f"   Facts: {json.dumps(p['facts'], separators=(',', ':'))}")

        results = evaluate_all(rules, p["facts"])
        by_id = {r["id"]: r for r in results}

        # 1. Assertions: Expect Eligible
        for sid in p.get("expect_eligible", []):
            total_assertions += 1
            r = by_id.get(sid)
            actual = r["result"] if r else "NOT_FOUND"
            if actual == "eligible":
                passed_assertions += 1
                print(f"   [PASS] Eligible: {sid}")
            else:
                err = f"{p['id']}: Expected '{sid}' to be ELIGIBLE, got '{actual}'"
                failed_assertions.append(err)
                print(f"   [FAIL] Eligible: {sid} (got {actual})")

        # 2. Assertions: Expect Ineligible
        for sid in p.get("expect_ineligible", []):
            total_assertions += 1
            r = by_id.get(sid)
            actual = r["result"] if r else "NOT_FOUND"
            if actual == "ineligible":
                passed_assertions += 1
                print(f"   [PASS] Ineligible: {sid}")
            else:
                err = f"{p['id']}: Expected '{sid}' to be INELIGIBLE, got '{actual}'"
                failed_assertions.append(err)
                print(f"   [FAIL] Ineligible: {sid} (got {actual})")

        # 3. Assertions: Expect Unknown
        for sid in p.get("expect_unknown", []):
            total_assertions += 1
            r = by_id.get(sid)
            actual = r["result"] if r else "NOT_FOUND"
            if actual == "unknown":
                passed_assertions += 1
                print(f"   [PASS] Unknown: {sid} (missing: {', '.join(r.get('missingFields', []))})")
            else:
                err = f"{p['id']}: Expected '{sid}' to be UNKNOWN, got '{actual}'"
                failed_assertions.append(err)
                print(f"   [FAIL] Unknown: {sid} (got {actual})")

        # 4. Assertions: Document Checklists
        for sid, expected_docs in p.get("expect_documents", {}).items():
            r = by_id.get(sid)
            actual_docs = r.get("documents", []) if r else []
            for doc in expected_docs:
                total_assertions += 1
                if doc in actual_docs:
                    passed_assertions += 1
                    print(f"   [PASS] Document checklist: {sid} has '{doc}'")
                else:
                    err = f"{p['id']}: Scheme '{sid}' missing expected document '{doc}'"
                    failed_assertions.append(err)
                    print(f"   [FAIL] Document checklist: {sid} missing '{doc}' (has: {actual_docs})")

        # 5. Check Next Question Heuristic on partial profiles
        if p.get("expect_unknown"):
            nq = next_question(rules, p["facts"])
            total_assertions += 1
            if nq is not None and nq["schemeCount"] > 0:
                passed_assertions += 1
                print(f"   [PASS] Next Question recommended: '{nq['field']}' (resolves {nq['schemeCount']} unknown schemes)")
            else:
                err = f"{p['id']}: next_question() failed to return a recommended field"
                failed_assertions.append(err)
                print(f"   [FAIL] Next Question: expected a field recommendation")

    print("\n" + "=" * 70)
    print(f"SUMMARY: {passed_assertions} / {total_assertions} assertions passed.")
    if failed_assertions:
        print(f"FAILED ({len(failed_assertions)} errors):")
        for f in failed_assertions:
            print(f"  - {f}")
        return False
    else:
        print("ALL GOLDEN PERSONA TESTS PASSED SUCCESSFULLY!")
        return True

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
