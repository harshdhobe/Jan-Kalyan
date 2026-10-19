/**
 * engine.js (Browser-compatible)
 * ------------------------------
 * Implements 3-valued eligibility evaluation, document checklist lookups,
 * and greedy next-question heuristics directly in the browser.
 */

(function (window) {
  "use strict";

  function resolvePath(facts, path) {
    if (!facts || !path) return undefined;
    return path.split(".").reduce((obj, key) => {
      if (obj === undefined || obj === null) return undefined;
      return obj[key];
    }, facts);
  }

  function setPath(facts, path, value) {
    const parts = path.split(".");
    let current = facts;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== "object") {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = value;
  }

  function deletePath(facts, path) {
    const parts = path.split(".");
    let current = facts;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) return;
      current = current[part];
    }
    delete current[parts[parts.length - 1]];
  }

  function evalLeaf(leaf, facts) {
    const actual = resolvePath(facts, leaf.field);
    if (actual === undefined || actual === null) return "unknown";

    const expected = leaf.value;
    switch (leaf.op) {
      case "==": return actual === expected;
      case "!=": return actual !== expected;
      case ">=": return actual >= expected;
      case "<=": return actual <= expected;
      case ">":  return actual > expected;
      case "<":  return actual < expected;
      case "in":
        if (!Array.isArray(expected)) return false;
        return expected.includes(actual);
      default:
        console.warn(`Unknown operator ${leaf.op} in leaf:`, leaf);
        return false;
    }
  }

  function evalNode(node, facts) {
    if (node.field !== undefined) {
      return evalLeaf(node, facts);
    }

    if (node.all !== undefined) {
      let hasUnknown = false;
      for (const child of node.all) {
        const r = evalNode(child, facts);
        if (r === false) return false; // Definite false short-circuits
        if (r === "unknown") hasUnknown = true;
      }
      return hasUnknown ? "unknown" : true;
    }

    if (node.any !== undefined) {
      let hasUnknown = false;
      for (const child of node.any) {
        const r = evalNode(child, facts);
        if (r === true) return true; // Definite true short-circuits
        if (r === "unknown") hasUnknown = true;
      }
      return hasUnknown ? "unknown" : false;
    }

    return "unknown";
  }

  function collectMissingFields(node, facts) {
    const missing = new Set();

    function _walk(n) {
      if (n.field !== undefined) {
        const actual = resolvePath(facts, n.field);
        if (actual === undefined || actual === null) {
          missing.add(n.field);
        }
        return;
      }

      if (n.any !== undefined) {
        for (const child of n.any) {
          // If a child is already true, this OR branch is satisfied
          if (evalNode(child, facts) === true) return;
          _walk(child);
        }
        return;
      }

      if (n.all !== undefined) {
        for (const child of n.all) {
          _walk(child);
        }
      }
    }

    _walk(node);
    return Array.from(missing);
  }

  function evaluateAll(rules, facts) {
    return (rules || []).map((rule) => {
      const outcome = evalNode(rule.criteria, facts);
      const missingFields = outcome === "unknown" ? collectMissingFields(rule.criteria, facts) : [];

      return {
        id: rule.id,
        name: rule.name,
        scope: rule.scope || "person",
        level: rule.level || "central",
        state: rule.state || null,
        benefit: rule.benefit || "",
        result: outcome === true ? "eligible" : outcome === false ? "ineligible" : "unknown",
        missingFields: missingFields,
        documents: outcome === true ? (rule.documents || []) : [],
        links: rule.links || {},
        notes: rule.notes || "",
        category: rule.category || "",
        criteria: rule.criteria
      };
    });
  }

  function nextQuestion(rules, facts) {
    const results = evaluateAll(rules, facts);
    const fieldFrequency = new Map();

    for (const r of results) {
      if (r.result !== "unknown") continue;
      for (const field of r.missingFields) {
        fieldFrequency.set(field, (fieldFrequency.get(field) || 0) + 1);
      }
    }

    if (fieldFrequency.size === 0) return null;

    const sorted = Array.from(fieldFrequency.entries()).sort(
      ([fa, ca], [fb, cb]) => cb - ca || fa.localeCompare(fb)
    );

    const [field, schemeCount] = sorted[0];
    return { field, schemeCount };
  }

  function getChecklist(rules, schemeId) {
    const rule = (rules || []).find((r) => r.id === schemeId);
    if (!rule) return null;
    return {
      id: rule.id,
      name: rule.name,
      documents: rule.documents || [],
      links: rule.links || {},
    };
  }

  // Export to global scope
  window.GovEngine = {
    resolvePath,
    setPath,
    deletePath,
    evalNode,
    collectMissingFields,
    evaluateAll,
    nextQuestion,
    getChecklist,
  };
})(window);
