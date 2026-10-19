/**
 * index.js
 * --------
 * Public API for @gov-scheme/engine.
 *
 * Usage:
 *   const engine = require('@gov-scheme/engine');
 *   // or
 *   const { evaluateAll, nextQuestion, getChecklist } = require('./src/index');
 *
 * Quick example:
 *
 *   const facts = {
 *     age: 35,
 *     gender: "female",
 *     has_bank_account: true,
 *     household: {
 *       state: "Maharashtra",
 *       bpl: true,
 *       area_type: "rural",
 *       owns_pucca_house: false,
 *     }
 *   };
 *
 *   const results  = engine.evaluateAll(facts);
 *   const eligible = results.filter(r => r.result === "eligible");
 *   const next     = engine.nextQuestion(facts);   // { field, schemeCount }
 *   const docs     = engine.getChecklist("pmjjby"); // { documents, links }
 */

"use strict";

module.exports = require("./engine");
