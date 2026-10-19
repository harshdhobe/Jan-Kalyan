/**
 * run_tests.js
 * ------------
 * Golden persona test runner in JavaScript for @gov-scheme/engine.
 * Matches npm test script.
 *
 * Run with:
 *   node packages/engine/tests/run_tests.js
 */

"use strict";

const engine = require("../src/index");

const GOLDEN_PERSONAS = [
  {
    id: "persona_1",
    name: "Ramcharan (70M, Rural BPL SC Elder, UP)",
    description: "Elderly Dalit man living in rural UP in a single-room kutcha home with no land and no LPG.",
    facts: {
      age: 70,
      gender: "male",
      has_bank_account: true,
      household: {
        state: "Uttar Pradesh",
        area_type: "rural",
        bpl: true,
        is_sc_st: true,
        owns_pucca_house: false,
        house_type: "kutcha",
        rooms: 1,
        owns_cultivable_land: false,
        has_lpg: false,
      },
    },
    expectEligible: ["ab-pmjay", "nsap-ignoaps", "pmjdy", "pmay-g"],
    expectIneligible: [
      "apy", "pmjjby", "pm-sym", "pmkmdy",
      "mmlby", "ignwps", "pmuy", "sbssps", "sgngs"
    ],
    expectDocuments: {
      "nsap-ignoaps": ["aadhaar_card", "age_proof", "bank_passbook", "ration_card"],
    },
  },
  {
    id: "persona_2",
    name: "Sunita (52F, Rural Maharashtra BPL Widow)",
    description: "52-year-old destitute widow in rural Maharashtra, yellow ration card, no LPG, looking for support.",
    facts: {
      age: 52,
      gender: "female",
      marital_status: "widowed",
      has_bank_account: true,
      has_aadhaar_linked_bank_account: true,
      is_destitute: true,
      domicile_years_maharashtra: 20,
      household: {
        state: "Maharashtra",
        area_type: "rural",
        bpl: true,
        income: 18000,
        ration_card_type: "yellow",
        has_domicile_certificate: true,
        owns_pucca_house: false,
        house_type: "kutcha",
        rooms: 1,
        has_lpg: false,
        is_sc_st: false,
        owns_cultivable_land: false,
      },
    },
    expectEligible: [
      "ignwps", "mmlby", "mjpjay", "pmuy",
      "sgngs", "pmjdy", "ab-pmjay", "pmay-g"
    ],
    expectIneligible: [
      "nsap-ignoaps", "sbssps", "apy",
      "pmjjby", "pmkmdy", "pm-sym"
    ],
    expectDocuments: {
      "ignwps": ["husband_death_certificate", "bpl_card", "age_proof"],
      "mmlby": ["aadhaar_card", "domicile_certificate", "income_certificate", "bank_passbook"],
    },
  },
  {
    id: "persona_3",
    name: "Ramesh (28M, Urban Street Vendor & Informal Worker, Delhi)",
    description: "28-year-old fruit vendor in Delhi holding municipal vending ID, seeking micro-credit and pension.",
    facts: {
      age: 28,
      gender: "male",
      marital_status: "married",
      has_bank_account: true,
      has_aadhaar: true,
      has_mobile: true,
      is_street_vendor: true,
      vendor_status: "has_certificate_or_id",
      wants_business_loan: true,
      is_loan_defaulter: false,
      is_unorganised_worker: true,
      monthly_income: 12000,
      household: {
        state: "Delhi",
        area_type: "urban",
        bpl: false,
        income: 144000,
        owns_pucca_house: false,
        used_housing_scheme_before: false,
        has_listed_urban_worker: true,
        has_lpg: true,
      },
    },
    expectEligible: [
      "pm-svanidhi", "pmmy", "pm-sym", "apy",
      "pmjjby", "pmjdy", "pmay-u", "ab-pmjay"
    ],
    expectIneligible: [
      "ignwps", "mmlby", "pmuy", "pmay-g",
      "nsap-ignoaps", "sbssps"
    ],
    expectDocuments: {
      "pm-svanidhi": ["certificate_of_vending_or_id", "aadhaar_card"],
      "pm-sym": ["aadhaar_card", "bank_passbook", "mobile_number", "self_certification"],
    },
  },
  {
    id: "persona_4",
    name: "Ganesh (36M, Smallholder Farmer, Maharashtra)",
    description: "36-year-old small farmer in Maharashtra owning 1.5 hectares of farmland registered in Aug 2019.",
    facts: {
      age: 36,
      gender: "male",
      has_bank_account: true,
      has_aadhaar: true,
      owns_land_in_own_name: true,
      land_hectares: 1.5,
      name_in_land_records_aug2019: true,
      household: {
        state: "Maharashtra",
        owns_cultivable_land: true,
        area_type: "rural",
        bpl: false,
        income: 120000,
        ration_card_type: "orange",
        has_domicile_certificate: true,
        owns_pucca_house: true,
        has_lpg: true,
      },
    },
    expectEligible: [
      "pm-kisan", "namo-shetkari-mahasanman-nidhi-yojana", "pmkmdy",
      "mjpjay", "apy", "pmjjby", "pmjdy"
    ],
    expectIneligible: [
      "pmay-g", "pmay-u", "mmlby", "pmuy",
      "ignwps", "nsap-ignoaps", "sbssps"
    ],
    expectDocuments: {
      "pm-kisan": ["aadhaar_card", "land_records", "bank_account"],
      "namo-shetkari-mahasanman-nidhi-yojana": ["aadhaar_card", "land_record_7_12", "land_record_8a", "ration_card"],
    },
  },
  {
    id: "persona_5",
    name: "Pooja (32F, Urban Salaried Middle-Class, Maharashtra)",
    description: "32-year-old married urban woman in Pune earning 12 LPA, owns no home, applying for urban housing.",
    facts: {
      age: 32,
      gender: "female",
      marital_status: "married",
      has_bank_account: true,
      has_aadhaar_linked_bank_account: true,
      household: {
        state: "Maharashtra",
        area_type: "urban",
        income: 1200000,
        owns_pucca_house: false,
        used_housing_scheme_before: false,
        has_listed_urban_worker: false,
        special_vulnerable_group: false,
        bpl: false,
        has_lpg: true,
        has_domicile_certificate: true,
        ration_card_type: "white",
        owns_cultivable_land: false,
      },
    },
    expectEligible: [
      "pmay-u", "mjpjay", "apy", "pmjjby", "pmjdy"
    ],
    expectIneligible: [
      "mmlby", "pmay-g", "pmuy", "ab-pmjay",
      "ignwps", "nsap-ignoaps", "sbssps"
    ],
    expectDocuments: {
      "pmay-u": ["aadhaar_card", "income_proof", "identity_residence_proof"],
    },
  },
  {
    id: "persona_6",
    name: "Vikas (24M, Young Severe Disability Candidate, Bihar)",
    description: "24-year-old youth with 85% locational disability in a rural BPL household in Bihar.",
    facts: {
      age: 24,
      gender: "male",
      has_disability: true,
      disability_percent: 85,
      has_bank_account: true,
      is_destitute: false,
      household: {
        state: "Bihar",
        area_type: "rural",
        bpl: true,
        income: 30000,
        owns_pucca_house: false,
        house_type: "kutcha",
        rooms: 2,
        disabled_member_no_able_adult: true,
        is_sc_st: false,
        has_lpg: true,
        owns_cultivable_land: false,
      },
    },
    expectEligible: [
      "igndps", "ab-pmjay", "pmay-g", "pmjdy",
      "pmjjby", "apy"
    ],
    expectIneligible: [
      "ignwps", "mmlby", "pmuy", "sbssps",
      "sgngs", "nsap-ignoaps"
    ],
    expectDocuments: {
      "igndps": ["disability_certificate", "bpl_card", "aadhaar_card", "age_proof"],
    },
  },
  {
    id: "persona_7",
    name: "Priya (22F, Partial Profile / 3-Valued Logic Short-Circuit)",
    description: "22-year-old female who only answered age and gender. Verifies 3-valued logic, short-circuiting, and question heuristic.",
    facts: {
      age: 22,
      gender: "female",
    },
    expectEligible: [
      "pmjdy"
    ],
    expectIneligible: [
      "nsap-ignoaps", "sbssps", "ignwps"
    ],
    expectUnknown: [
      "apy", "pmjjby", "pm-sym", "mmlby", "pmuy"
    ],
  },
];

