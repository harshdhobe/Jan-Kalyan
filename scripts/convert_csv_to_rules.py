"""
convert_csv_to_rules.py
-----------------------
Reads data/schemes.csv and converts every row into a rule JSON
that the eligibility engine can evaluate.

Output: data/rules/tier2/<slug>.json  (one file per scheme)
        data/catalog/tier2_summary.json  (summary stats + field coverage)

Run:
    python scripts/convert_csv_to_rules.py

The script first prints the CSV column names so you can confirm
they match the expected mapping below. Edit COLUMN_MAP if they differ.
"""

import csv
import json
import os
import re
import unicodedata
from pathlib import Path
from collections import defaultdict

# Paths
BASE_DIR   = Path(__file__).parent.parent
CSV_PATH   = BASE_DIR / "data" / "schemes.csv"
TIER2_DIR  = BASE_DIR / "data" / "rules" / "tier2"
CATALOG    = BASE_DIR / "data" / "catalog" / "tier2_summary.json"
TIER2_DIR.mkdir(parents=True, exist_ok=True)

# Column name mapping - edit values if CSV column names differ
COLUMN_MAP = {
    "name":         ["scheme_name", "name", "title"],
    "description":  ["description", "desc"],
    "benefit":      ["benefit", "benefits"],
    "eligibility":  ["eligibility", "eligible", "who_can_apply"],
    "how_to_apply": ["how_to_apply", "how to apply", "application_process"],
    "documents":    ["documents_required", "documents required", "documents"],
    "apply_url":    ["apply_link", "apply_url", "application_link"],
    "source_url":   ["official_url", "myscheme_url", "myscheme_link", "source_url", "official_link"],
    "min_age":      ["minimum_age", "min_age", "age_min"],
    "max_age":      ["maximum_age", "max_age", "age_max"],
    "gender":       ["gender"],
    "caste":        ["caste", "social_category", "category"],
    "max_income":   ["maximum_income", "max_income", "income"],
    "state":        ["state", "state_name"],
    "disability":   ["disability", "disabled", "differently_abled"],
    "bpl":          ["bpl", "below_poverty_line"],
}

# 20 Tier-1 hand-crafted scheme slugs - skip these in Tier-2
TIER1_IDS = {
    "ab-pmjay", "apy", "igndps", "ignwps", "mjpjay", "mmlby",
    "namo-shetkari-mahasanman-nidhi-yojana", "nsap-ignoaps", "pm-kisan",
    "pm-svanidhi", "pm-sym", "pmay-g", "pmay-u", "pmjdy", "pmjjby",
    "pmkmdy", "pmmy", "pmuy", "sbssps", "sgngs",
}

HOUSEHOLD_KEYWORDS = ["family", "household", "farmers", "families"]


def slugify(text):
    text = str(text).strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = re.sub(r"[^\w\s-]", "", text, flags=re.ASCII)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text[:80].strip("-")


def resolve_columns(headers):
    headers_lower = {h.lower().strip(): h for h in headers}
    resolved = {}
    for canonical, candidates in COLUMN_MAP.items():
        found = None
        for candidate in candidates:
            if candidate.lower() in headers_lower:
                found = headers_lower[candidate.lower()]
                break
            for h_low, h_orig in headers_lower.items():
                if candidate.lower() in h_low:
                    found = h_orig
                    break
            if found:
                break
        resolved[canonical] = found
    return resolved


def get_field(row, col_map, key):
    col = col_map.get(key)
    if col and col in row:
        return row[col].strip()
    return ""


def parse_int(val):
    val = val.strip().replace(",", "")
    if not val:
        return None
    try:
        return int(float(val))
    except ValueError:
        return None


def parse_bool_field(val):
    v = val.strip().lower()
    if v in ("yes", "true", "1", "required", "mandatory"):
        return True
    return None


def parse_gender(val):
    v = val.strip().lower()
    if v in ("female", "women", "woman", "girl"):
        return "female"
    if v in ("male", "men", "man", "boy"):
        return "male"
    return None


def parse_caste(val):
    if not val.strip():
        return None
    parts = re.split(r"[,;/|]", val)
    mapping = {
        "sc": "sc", "scheduled caste": "sc",
        "st": "st", "scheduled tribe": "st",
        "obc": "obc", "other backward class": "obc", "other backward classes": "obc",
        "general": "general", "ews": "ews",
    }
    result = []
    for p in parts:
        p = p.strip().lower()
        if p in mapping:
            result.append(mapping[p])
    return result if result else None


def parse_state(val):
    v = val.strip()
    if not v or v.lower() in ("all", "all states", "pan india", "pan-india", "central", ""):
        return None
    return v.title()


def parse_documents(val):
    if not val.strip():
        return []
    parts = re.split(r"[,;]", val)
    return [slugify(p) for p in parts if p.strip()]


