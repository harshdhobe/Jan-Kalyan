"""
generate_tier1_rules.py
-----------------------
Writes all 20 Tier-1 hand-crafted scheme rule JSONs to data/rules/tier1/
Run:  python scripts/generate_tier1_rules.py
"""
import json
from pathlib import Path

OUT = Path(__file__).parent.parent / "data" / "rules" / "tier1"
OUT.mkdir(parents=True, exist_ok=True)

SCHEMES = [

# ── 1. Ayushman Bharat PM-JAY ────────────────────────────────────────────────
{
  "id": "ab-pmjay",
  "name": "Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana",
  "tier": 1, "level": "central", "state": None, "scope": "household",
  "benefit": "Health cover of Rs 5 lakh per family per year for secondary and tertiary care hospitalisation.",
  "criteria": {"any": [
    {"all": [
      {"field": "household.area_type", "op": "==", "value": "rural"},
      {"any": [
        {"all": [{"field": "household.house_type", "op": "==", "value": "kutcha"},
                 {"field": "household.rooms",      "op": "<=", "value": 1}]},
        {"field": "household.no_adult_16_59",             "op": "==", "value": True},
        {"field": "household.no_adult_male_16_59",        "op": "==", "value": True},
        {"field": "household.disabled_member_no_able_adult","op": "==", "value": True},
        {"field": "household.is_sc_st",                   "op": "==", "value": True},
        {"field": "household.landless_manual_labour",     "op": "==", "value": True}
      ]}
    ]},
    {"field": "household.special_vulnerable_group", "op": "==", "value": True},
    {"all": [
      {"field": "household.area_type",             "op": "==", "value": "urban"},
      {"field": "household.has_listed_urban_worker","op": "==", "value": True}
    ]}
  ]},
  "documents": ["aadhaar_card", "age_identity_proof", "address_proof",
                "caste_certificate", "income_certificate"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/ab-pmjay",
    "apply": "https://www.pmjay.gov.in/about/pmjay"
  },
  "notes": "Simplified from SECC criteria. A match means 'likely eligible', not confirmed."
},

# ── 2. Atal Pension Yojana ────────────────────────────────────────────────────
{
  "id": "apy",
  "name": "Atal Pension Yojana",
  "tier": 1, "level": "central", "state": None, "scope": "person",
  "benefit": "Guaranteed pension of Rs 1000-5000/month after age 60.",
  "criteria": {"all": [
    {"field": "age",             "op": ">=", "value": 18},
    {"field": "age",             "op": "<=", "value": 40},
    {"field": "has_bank_account","op": "==", "value": True}
  ]},
  "documents": ["bank_or_post_office_savings_account"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/apy",
    "apply": "https://jansuraksha.gov.in/Files/APY/ENGLISH/APY.pdf"
  },
  "notes": "Age 18-40 with auto-debit bank account. Check official page for exclusions."
},

# ── 3. Indira Gandhi National Disability Pension Scheme ───────────────────────
{
  "id": "igndps",
  "name": "Indira Gandhi National Disability Pension Scheme",
  "tier": 1, "level": "central", "state": None, "scope": "person",
  "benefit": "Monthly pension of Rs 300 (18-79 years) or Rs 500 (80+) for severely disabled BPL persons.",
  "criteria": {"all": [
    {"field": "age",               "op": ">=", "value": 18},
    {"field": "has_disability",    "op": "==", "value": True},
    {"field": "disability_percent","op": ">=", "value": 80},
    {"field": "household.bpl",     "op": "==", "value": True}
  ]},
  "documents": ["bpl_card", "aadhaar_card", "age_proof", "disability_certificate"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/igndps",
    "apply": "https://nsap.dord.gov.in/Guidelines/dps.pdf"
  },
  "notes": "Dataset conflict: 'more than 80%' vs '80% and more'. Using >= 80. Verify on official page."
},

# ── 4. Indira Gandhi National Widow Pension Scheme ────────────────────────────
{
  "id": "ignwps",
  "name": "Indira Gandhi National Widow Pension Scheme",
  "tier": 1, "level": "central", "state": None, "scope": "person",
  "benefit": "Monthly pension of Rs 300 for widows aged 40-79 below poverty line.",
  "criteria": {"all": [
    {"field": "gender",         "op": "==", "value": "female"},
    {"field": "marital_status", "op": "==", "value": "widowed"},
    {"field": "age",            "op": ">=", "value": 40},
    {"field": "age",            "op": "<=", "value": 79},
    {"field": "household.bpl",  "op": "==", "value": True}
  ]},
  "documents": ["husband_death_certificate", "bpl_card", "age_proof"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/ignwps",
    "apply": "https://nsap.dord.gov.in/Guidelines/wps.pdf"
  },
  "notes": ""
},

# ── 5. Mahatma Jyotirao Phule Jan Arogya Yojana (Maharashtra) ────────────────
{
  "id": "mjpjay",
  "name": "Mahatma Jyotirao Phule Jan Arogya Yojana",
  "tier": 1, "level": "state", "state": "Maharashtra", "scope": "household",
  "benefit": "Cashless hospitalisation up to Rs 1.5 lakh per year for Maharashtra residents.",
  "criteria": {"all": [
    {"field": "household.state", "op": "==", "value": "Maharashtra"},
    {"any": [
      {"field": "household.ration_card_type", "op": "in",
       "value": ["yellow", "aay", "annapurna", "orange", "white"]},
      {"field": "household.has_domicile_certificate", "op": "==", "value": True}
    ]}
  ]},
  "documents": ["aadhaar_card_or_photo_id", "ration_card_or_domicile"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/mjpjay",
    "apply": "https://www.jeevandayee.gov.in/"
  },
  "notes": "Only Categories A & B modelled. Categories C-E (ashram students, journalists, accident victims, border villages) are excluded."
},

# ── 6. Mukhyamantri Majhi Ladki Bahin Yojana (Maharashtra) ───────────────────
{
  "id": "mmlby",
  "name": "Mukhyamantri - Majhi Ladki Bahin Yojana",
  "tier": 1, "level": "state", "state": "Maharashtra", "scope": "person",
  "benefit": "Monthly financial assistance of Rs 1500 to eligible women in Maharashtra.",
  "criteria": {"all": [
    {"field": "gender",           "op": "==", "value": "female"},
    {"field": "household.state",  "op": "==", "value": "Maharashtra"},
    {"field": "age",              "op": ">=", "value": 21},
    {"field": "age",              "op": "<=", "value": 65},
    {"field": "has_aadhaar_linked_bank_account", "op": "==", "value": True},
    {"field": "household.income", "op": "<=", "value": 250000},
    {"any": [
      {"field": "marital_status", "op": "in",
       "value": ["married", "widowed", "divorced", "abandoned"]},
      {"all": [
        {"field": "marital_status",               "op": "==", "value": "unmarried"},
        {"field": "is_only_unmarried_woman_in_family","op": "==", "value": True}
      ]}
    ]}
  ]},
  "documents": ["photo", "aadhaar_card", "domicile_certificate",
                "income_certificate", "bank_passbook"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/mmlby",
    "apply": "https://ladlibahinstorage.s3.ap-south-1.amazonaws.com/site-pdf/Guideline.pdf"
  },
  "notes": "Scraped July 2026 - scheme rules may have changed. Verify on official page."
},

# ── 7. Namo Shetkari Mahasanman Nidhi Yojana (Maharashtra) ───────────────────
{
  "id": "namo-shetkari-mahasanman-nidhi-yojana",
  "name": "Namo Shetkari Mahasanman Nidhi Yojana",
  "tier": 1, "level": "state", "state": "Maharashtra", "scope": "household",
  "benefit": "Rs 6000/year supplementary to PM-KISAN for Maharashtra farmers.",
  "criteria": {"all": [
    {"field": "household.state",              "op": "==", "value": "Maharashtra"},
    {"field": "household.owns_cultivable_land","op": "==", "value": True}
  ]},
  "documents": ["aadhaar_card", "land_record_7_12", "land_record_8a", "ration_card"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/namo-shetkari-mahasanman-nidhi-yojana",
    "apply": "https://fw.pmkisan.gov.in/Documents/RevisedPM-KISANOperationalGuidelines(English).pdf"
  },
  "notes": "Linked to PM-KISAN eligibility (land held on 01.02.2019)."
},

# ── 8. NSAP - Indira Gandhi National Old Age Pension Scheme ──────────────────
{
  "id": "nsap-ignoaps",
  "name": "NSAP - Indira Gandhi National Old Age Pension Scheme",
  "tier": 1, "level": "central", "state": None, "scope": "person",
  "benefit": "Monthly pension of Rs 200 (60-79 years) or Rs 500 (80+ years) for BPL elderly.",
  "criteria": {"all": [
    {"field": "age",          "op": ">=", "value": 60},
    {"field": "household.bpl","op": "==", "value": True}
  ]},
  "documents": ["photo", "domicile_certificate", "address_proof", "age_proof",
                "aadhaar_card", "bank_passbook", "ration_card",
                "no_other_pension_affidavit"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/nsap-ignoaps",
    "apply": "https://nsap.dord.gov.in/"
  },
  "notes": "Indian citizenship assumed."
},

# ── 9. Pradhan Mantri Kisan Samman Nidhi (PM-KISAN) ─────────────────────────
{
  "id": "pm-kisan",
  "name": "Pradhan Mantri Kisan Samman Nidhi",
  "tier": 1, "level": "central", "state": None, "scope": "household",
  "benefit": "Rs 6000 per year (in 3 instalments) to landholding farmer families.",
  "criteria": {"all": [
    {"field": "household.owns_cultivable_land", "op": "==", "value": True}
  ]},
  "documents": ["aadhaar_card", "land_records", "bank_account"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/pm-kisan",
    "apply": "https://pmkisan.gov.in/"
  },
  "notes": "Exclusion categories (govt employees, taxpayers, etc.) not in dataset text - verify on official page."
},

# ── 10. PM SVANidhi ──────────────────────────────────────────────────────────
{
  "id": "pm-svanidhi",
  "name": "PM Street Vendor's AtmaNirbhar Nidhi",
  "tier": 1, "level": "central", "state": None, "scope": "person",
  "benefit": "Working capital loan starting at Rs 10,000 for street vendors.",
  "criteria": {"all": [
    {"field": "is_street_vendor","op": "==", "value": True},
    {"field": "vendor_status",  "op": "in",
     "value": ["has_certificate_or_id", "identified_in_survey", "has_lor"]}
  ]},
  "documents": ["certificate_of_vending_or_id", "letter_of_recommendation", "aadhaar_card"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/pm-svanidhi",
    "apply": "https://www.pmsvanidhi.mohua.gov.in/"
  },
  "notes": "Vendors without cert/ID/LoR should be advised to request a Letter of Recommendation from their ULB."
},

# ── 11. Pradhan Mantri Shram Yogi Maan-dhan ──────────────────────────────────
{
  "id": "pm-sym",
  "name": "Pradhan Mantri Shram Yogi Maan-dhan",
  "tier": 1, "level": "central", "state": None, "scope": "person",
  "benefit": "Monthly pension of Rs 3000 after age 60 for unorganised sector workers.",
  "criteria": {"all": [
    {"field": "age",                 "op": ">=", "value": 18},
    {"field": "age",                 "op": "<=", "value": 40},
    {"field": "is_unorganised_worker","op": "==", "value": True},
    {"field": "monthly_income",      "op": "<=", "value": 15000},
    {"field": "has_bank_account",    "op": "==", "value": True},
    {"field": "has_mobile",          "op": "==", "value": True}
  ]},
  "documents": ["aadhaar_card", "bank_passbook", "mobile_number", "self_certification"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/pm-sym",
    "apply": "https://maandhan.in/"
  },
  "notes": "Official page may exclude people already in other pension/insurance schemes or taxpayers."
},

# ── 12. Pradhan Mantri Awaas Yojana - Gramin ─────────────────────────────────
{
  "id": "pmay-g",
  "name": "Pradhan Mantri Awaas Yojana - Gramin",
  "tier": 1, "level": "central", "state": None, "scope": "household",
  "benefit": "Financial assistance to construct a pucca house for rural homeless/kutcha-house families.",
  "criteria": {"all": [
    {"field": "household.area_type",       "op": "==", "value": "rural"},
    {"field": "household.owns_pucca_house","op": "==", "value": False},
    {"any": [
      {"field": "household.house_type",              "op": "==", "value": "none"},
      {"field": "household.special_vulnerable_group","op": "==", "value": True},
      {"all": [
        {"field": "household.house_type","op": "==", "value": "kutcha"},
        {"field": "household.rooms",     "op": "<=", "value": 2}
      ]}
    ]}
  ]},
  "documents": ["aadhaar_card", "mgnrega_job_card", "bank_account",
                "sbm_number", "no_pucca_house_affidavit"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/pmay-g",
    "apply": "https://pmayg.dord.gov.in/"
  },
  "notes": "Selection from government priority list. Match means 'likely eligible', not confirmed."
},

# ── 13. Pradhan Mantri Awas Yojana - Urban ───────────────────────────────────
{
  "id": "pmay-u",
  "name": "Pradhan Mantri Awas Yojana - Urban",
  "tier": 1, "level": "central", "state": None, "scope": "household",
  "benefit": "Subsidy on home loan / direct benefit transfer for urban first-time house buyers.",
  "criteria": {"all": [
    {"field": "household.area_type",             "op": "==", "value": "urban"},
    {"field": "household.income",                "op": "<=", "value": 1800000},
    {"field": "household.owns_pucca_house",      "op": "==", "value": False},
    {"field": "household.used_housing_scheme_before","op": "==", "value": False}
  ]},
  "documents": ["aadhaar_card", "income_proof", "identity_residence_proof",
                "ewslig_certificate"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/pmay-u",
    "apply": "https://pmay-urban.gov.in/"
  },
  "notes": "Income bands (EWS/LIG/MIG) determine benefit level. Town must be covered under the scheme."
},

# ── 14. Pradhan Mantri Jan Dhan Yojana ───────────────────────────────────────
{
  "id": "pmjdy",
  "name": "Pradhan Mantri Jan Dhan Yojana",
  "tier": 1, "level": "central", "state": None, "scope": "person",
  "benefit": "Zero-balance bank account with RuPay debit card, overdraft facility, and insurance cover.",
  "criteria": {"all": [
    {"field": "age", "op": ">=", "value": 10}
  ]},
  "documents": ["aadhaar_card", "govt_id", "address_proof", "photo",
                "account_opening_form"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/pmjdy",
    "apply": "https://pmjdy.gov.in/"
  },
  "notes": "Open decision: should we filter to people without a bank account? Minors 10+ need guardian."
},

# ── 15. Pradhan Mantri Jeevan Jyoti Bima Yojana ──────────────────────────────
{
  "id": "pmjjby",
  "name": "Pradhan Mantri Jeevan Jyoti Bima Yojana",
  "tier": 1, "level": "central", "state": None, "scope": "person",
  "benefit": "Life insurance cover of Rs 2 lakh at an annual premium of Rs 436.",
  "criteria": {"all": [
    {"field": "age",             "op": ">=", "value": 18},
    {"field": "age",             "op": "<=", "value": 50},
    {"field": "has_bank_account","op": "==", "value": True}
  ]},
  "documents": ["bank_account"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/pmjjby",
    "apply": "https://jansuraksha.gov.in/Files/PMJJBY/English/Rules.pdf"
  },
  "notes": ""
},

# ── 16. Pradhan Mantri Kisan Maandhan Yojana ─────────────────────────────────
{
  "id": "pmkmdy",
  "name": "Pradhan Mantri Kisan Maandhan Yojana",
  "tier": 1, "level": "central", "state": None, "scope": "person",
  "benefit": "Monthly pension of Rs 3000 at age 60 for small and marginal farmers.",
  "criteria": {"all": [
    {"field": "age",                        "op": ">=", "value": 18},
    {"field": "age",                        "op": "<=", "value": 40},
    {"field": "owns_land_in_own_name",      "op": "==", "value": True},
    {"field": "land_hectares",              "op": "<=", "value": 2},
    {"field": "name_in_land_records_aug2019","op": "==", "value": True},
    {"field": "has_aadhaar",                "op": "==", "value": True},
    {"field": "has_bank_account",           "op": "==", "value": True}
  ]},
  "documents": ["aadhaar_card", "bank_account_with_ifsc"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/pmkmdy",
    "apply": "https://pmkmy.gov.in/scheme/pmkmy"
  },
  "notes": ""
},

# ── 17. Pradhan Mantri Mudra Yojana ──────────────────────────────────────────
{
  "id": "pmmy",
  "name": "Pradhan Mantri Mudra Yojana",
  "tier": 1, "level": "central", "state": None, "scope": "person",
  "benefit": "Collateral-free business loans up to Rs 10 lakh (Shishu, Kishore, Tarun tiers).",
  "criteria": {"all": [
    {"field": "wants_business_loan","op": "==", "value": True},
    {"field": "is_loan_defaulter",  "op": "==", "value": False}
  ]},
  "documents": ["identity_proof", "residence_proof", "bank_statement", "business_proof"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/pmmy",
    "apply": "https://www.mudra.org.in/"
  },
  "notes": "Very broad criteria. Rule filters out defaulters only. Check official page for non-farm business limits."
},

# ── 18. Pradhan Mantri Ujjwala Yojana ────────────────────────────────────────
{
  "id": "pmuy",
  "name": "Pradhan Mantri Ujjwala Yojana",
  "tier": 1, "level": "central", "state": None, "scope": "person",
  "benefit": "Free LPG connection with first refill and stove to women from deprived households.",
  "criteria": {"all": [
    {"field": "gender",          "op": "==", "value": "female"},
    {"field": "age",             "op": ">=", "value": 18},
    {"field": "household.has_lpg","op": "==", "value": False},
    {"any": [
      {"field": "household.bpl",             "op": "==", "value": True},
      {"field": "household.is_sc_st",        "op": "==", "value": True},
      {"field": "household.has_aay_card",    "op": "==", "value": True},
      {"field": "household.is_pmay_beneficiary","op": "==", "value": True},
      {"field": "household.in_priority_group","op": "==", "value": True}
    ]}
  ]},
  "documents": ["photo_id", "ration_card", "address_proof", "bank_account"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/pmuy",
    "apply": "https://www.pmuy.gov.in/"
  },
  "notes": "'in_priority_group' covers forest dwellers, MBC, tea garden tribes, river island residents. Covers UJJWALA 2.0."
},

# ── 19. Shravanbal Seva State Pension Scheme (Maharashtra) ───────────────────
{
  "id": "sbssps",
  "name": "Shravanbal Seva State Pension Scheme",
  "tier": 1, "level": "state", "state": "Maharashtra", "scope": "person",
  "benefit": "Monthly pension for destitute elderly (65+) with Maharashtra domicile.",
  "criteria": {"all": [
    {"field": "household.state",           "op": "==", "value": "Maharashtra"},
    {"field": "age",                       "op": ">=", "value": 65},
    {"field": "domicile_years_maharashtra","op": ">=", "value": 15},
    {"field": "is_destitute",             "op": "==", "value": True},
    {"any": [
      {"field": "household.bpl",   "op": "==", "value": True},
      {"field": "household.income","op": "<=", "value": 21000}
    ]}
  ]},
  "documents": ["aadhaar_card", "photo", "age_proof", "income_or_bpl_certificate",
                "domicile_certificate", "bank_details"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/sbssps",
    "apply": "https://sjsa.maharashtra.gov.in/"
  },
  "notes": ""
},

# ── 20. Sanjay Gandhi Niradhar Grant Scheme (Maharashtra) ────────────────────
{
  "id": "sgngs",
  "name": "Sanjay Gandhi Niradhar Grant Scheme",
  "tier": 1, "level": "state", "state": "Maharashtra", "scope": "person",
  "benefit": "Monthly grant to destitute / vulnerable persons in Maharashtra.",
  "criteria": {"all": [
    {"field": "household.state", "op": "==", "value": "Maharashtra"},
    {"any": [
      {"field": "household.bpl",   "op": "==", "value": True},
      {"field": "household.income","op": "<=", "value": 21000}
    ]},
    {"any": [
      {"all": [
        {"field": "is_destitute",  "op": "==", "value": True},
        {"field": "age",           "op": "<",  "value": 65}
      ]},
      {"field": "is_orphan",                    "op": "==", "value": True},
      {"field": "has_disability",               "op": "==", "value": True},
      {"field": "has_serious_disease",          "op": "==", "value": True},
      {"all": [
        {"field": "marital_status","op": "==", "value": "widowed"},
        {"field": "is_destitute",  "op": "==", "value": True}
      ]},
      {"field": "is_divorced_without_alimony",  "op": "==", "value": True},
      {"field": "is_transgender",               "op": "==", "value": True},
      {"field": "is_devadasi",                  "op": "==", "value": True},
      {"all": [
        {"field": "gender",        "op": "==", "value": "female"},
        {"field": "marital_status","op": "==", "value": "unmarried"},
        {"field": "age",           "op": ">",  "value": 35}
      ]},
      {"field": "is_prisoner_spouse",           "op": "==", "value": True},
      {"field": "has_sickle_cell",              "op": "==", "value": True},
      {"field": "is_rescued_trafficking_survivor","op": "==", "value": True}
    ]}
  ]},
  "documents": ["aadhaar_card", "photo", "domicile_certificate",
                "bank_details", "medical_or_incapacity_certificate"],
  "links": {
    "info":  "https://www.myscheme.gov.in/schemes/sgngs",
    "apply": "https://sjsa.maharashtra.gov.in/"
  },
  "notes": "12 vulnerability categories. 'Unmarried woman above 35' uses age > 35 - verify exact wording."
},

]  # end SCHEMES list


def main():
    written = []
    for scheme in SCHEMES:
        sid = scheme["id"]
        path = OUT / f"{sid}.json"
        path.write_text(json.dumps(scheme, indent=2, ensure_ascii=False), encoding="utf-8")
        written.append(sid)
        print(f"  OK  {path.name}")

    print(f"\nDone - {len(written)} Tier-1 JSON files written to {OUT}")


if __name__ == "__main__":
    main()
