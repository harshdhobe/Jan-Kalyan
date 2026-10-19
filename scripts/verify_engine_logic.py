"""
verify_engine_logic.py
----------------------
A Python port of the JS eval logic to verify correctness of the
criteria trees in the Tier-1 JSONs before Node.js is set up.

Run:  python scripts/verify_engine_logic.py
"""
import json, pathlib

# ── 3-valued eval (mirrors eval.js) ──────────────────────────────────────────

def resolve_path(facts, path):
    obj = facts
    for key in path.split("."):
        if not isinstance(obj, dict): return None
        obj = obj.get(key)
    return obj

def eval_node(node, facts):
    if "field" in node:
        actual = resolve_path(facts, node["field"])
        if actual is None: return "unknown"
        op, val = node["op"], node["value"]
        if op == "==": return actual == val
        if op == "!=": return actual != val
        if op == ">=": return actual >= val
        if op == "<=": return actual <= val
        if op == ">":  return actual >  val
        if op == "<":  return actual <  val
        if op == "in": return actual in val
        raise ValueError(f"Unknown op: {op}")

    if "all" in node:
        has_unknown = False
        for child in node["all"]:
            r = eval_node(child, facts)
            if r is False: return False
            if r == "unknown": has_unknown = True
        return "unknown" if has_unknown else True

    if "any" in node:
        has_unknown = False
        for child in node["any"]:
            r = eval_node(child, facts)
            if r is True: return True
            if r == "unknown": has_unknown = True
        return "unknown" if has_unknown else False

    raise ValueError(f"Bad node: {node}")

def evaluate_all(rules, facts):
    results = []
    for rule in rules:
        r = eval_node(rule["criteria"], facts)
        results.append({
            "id":     rule["id"],
            "name":   rule["name"],
            "result": "eligible" if r is True else ("ineligible" if r is False else "unknown"),
        })
    return results

# ── Load rules ────────────────────────────────────────────────────────────────

TIER1 = pathlib.Path("data/rules/tier1")
rules = [json.loads(f.read_text(encoding="utf-8")) for f in sorted(TIER1.glob("*.json"))]
print(f"Loaded {len(rules)} Tier-1 rules\n")

# ── Test personas ─────────────────────────────────────────────────────────────

PERSONAS = [
    {
        "label": "Rural BPL SC, 70yr male",
        "facts": {
            "age": 70, "gender": "male", "has_bank_account": True,
            "household": {
                "bpl": True, "area_type": "rural", "is_sc_st": True,
                "owns_pucca_house": False, "owns_cultivable_land": False, "has_lpg": False,
            }
        },
        "expect_eligible": ["ab-pmjay", "nsap-ignoaps", "pmjdy"],
        "expect_ineligible": ["apy", "pmjjby"],  # age > 40/50
    },
    {
        "label": "Maharashtra woman, 30yr, married, income=200000",
        "facts": {
            "age": 30, "gender": "female",
            "has_aadhaar_linked_bank_account": True,
            "marital_status": "married",
            "household": {"state": "Maharashtra", "income": 200000, "bpl": False}
        },
        "expect_eligible": ["mmlby"],
        "expect_ineligible": ["ignwps"],  # not widowed
    },
    {
        "label": "Street vendor with certificate",
        "facts": {
            "is_street_vendor": True,
            "vendor_status": "has_certificate_or_id",
            "age": 28, "has_bank_account": True,
        },
        "expect_eligible": ["pm-svanidhi"],
        "expect_ineligible": [],
    },
    {
        "label": "Maharashtra farmer, owns cultivable land",
        "facts": {
            "household": {
                "state": "Maharashtra",
                "owns_cultivable_land": True,
            }
        },
        "expect_eligible": ["namo-shetkari-mahasanman-nidhi-yojana", "pm-kisan"],
        "expect_ineligible": [],
    },
    {
        "label": "Person wanting business loan, not a defaulter",
        "facts": {
            "wants_business_loan": True,
            "is_loan_defaulter": False,
            "age": 32,
        },
        "expect_eligible": ["pmmy"],
        "expect_ineligible": [],
    },
]

all_passed = True
for persona in PERSONAS:
    print(f"--- {persona['label']} ---")
    results = evaluate_all(rules, persona["facts"])
    by_id = {r["id"]: r["result"] for r in results}

    for sid in persona["expect_eligible"]:
        actual = by_id.get(sid, "NOT_FOUND")
        ok = actual == "eligible"
        status = "PASS" if ok else f"FAIL (got {actual})"
        print(f"  {status}  {sid} should be ELIGIBLE")
        if not ok: all_passed = False

    for sid in persona["expect_ineligible"]:
        actual = by_id.get(sid, "NOT_FOUND")
        ok = actual == "ineligible"
        status = "PASS" if ok else f"FAIL (got {actual})"
        print(f"  {status}  {sid} should be INELIGIBLE")
        if not ok: all_passed = False

    print()

print("=" * 50)
print("ALL TESTS PASSED" if all_passed else "SOME TESTS FAILED")
