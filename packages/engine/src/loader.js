/**
 * loader.js
 * ---------
 * Loads all Tier-1 and Tier-2 rule JSON files from disk.
 *
 * Tier-1 rules live in:  data/rules/tier1/*.json
 * Tier-2 rules live in:  data/rules/tier2/*.json
 *
 * If the same scheme ID exists in both tiers, Tier-1 wins
 * (it contains the hand-crafted, higher-fidelity rule).
 *
 * Returns an array of rule objects, each shaped like:
 * {
 *   id, name, tier, level, state, scope,
 *   benefit, criteria, documents, links, notes
 * }
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// Resolve the data directory relative to the repo root
// (this file is at packages/engine/src/loader.js)
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const TIER1_DIR = path.join(REPO_ROOT, "data", "rules", "tier1");
const TIER2_DIR = path.join(REPO_ROOT, "data", "rules", "tier2");

/**
 * Read all *.json files from a directory and parse them.
 *
 * @param {string} dir
 * @returns {object[]}
 */
function loadDir(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const full = path.join(dir, f);
      try {
        return JSON.parse(fs.readFileSync(full, "utf-8"));
      } catch (err) {
        console.error(`[loader] Failed to parse ${full}: ${err.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Load all rules (tier1 + tier2), with tier1 taking precedence.
 *
 * @returns {{ rules: object[], byId: Map<string, object> }}
 */
function loadAllRules() {
  const tier1 = loadDir(TIER1_DIR);
  const tier2 = loadDir(TIER2_DIR);

  // Build a map — tier1 is added first so it overrides tier2 on collision
  const byId = new Map();

  for (const rule of tier1) {
    if (rule.id) byId.set(rule.id, rule);
  }
  for (const rule of tier2) {
    if (rule.id && !byId.has(rule.id)) byId.set(rule.id, rule);
  }

  const rules = [...byId.values()];

  console.log(
    `[loader] Loaded ${tier1.length} tier-1 + ${tier2.length} tier-2 rules ` +
    `(${rules.length} unique after dedup)`
  );

  return { rules, byId };
}

module.exports = { loadAllRules };