def build_criteria(row, col_map):
    conditions = []

    min_age = parse_int(get_field(row, col_map, "min_age"))
    max_age = parse_int(get_field(row, col_map, "max_age"))
    if min_age is not None:
        conditions.append({"field": "age", "op": ">=", "value": min_age})
    if max_age is not None:
        conditions.append({"field": "age", "op": "<=", "value": max_age})

    gender = parse_gender(get_field(row, col_map, "gender"))
    if gender:
        conditions.append({"field": "gender", "op": "==", "value": gender})

    castes = parse_caste(get_field(row, col_map, "caste"))
    if castes:
        conditions.append({"field": "caste", "op": "in", "value": castes})

    max_income = parse_int(get_field(row, col_map, "max_income"))
    if max_income is not None:
        conditions.append({"field": "household.income", "op": "<=", "value": max_income})

    state = parse_state(get_field(row, col_map, "state"))
    if state:
        conditions.append({"field": "household.state", "op": "==", "value": state})

    if parse_bool_field(get_field(row, col_map, "disability")) is True:
        conditions.append({"field": "has_disability", "op": "==", "value": True})

    if parse_bool_field(get_field(row, col_map, "bpl")) is True:
        conditions.append({"field": "household.bpl", "op": "==", "value": True})

    return {"all": conditions}


def infer_scope(row, col_map):
    text = (get_field(row, col_map, "eligibility") + " " + get_field(row, col_map, "description")).lower()
    for kw in HOUSEHOLD_KEYWORDS:
        if kw in text:
            return "household"
    return "person"


def row_to_rule(row, col_map):
    name = get_field(row, col_map, "name")
    if not name:
        return None

    scheme_id = slugify(name)

    if scheme_id in TIER1_IDS:
        return None

    state    = parse_state(get_field(row, col_map, "state"))
    level    = "state" if state else "central"
    scope    = infer_scope(row, col_map)
    criteria = build_criteria(row, col_map)

    return {
        "id":                scheme_id,
        "name":              name,
        "tier":              2,
        "level":             level,
        "state":             state,
        "scope":             scope,
        "benefit":           get_field(row, col_map, "benefit")[:400],
        "criteria":          criteria,
        "documents":         parse_documents(get_field(row, col_map, "documents")),
        "apply_url":         get_field(row, col_map, "apply_url"),
        "source_url":        get_field(row, col_map, "source_url"),
        "last_verified":     "2025-07-05",
        "_eligibility_text": get_field(row, col_map, "eligibility"),
        "_criteria_filled":  len(criteria.get("all", [])),
    }


def main():
    if not CSV_PATH.exists():
        print(f"[ERROR] CSV not found at: {CSV_PATH}")
        print("  Place your schemes.csv at  data/schemes.csv  and re-run.")
        return

    print(f"Reading: {CSV_PATH}")
    stats = defaultdict(int)
    field_coverage = defaultdict(int)
    written = []
    skipped_tier1 = []
    sparse_rows = []

    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []

        print("\n── CSV Columns Detected ──────────────────────────────────────")
        for i, h in enumerate(headers, 1):
            print(f"  {i:2}. {h}")

        col_map = resolve_columns(headers)

        print("\n── Column Mapping Resolved ───────────────────────────────────")
        for canonical, actual in col_map.items():
            status = actual if actual else "NOT FOUND"
            print(f"  {canonical:20} -> {status}")
        print()

        for row in reader:
            stats["total"] += 1
            rule = row_to_rule(row, col_map)

            if rule is None:
                name = get_field(row, col_map, "name")
                if not name:
                    stats["skipped_no_name"] += 1
                else:
                    skipped_tier1.append(name)
                    stats["skipped_tier1"] += 1
                continue

            for cond in rule["criteria"].get("all", []):
                field_coverage[cond["field"]] += 1

            if rule["_criteria_filled"] == 0:
                sparse_rows.append({"id": rule["id"], "name": rule["name"]})
                stats["sparse"] += 1

            out_path = TIER2_DIR / f"{rule['id']}.json"
            with open(out_path, "w", encoding="utf-8") as out:
                json.dump(rule, out, ensure_ascii=False, indent=2)

            written.append(rule["id"])
            stats["written"] += 1

    print("── Conversion Complete ───────────────────────────────────────────")
    print(f"  Total rows       : {stats['total']}")
    print(f"  Written (Tier 2) : {stats['written']}")
    print(f"  Skipped (Tier 1) : {stats['skipped_tier1']}")
    print(f"  Skipped (no name): {stats['skipped_no_name']}")
    print(f"  Sparse rows (0 structured criteria): {stats['sparse']}")

    print("\n── Criteria field coverage ───────────────────────────────────────")
    for field, count in sorted(field_coverage.items(), key=lambda x: -x[1]):
        print(f"  {field:40} : {count}")

    summary = {
        "generated_at": "2025-07-05",
        "total_tier2_schemes": stats["written"],
        "sparse_schemes_count": stats["sparse"],
        "field_coverage": dict(sorted(field_coverage.items(), key=lambda x: -x[1])),
        "sparse_schemes_sample": sparse_rows[:50],
        "skipped_tier1": skipped_tier1,
    }
    with open(CATALOG, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"\nCatalog saved  -> {CATALOG}")
    print(f"Rules saved    -> {TIER2_DIR}  ({stats['written']} files)")


if __name__ == "__main__":
    main()