function runTests() {
  console.log("=".repeat(70));
  console.log("STEP 4: JS ENGINE GOLDEN PERSONA VERIFICATION SUITE");
  console.log(`Total rules loaded in engine: ${engine.ruleCount()}`);
  console.log("=".repeat(70));

  let total = 0;
  let passed = 0;
  const errors = [];

  for (const p of GOLDEN_PERSONAS) {
    console.log(`\n>> [${p.id.toUpperCase()}] ${p.name}`);
    console.log(`   ${p.description}`);

    const results = engine.evaluateAll(p.facts);
    const byId = new Map(results.map((r) => [r.id, r]));

    // Eligible assertions
    for (const sid of p.expectEligible || []) {
      total++;
      const actual = byId.get(sid)?.result || "NOT_FOUND";
      if (actual === "eligible") {
        passed++;
        console.log(`   [PASS] Eligible: ${sid}`);
      } else {
        errors.push(`${p.id}: Expected ${sid} to be ELIGIBLE, got ${actual}`);
        console.log(`   [FAIL] Eligible: ${sid} (got ${actual})`);
      }
    }

    // Ineligible assertions
    for (const sid of p.expectIneligible || []) {
      total++;
      const actual = byId.get(sid)?.result || "NOT_FOUND";
      if (actual === "ineligible") {
        passed++;
        console.log(`   [PASS] Ineligible: ${sid}`);
      } else {
        errors.push(`${p.id}: Expected ${sid} to be INELIGIBLE, got ${actual}`);
        console.log(`   [FAIL] Ineligible: ${sid} (got ${actual})`);
      }
    }

    // Unknown assertions
    for (const sid of p.expectUnknown || []) {
      total++;
      const r = byId.get(sid);
      const actual = r?.result || "NOT_FOUND";
      if (actual === "unknown") {
        passed++;
        console.log(`   [PASS] Unknown: ${sid} (missing: ${r.missingFields.join(", ")})`);
      } else {
        errors.push(`${p.id}: Expected ${sid} to be UNKNOWN, got ${actual}`);
        console.log(`   [FAIL] Unknown: ${sid} (got ${actual})`);
      }
    }

    // Documents check
    for (const [sid, expectedDocs] of Object.entries(p.expectDocuments || {})) {
      const checklist = engine.getChecklist(sid);
      for (const doc of expectedDocs) {
        total++;
        if (checklist && checklist.documents.includes(doc)) {
          passed++;
          console.log(`   [PASS] Document checklist: ${sid} has '${doc}'`);
        } else {
          errors.push(`${p.id}: Checklist for ${sid} missing document '${doc}'`);
          console.log(`   [FAIL] Document checklist: ${sid} missing '${doc}'`);
        }
      }
    }

    // Next question heuristic
    if (p.expectUnknown) {
      total++;
      const nextQ = engine.nextQuestion(p.facts);
      if (nextQ && nextQ.schemeCount > 0) {
        passed++;
        console.log(`   [PASS] Next Question recommended: '${nextQ.field}' (resolves ${nextQ.schemeCount} unknown schemes)`);
      } else {
        errors.push(`${p.id}: nextQuestion() returned null or 0`);
        console.log(`   [FAIL] Next Question failed`);
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(`SUMMARY: ${passed} / ${total} assertions passed.`);
  if (errors.length > 0) {
    console.error(`FAILED (${errors.length} errors):`);
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  } else {
    console.log("ALL GOLDEN PERSONA TESTS PASSED!");
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { GOLDEN_PERSONAS, runTests };
