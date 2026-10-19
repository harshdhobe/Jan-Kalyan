/**
 * engine.js
 * ---------
 * Core eligibility engine. Exposes three public functions:
 *
 *   evaluateAll(facts)          → array of scheme results
 *   nextQuestion(facts)         → next best field to ask the user
 *   getChecklist(schemeId)      → required documents for a scheme
 *
 * Facts object shape:
 * {
 *   age: 35,
 *   gender: "female",
 *   has_bank_account: true,
 *   household: {
 *     state: "Maharashtra",
 *     bpl: true,
 *     area_type: "rural",
 *     ...
 *   },
 *   ...
 * }
 */

"use strict";

const { evalNode, collectMissingFields } = require("./eval");
const { loadAllRules } = require("./loader");

// Load rules once at startup
const { rules, byId } = loadAllRules();

// ─────────────────────────────────────────────────────────────────────────────
// evaluateAll
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run every rule against the provided facts.
 *
 * @param {object} facts  - the user's answers so far
 * @returns {EvalResult[]}
 *
 * @typedef {object} EvalResult
 * @property {string}   id            - scheme id
 * @property {string}   name          - scheme display name
 * @property {string}   scope         - "person" | "household"
 * @property {string}   level         - "central" | "state"
 * @property {string|null} state      - state name or null
 * @property {string}   benefit       - benefit description
 * @property {"eligible"|"ineligible"|"unknown"} result
 * @property {string[]} missingFields - fields still needed (when result=unknown)
 * @property {string[]} documents     - required docs (populated when eligible)
 * @property {object}   links         - { info, apply }
 */
function evaluateAll(facts) {
  return rules.map((rule) => {
    const result = evalNode(rule.criteria, facts);
    const missingFields =
      result === "unknown" ? collectMissingFields(rule.criteria, facts) : [];

    return {
      id:            rule.id,
      name:          rule.name,
      scope:         rule.scope,
      level:         rule.level,
      state:         rule.state  || null,
      benefit:       rule.benefit || "",
      result:        result === true ? "eligible"
                   : result === false ? "ineligible"
                   : "unknown",
      missingFields,
      documents:     result === true ? (rule.documents || []) : [],
      links:         rule.links   || {},
      notes:         rule.notes   || "",
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// nextQuestion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine the single most valuable field to ask the user next.
 *
 * Strategy: pick the field that appears as "missing" across the most
 * schemes that are still in "unknown" state. This is a greedy information-
 * gain heuristic — it maximises the number of schemes resolved per question.
 *
 * @param {object} facts
 * @returns {{ field: string, schemeCount: number } | null}
 *   null when nothing is unknown (all schemes are resolved).
 */
function nextQuestion(facts) {
  const results = evaluateAll(facts);
  const fieldCount = new Map(); // field → number of unknown schemes that need it

  for (const r of results) {
    if (r.result !== "unknown") continue;
    for (const field of r.missingFields) {
      fieldCount.set(field, (fieldCount.get(field) || 0) + 1);
    }
  }

  if (fieldCount.size === 0) return null;

  // Sort by count descending, then alphabetically for stable ordering
  const sorted = [...fieldCount.entries()].sort(
    ([a, ca], [b, cb]) => cb - ca || a.localeCompare(b)
  );

  const [field, schemeCount] = sorted[0];
  return { field, schemeCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// getChecklist
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the document checklist for a specific scheme.
 *
 * @param {string} schemeId
 * @returns {{ documents: string[], links: object } | null}
 *   null if the scheme is not found.
 */
function getChecklist(schemeId) {
  const rule = byId.get(schemeId);
  if (!rule) return null;
  return {
    id:        rule.id,
    name:      rule.name,
    documents: rule.documents || [],
    links:     rule.links     || {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return only the schemes where the user is definitely eligible.
 *
 * @param {object} facts
 * @returns {EvalResult[]}
 */
function getEligible(facts) {
  return evaluateAll(facts).filter((r) => r.result === "eligible");
}

/**
 * Return schemes that are still undecided (at least one field missing).
 *
 * @param {object} facts
 * @returns {EvalResult[]}
 */
function getUnknown(facts) {
  return evaluateAll(facts).filter((r) => r.result === "unknown");
}

/**
 * Total number of rules loaded (tier1 + tier2 combined).
 * @returns {number}
 */
function ruleCount() {
  return rules.length;
}

module.exports = {
  evaluateAll,
  nextQuestion,
  getChecklist,
  getEligible,
  getUnknown,
  ruleCount,
};
