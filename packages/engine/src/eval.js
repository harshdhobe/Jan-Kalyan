/**
 * eval.js
 * -------
 * 3-valued logic evaluator for scheme eligibility criteria.
 *
 * Result values:
 *   true      — criterion is satisfied
 *   false     — criterion is definitely NOT satisfied
 *   "unknown" — a required field has not been answered yet
 *
 * Criterion node shapes:
 *   Leaf:  { field, op, value }
 *   AND:   { all: [ ...nodes ] }
 *   OR:    { any: [ ...nodes ] }
 */

"use strict";

/**
 * Resolve a dot-notation field path from the facts object.
 * e.g. "household.area_type" on { household: { area_type: "rural" } }
 * Returns undefined if not set.
 *
 * @param {object} facts
 * @param {string} path
 * @returns {*}
 */
function resolvePath(facts, path) {
  return path.split(".").reduce((obj, key) => {
    if (obj === undefined || obj === null) return undefined;
    return obj[key];
  }, facts);
}

/**
 * Evaluate a single leaf criterion against facts.
 *
 * @param {object} leaf  - { field, op, value }
 * @param {object} facts - flat/nested facts object
 * @returns {true|false|"unknown"}
 */
function evalLeaf(leaf, facts) {
  const actual = resolvePath(facts, leaf.field);

  // Field not answered yet → unknown
  if (actual === undefined || actual === null) return "unknown";

  const expected = leaf.value;

  switch (leaf.op) {
    case "==": return actual === expected;
    case "!=": return actual !== expected;
    case ">=": return actual >= expected;
    case "<=": return actual <= expected;
    case ">":  return actual >  expected;
    case "<":  return actual <  expected;
    case "in":
      if (!Array.isArray(expected)) return false;
      return expected.includes(actual);
    default:
      throw new Error(`Unknown operator: "${leaf.op}"`);
  }
}

/**
 * Evaluate a criterion node (leaf, all, or any) with 3-valued logic.
 *
 * AND (all) short-circuits on the first definite false.
 * OR  (any) short-circuits on the first definite true.
 *
 * @param {object} node
 * @param {object} facts
 * @returns {true|false|"unknown"}
 */
function evalNode(node, facts) {
  // --- Leaf ---
  if (node.field !== undefined) {
    return evalLeaf(node, facts);
  }

  // --- AND (all) ---
  if (node.all !== undefined) {
    let hasUnknown = false;
    for (const child of node.all) {
      const r = evalNode(child, facts);
      if (r === false) return false;          // definite failure short-circuits
      if (r === "unknown") hasUnknown = true;
    }
    return hasUnknown ? "unknown" : true;
  }

  // --- OR (any) ---
  if (node.any !== undefined) {
    let hasUnknown = false;
    for (const child of node.any) {
      const r = evalNode(child, facts);
      if (r === true) return true;            // definite success short-circuits
      if (r === "unknown") hasUnknown = true;
    }
    return hasUnknown ? "unknown" : false;
  }

  throw new Error(`Invalid criterion node: ${JSON.stringify(node)}`);
}

/**
 * Collect all field paths that are still "unknown" (unanswered)
 * within a criteria tree — but only those that could change the result.
 *
 * @param {object} node
 * @param {object} facts
 * @returns {string[]} list of field paths
 */
function collectMissingFields(node, facts) {
  const missing = new Set();
  _walk(node, facts, missing);
  return [...missing];
}

function _walk(node, facts, missing) {
  if (node.field !== undefined) {
    const actual = resolvePath(facts, node.field);
    if (actual === undefined || actual === null) {
      missing.add(node.field);
    }
    return;
  }
  const children = node.all || node.any || [];
  for (const child of children) {
    // Skip children inside an OR branch that is already definitively true
    if (node.any) {
      const r = evalNode(child, facts);
      if (r === true) return; // this branch already wins, no need to ask more
    }
    _walk(child, facts, missing);
  }
}

module.exports = { evalNode, collectMissingFields, resolvePath };
