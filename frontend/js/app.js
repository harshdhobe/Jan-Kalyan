/**
 * app.js
 * ------
 * Main UI Controller for JanKalyan Scheme Eligibility Portal.
 * Minimalist, quiet editorial interface (Linear / Stripe / Notion design).
 * Pure Vanilla JavaScript, zero build dependencies.
 */

(function () {
  "use strict";

  // Global state
  const state = {
    lang: "en", // "en" | "hi"
    facts: {},
    activeField: null,
    currentTab: "eligible", // "eligible" | "unknown" | "ineligible"
    searchQuery: "",
    selectedCategories: new Set(),
    selectedLevels: new Set(), // "central" | "state"
    selectedScopes: new Set(), // "individual" | "household"
    showAllCategories: false, // Toggle top 10 vs all
    checkedDocs: new Set(),
    accordionOpen: false,
    expandedBenefits: new Set(),
    openDocDisclosures: new Set(),
    visibleCount: 20, // Batch size for rendering performance
  };

  // 16 Canonical categories + Pensions + Other
  const CANONICAL_CATEGORIES = [
    "Social welfare & Empowerment",
    "Education & Learning",
    "Agriculture, Rural & Environment",
    "Business & Entrepreneurship",
    "Women and Child",
    "Skills & Employment",
    "Banking, Financial Services & Insurance",
    "Health & Wellness",
    "Sports & Culture",
    "Housing & Shelter",
    "Science",
    "IT & Communications",
    "Transport & Infrastructure",
    "Travel & Tourism",
    "Utility & Sanitation",
    "Public Safety, Law & Justice",
    "Pensions",
    "Other",
  ];

  // Hindi display translations
  const CATEGORY_NAMES_HI = {
    "Social welfare & Empowerment": "सामाजिक कल्याण एवं सशक्तिकरण",
    "Education & Learning": "शिक्षा एवं अध्ययन",
    "Agriculture, Rural & Environment": "कृषि, ग्रामीण एवं पर्यावरण",
    "Business & Entrepreneurship": "व्यवसाय एवं उद्यमिता",
    "Women and Child": "महिला एवं बाल",
    "Skills & Employment": "कौशल एवं रोज़गार",
    "Banking, Financial Services & Insurance": "बैंकिंग, वित्तीय सेवाएँ एवं बीमा",
    "Health & Wellness": "स्वास्थ्य एवं कल्याण",
    "Sports & Culture": "खेल एवं संस्कृति",
    "Housing & Shelter": "आवास एवं आश्रय",
    "Science": "विज्ञान",
    "IT & Communications": "आईटी एवं संचार",
    "Transport & Infrastructure": "परिवहन एवं अवसंरचना",
    "Travel & Tourism": "यात्रा एवं पर्यटन",
    "Utility & Sanitation": "उपयोगिता एवं स्वच्छता",
    "Public Safety, Law & Justice": "सार्वजनिक सुरक्षा, कानून एवं न्याय",
    "Pensions": "पेंशन",
    "Other": "अन्य",
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Category Parser & Derived Pension Group Helper
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Checks if scheme text mentions pension (English or Hindi).
   * Derived group helper: easy to adapt if criteria evolve.
   */
  function isPensionScheme(scheme) {
    if (!scheme) return false;
    const name = scheme.name || "";
    const benefitPrefix = (scheme.benefit || "").slice(0, 200);
    const combined = `${name} ${benefitPrefix}`;
    return /pension|पेंशन/i.test(combined);
  }

  /**
   * Normalizes category segment strings into exact canonical names.
   */
  function normalizeCategoryName(raw) {
    if (!raw) return "Other";
    let c = raw.trim();
    if (!c || c.toLowerCase() === "null" || c.toLowerCase() === "none" || c.toLowerCase() === "as required") {
      return "Other";
    }
    // Normalize comma without space (e.g. "Agriculture,Rural" -> "Agriculture, Rural")
    c = c.replace(/,(\S)/g, ", $1");

    if (/Banking/i.test(c)) return "Banking, Financial Services & Insurance";
    if (/Agriculture/i.test(c)) return "Agriculture, Rural & Environment";
    if (/Public Safety/i.test(c)) return "Public Safety, Law & Justice";
    if (/Women\s*(?:and|&)\s*Child/i.test(c)) return "Women and Child";
    if (/Social welfare/i.test(c)) return "Social welfare & Empowerment";
    if (/Education/i.test(c)) return "Education & Learning";
    if (/Business/i.test(c)) return "Business & Entrepreneurship";
    if (/Skills/i.test(c)) return "Skills & Employment";
    if (/Health/i.test(c)) return "Health & Wellness";
    if (/Sports/i.test(c)) return "Sports & Culture";
    if (/Housing/i.test(c)) return "Housing & Shelter";
    if (/Science/i.test(c)) return "Science";
    if (/IT/i.test(c)) return "IT & Communications";
    if (/Transport/i.test(c)) return "Transport & Infrastructure";
    if (/Travel/i.test(c)) return "Travel & Tourism";
    if (/Utility/i.test(c)) return "Utility & Sanitation";

    return c || "Other";
  }

  /**
   * Parses category string from scheme data.
   * SPLIT on comma+space (", ") ONLY.
   */
  function parseSchemeCategories(catString, scheme) {
    const list = [];
    if (!catString || !catString.trim()) {
      list.push("Other");
    } else {
      // Split strictly on comma+space
      const rawParts = catString.split(", ");
      rawParts.forEach((part) => {
        const norm = normalizeCategoryName(part);
        if (norm && !list.includes(norm)) {
          list.push(norm);
        }
      });
      if (list.length === 0) list.push("Other");
    }

    // Derived group "Pensions"
    if (scheme && isPensionScheme(scheme)) {
      if (!list.includes("Pensions")) {
        list.push("Pensions");
      }
    }

    return list;
  }

  /**
   * Helper to determine scheme level: "central" | "state" | "unknown"
   * In the dataset, the `state` field holds "Central" for central schemes,
   * or a state/UT name (e.g. "Maharashtra", "Puducherry") for state schemes.
   */
  function getLevel(scheme) {
    if (!scheme) return "unknown";
    const s = scheme.state;
    if (typeof s === "string") {
      const trimmed = s.trim();
      if (trimmed.toLowerCase() === "central") return "central";
      if (trimmed.length > 0) return "state";
    }
    if (scheme.level) {
      const lvl = String(scheme.level).trim().toLowerCase();
      if (lvl === "central") return "central";
      if (lvl === "state") return "state";
    }
    return "unknown";
  }

  /**
   * Helper to determine scheme scope: "individual" | "household" | "unknown"
   * In the dataset, `scope` holds "person" or "individual" for individual schemes,
   * and "household" for household schemes.
   */
  function getScope(scheme) {
    if (!scheme) return "unknown";
    const s = scheme.scope;
    if (typeof s === "string") {
      const trimmed = s.trim().toLowerCase();
      if (trimmed === "individual" || trimmed === "person") return "individual";
      if (trimmed === "household") return "household";
    }
    return "unknown";
  }

  // Cache DOM elements
  const els = {};

  function init() {
    els.langEn = document.getElementById("lang-en");
    els.langHi = document.getElementById("lang-hi");
    els.personaSelect = document.getElementById("persona-select");
    els.resetBtn = document.getElementById("reset-btn");

    els.questionBox = document.getElementById("question-box");
    els.factsList = document.getElementById("facts-list");
    els.factsCount = document.getElementById("facts-count");

    els.catalogAccordion = document.getElementById("catalog-accordion");
    els.catalogToggle = document.getElementById("catalog-toggle");
    els.catalogContent = document.getElementById("catalog-content");

    els.tabEligible = document.getElementById("tab-eligible");
    els.tabUnknown = document.getElementById("tab-unknown");
    els.tabIneligible = document.getElementById("tab-ineligible");

    els.countEligible = document.getElementById("count-eligible");
    els.countUnknown = document.getElementById("count-unknown");
    els.countIneligible = document.getElementById("count-ineligible");

    els.searchInput = document.getElementById("search-input");
    els.schemesList = document.getElementById("schemes-list");

    // Category Rail & Filters Hooks
    els.categoryRail = document.getElementById("category-rail");
    els.catRailSection = document.getElementById("cat-rail-section");
    els.catRailTitle = document.getElementById("cat-rail-title");
    els.categoryListContainer = document.getElementById("category-list-container");
    els.categoryChips = document.getElementById("category-chips");
    els.resultsSummary = document.getElementById("results-summary");
    els.btnClearCategories = document.getElementById("btn-clear-categories");

    // Scheme Level Rail Hooks
    els.levelRailSection = document.getElementById("level-rail-section");
    els.levelRailTitle = document.getElementById("level-rail-title");
    els.levelListContainer = document.getElementById("level-list-container");
    els.railLevelDivider = document.getElementById("rail-level-divider");

    // Scheme Scope / Beneficiary Rail Hooks
    els.scopeRailSection = document.getElementById("scope-rail-section");
    els.scopeRailTitle = document.getElementById("scope-rail-title");
    els.scopeListContainer = document.getElementById("scope-list-container");
    els.railScopeDivider = document.getElementById("rail-scope-divider");

    // Mobile / Tablet Bottom Sheet Hooks
    els.btnFiltersToggle = document.getElementById("btn-filters-toggle");
    els.filtersBadge = document.getElementById("filters-badge");
    els.filtersBottomSheet = document.getElementById("filters-bottom-sheet");
    els.btnSheetClose = document.getElementById("btn-sheet-close");
    els.btnSheetApply = document.getElementById("btn-sheet-apply");
    els.btnSheetClear = document.getElementById("btn-sheet-clear");
    els.sheetTitleText = document.getElementById("sheet-title-text");
    els.sheetLevelSection = document.getElementById("sheet-level-section");
    els.sheetLevelTitle = document.getElementById("sheet-level-title");
    els.sheetLevelList = document.getElementById("sheet-level-list");
    els.sheetLevelDivider = document.getElementById("sheet-level-divider");
    els.sheetScopeSection = document.getElementById("sheet-scope-section");
    els.sheetScopeTitle = document.getElementById("sheet-scope-title");
    els.sheetScopeList = document.getElementById("sheet-scope-list");
    els.sheetScopeDivider = document.getElementById("sheet-scope-divider");
    els.sheetCatSection = document.getElementById("sheet-cat-section");
    els.sheetCatTitle = document.getElementById("sheet-cat-title");
    els.sheetCatList = document.getElementById("sheet-cat-list");

    bindEvents();
    initRailStickyObserver();
    populatePersonaDropdown();
    populateManualCatalog();

    updateActiveQuestion();
    render();
  }

  function bindEvents() {
    // Language
    els.langEn.addEventListener("click", () => setLanguage("en"));
    els.langHi.addEventListener("click", () => setLanguage("hi"));

    // Persona
    els.personaSelect.addEventListener("change", (e) => {
      if (e.target.value) {
        loadPersona(e.target.value);
      }
    });

    // Reset
    els.resetBtn.addEventListener("click", resetProfile);

    // Accordion / Drawer
    els.catalogToggle.addEventListener("click", () => {
      state.accordionOpen = !state.accordionOpen;
      els.catalogContent.classList.toggle("open", state.accordionOpen);
      const isHi = state.lang === "hi";
      const span = els.catalogToggle.querySelector("span");
      if (span) {
        span.textContent = state.accordionOpen
          ? (isHi ? "बंद करें" : "Close")
          : (isHi ? "सभी संपादित करें" : "Edit all");
      }
    });

    // Tabs
    els.tabEligible.addEventListener("click", () => setTab("eligible"));
    els.tabUnknown.addEventListener("click", () => setTab("unknown"));
    els.tabIneligible.addEventListener("click", () => setTab("ineligible"));

    // Search
    els.searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      resetListScroll();
      renderSchemes();
      renderCategoriesRail();
    });

    // Clear All Filters (Desktop Rail)
    if (els.btnClearCategories) {
      els.btnClearCategories.addEventListener("click", () => {
        clearAllFilters();
      });
    }

    // Clear All Filters (Mobile Sheet)
    if (els.btnSheetClear) {
      els.btnSheetClear.addEventListener("click", () => {
        clearAllFilters();
      });
    }

    // Mobile / Tablet Bottom Sheet Toggle
    if (els.btnFiltersToggle) {
      els.btnFiltersToggle.addEventListener("click", () => openBottomSheet());
    }
    if (els.btnSheetClose) {
      els.btnSheetClose.addEventListener("click", () => closeBottomSheet());
    }
    if (els.btnSheetApply) {
      els.btnSheetApply.addEventListener("click", () => closeBottomSheet());
    }

    // Close bottom sheet on backdrop click
    if (els.filtersBottomSheet) {
      els.filtersBottomSheet.addEventListener("click", (e) => {
        if (e.target === els.filtersBottomSheet) {
          closeBottomSheet();
        }
      });
    }

    // Close bottom sheet on Escape key and return focus
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.filtersBottomSheet.classList.contains("open")) {
        closeBottomSheet();
      }
    });
  }

  function openBottomSheet() {
    els.filtersBottomSheet.classList.add("open");
    renderMobileSheetFilters();
    // Focus first checkbox for keyboard accessibility
    const firstCheck = els.filtersBottomSheet.querySelector("input[type='checkbox']");
    if (firstCheck) firstCheck.focus();
  }

  function closeBottomSheet() {
    els.filtersBottomSheet.classList.remove("open");
    if (els.btnFiltersToggle) els.btnFiltersToggle.focus();
  }

  function clearAllFilters() {
    state.selectedCategories.clear();
    state.selectedLevels.clear();
    state.selectedScopes.clear();
    resetListScroll();
    renderSchemes();
    renderCategoriesRail();
  }

  function resetListScroll() {
    state.visibleCount = 20;
    const target = document.querySelector(".results-column") || els.schemesList;
    if (target) {
      const rect = target.getBoundingClientRect();
      if (rect.top < 0) {
        window.scrollTo({ top: window.scrollY + rect.top - 80, behavior: "smooth" });
      }
    }
  }

  function updateRailStickyState() {
    if (!els.categoryRail) return;
    const headerHeight = 64;
    const railHeight = els.categoryRail.offsetHeight;
    const availableHeight = window.innerHeight - headerHeight - 48;
    const shouldBeSticky = railHeight > 0 && railHeight <= availableHeight;
    els.categoryRail.classList.toggle("is-sticky", shouldBeSticky);
  }

  let railResizeObserver = null;
  function initRailStickyObserver() {
    if (typeof ResizeObserver !== "undefined" && els.categoryRail) {
      railResizeObserver = new ResizeObserver(() => {
        updateRailStickyState();
      });
      railResizeObserver.observe(els.categoryRail);
    }
    window.addEventListener("resize", updateRailStickyState);
  }

  function setLanguage(lang) {
    state.lang = lang;
    document.body.classList.toggle("lang-hi", lang === "hi");
    els.langEn.classList.toggle("active", lang === "en");
    els.langHi.classList.toggle("active", lang === "hi");
    populatePersonaDropdown();
    populateManualCatalog();
    render();
  }

  function setTab(tab) {
    state.currentTab = tab;
    resetListScroll();
    [els.tabEligible, els.tabUnknown, els.tabIneligible].forEach((btn) =>
      btn.classList.remove("active")
    );
    if (tab === "eligible") els.tabEligible.classList.add("active");
    if (tab === "unknown") els.tabUnknown.classList.add("active");
    if (tab === "ineligible") els.tabIneligible.classList.add("active");
    renderSchemes();
    renderCategoriesRail();
  }

  function populatePersonaDropdown() {
    const isHi = state.lang === "hi";
    els.personaSelect.innerHTML = `<option value="">${
      isHi ? "नमूना प्रोफाइल चुनें..." : "Try a sample profile..."
    }</option>`;

    (window.SAMPLE_PERSONAS || []).forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = isHi ? p.name_hi : p.name_en;
      els.personaSelect.appendChild(opt);
    });
  }

  function loadPersona(id) {
    const persona = (window.SAMPLE_PERSONAS || []).find((p) => p.id === id);
    if (!persona) return;
    state.facts = JSON.parse(JSON.stringify(persona.facts));
    state.activeField = null;
    pruneUnavailableSelections();
    resetListScroll();
    updateActiveQuestion();
    render();
  }

  function resetProfile() {
    state.facts = {};
    state.activeField = null;
    state.checkedDocs.clear();
    state.selectedCategories.clear();
    state.selectedLevels.clear();
    state.selectedScopes.clear();
    resetListScroll();
    els.personaSelect.value = "";
    updateActiveQuestion();
    render();
  }

  function getFieldMeta(fieldId) {
    const fields = (window.FIELD_CATALOG && window.FIELD_CATALOG.fields) || [];
    return fields.find((f) => f.id === fieldId) || { id: fieldId, type: "string" };
  }

  function updateActiveQuestion() {
    const rules = window.ALL_RULES || [];
    const nq = window.GovEngine.nextQuestion(rules, state.facts);
    state.activeField = nq ? nq.field : null;
  }

  function pruneUnavailableSelections() {
    const rules = window.ALL_RULES || [];
    const results = window.GovEngine.evaluateAll(rules, state.facts);
    const ruleMap = new Map((rules || []).map((r) => [r.id, r]));
    const allCats = new Set();
    const allLevels = new Set();
    const allScopes = new Set();
    results.forEach((s) => {
      const orig = ruleMap.get(s.id);
      const cat = s.category || (orig && orig.category) || "";
      parseSchemeCategories(cat, s).forEach((c) => allCats.add(c));
      const lvl = getLevel(s) || (orig && getLevel(orig));
      if (lvl && lvl !== "unknown") allLevels.add(lvl);
      const sc = getScope(s) || (orig && getScope(orig));
      if (sc && sc !== "unknown") allScopes.add(sc);
    });
    for (const c of state.selectedCategories) {
      if (!allCats.has(c)) state.selectedCategories.delete(c);
    }
    for (const l of state.selectedLevels) {
      if (!allLevels.has(l)) state.selectedLevels.delete(l);
    }
    for (const sc of state.selectedScopes) {
      if (!allScopes.has(sc)) state.selectedScopes.delete(sc);
    }
  }

  function answerField(fieldId, val) {
    window.GovEngine.setPath(state.facts, fieldId, val);
    pruneUnavailableSelections();
    resetListScroll();
    updateActiveQuestion();
    render();
  }

  function clearFact(fieldId) {
    window.GovEngine.deletePath(state.facts, fieldId);
    pruneUnavailableSelections();
    resetListScroll();
    updateActiveQuestion();
    render();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Text Cleanup Helpers (Frontend Rendering Only)
  // ─────────────────────────────────────────────────────────────────────────

  function cleanBenefitText(raw) {
    if (!raw) return "";
    let clean = raw
      .replace(/\*\*(.*?)\*\*/g, "$1") // Strip bold **
      .replace(/\*(.*?)\*/g, "$1")     // Strip italic *
      .replace(/_{2}(.*?)_{2}/g, "$1") // Strip __
      .replace(/#{1,6}\s*/g, "")       // Strip markdown headers
      .replace(/^[\s-]*\d+\.\s*/gm, "")// Strip repeated leading "1. "
      .replace(/^[\s-]*[-•]\s*/gm, "") // Strip bullet markers
      .replace(/Note:\s*/gi, "")       // Strip "Note:" prefixes
      .trim();
    return clean;
  }

  function cleanDocumentSlugs(docList) {
    if (!docList || !Array.isArray(docList)) return [];
    const items = [];

    docList.forEach((raw) => {
      if (!raw || typeof raw !== "string") return;
      const splitParts = raw.split(/(?:^|\s|-)\d+[-.]\s*/).filter(Boolean);
      const partsToProcess = splitParts.length > 0 ? splitParts : [raw];

      partsToProcess.forEach((p) => {
        let cleaned = p
          .replace(/[_-]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (!cleaned || cleaned.toLowerCase() === "as required" || cleaned.toLowerCase() === "none") {
          return;
        }
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        if (!items.includes(cleaned)) {
          items.push(cleaned);
        }
      });
    });

    return items;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Evaluation & Category Counting Pipeline
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns:
   * 1. tabSchemes: all schemes in active tab matching search text (unfiltered by category)
   * 2. categoryCounts: Map<categoryName, count> from tabSchemes
   * 3. filteredSchemes: tabSchemes after category selection filter (OR logic)
   */
  function computeActiveSchemesAndCategories() {
    const rules = window.ALL_RULES || [];
    const results = window.GovEngine.evaluateAll(rules, state.facts);

    // Counts for unfiltered tab pills
    const eligibleTotal = results.filter((r) => r.result === "eligible").length;
    const unknownTotal = results.filter((r) => r.result === "unknown").length;
    const ineligibleTotal = results.filter((r) => r.result === "ineligible").length;

    // Filter by active status tab
    let inTab = results.filter((r) => r.result === state.currentTab);

    // Filter by search text
    if (state.searchQuery) {
      inTab = inTab.filter(
        (r) =>
          r.name.toLowerCase().includes(state.searchQuery) ||
          (r.benefit && r.benefit.toLowerCase().includes(state.searchQuery)) ||
          r.id.toLowerCase().includes(state.searchQuery)
      );
    }

    // Attach parsed categories, level and scope to each scheme
    const ruleMap = new Map((rules || []).map((r) => [r.id, r]));
    inTab.forEach((s) => {
      const orig = ruleMap.get(s.id);
      const cat = s.category || (orig && orig.category) || "";
      s._parsedCategories = parseSchemeCategories(cat, s);
      s._level = getLevel(s) || (orig && getLevel(orig)) || "unknown";
      s._scope = getScope(s) || (orig && getScope(orig)) || "unknown";
    });

    // Helper: category matching (OR within group, all match if none selected)
    const matchesCategory = (s) => {
      if (state.selectedCategories.size === 0) return true;
      return s._parsedCategories.some((c) => state.selectedCategories.has(c));
    };

    // Helper: level matching (OR within group, with both or neither checked everything shows)
    const matchesLevel = (s) => {
      if (state.selectedLevels.size === 0 || state.selectedLevels.size === 2) return true;
      return state.selectedLevels.has(s._level);
    };

    // Helper: scope matching (OR within group, with both or neither checked everything shows)
    const matchesScope = (s) => {
      if (state.selectedScopes.size === 0 || state.selectedScopes.size === 2) return true;
      return state.selectedScopes.has(s._scope);
    };

    // Faceted Category Counts:
    // Respects Level selection AND Scope selection and search text
    const schemesForCatCounts = inTab.filter((s) => matchesLevel(s) && matchesScope(s));
    const categoryCounts = new Map();
    schemesForCatCounts.forEach((s) => {
      s._parsedCategories.forEach((cat) => {
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      });
    });

    // Faceted Level Counts:
    // Respects Category selection AND Scope selection and search text
    const schemesForLevelCounts = inTab.filter((s) => matchesCategory(s) && matchesScope(s));
    let centralCount = 0;
    let stateCount = 0;
    schemesForLevelCounts.forEach((s) => {
      if (s._level === "central") centralCount++;
      if (s._level === "state") stateCount++;
    });

    // Total distinct levels in active tab (to determine if level group offers >1 choice)
    let totalCentralInTab = 0;
    let totalStateInTab = 0;
    inTab.forEach((s) => {
      if (s._level === "central") totalCentralInTab++;
      if (s._level === "state") totalStateInTab++;
    });
    const showLevelGroup = totalCentralInTab > 0 && totalStateInTab > 0;

    // Faceted Scope Counts:
    // Respects Category selection AND Level selection and search text
    const schemesForScopeCounts = inTab.filter((s) => matchesCategory(s) && matchesLevel(s));
    let individualCount = 0;
    let householdCount = 0;
    schemesForScopeCounts.forEach((s) => {
      if (s._scope === "individual") individualCount++;
      if (s._scope === "household") householdCount++;
    });

    // Total distinct scopes in active tab (to determine if scope group offers >1 choice)
    let totalIndividualInTab = 0;
    let totalHouseholdInTab = 0;
    inTab.forEach((s) => {
      if (s._scope === "individual") totalIndividualInTab++;
      if (s._scope === "household") totalHouseholdInTab++;
    });
    const showScopeGroup = totalIndividualInTab > 0 && totalHouseholdInTab > 0;

    // Filtered schemes: combination is AND across groups
    const filtered = inTab.filter(
      (s) => matchesCategory(s) && matchesLevel(s) && matchesScope(s)
    );

    // Active selected categories present in active tab
    const activeSelectedCategories = Array.from(state.selectedCategories).filter(
      (c) => categoryCounts.has(c) && categoryCounts.get(c) > 0
    );

    // Active selected levels present in active tab
    const activeSelectedLevels = Array.from(state.selectedLevels).filter((lvl) => {
      if (lvl === "central") return centralCount > 0 || totalCentralInTab > 0;
      if (lvl === "state") return stateCount > 0 || totalStateInTab > 0;
      return false;
    });

    // Active selected scopes present in active tab
    const activeSelectedScopes = Array.from(state.selectedScopes).filter((sc) => {
      if (sc === "individual") return individualCount > 0 || totalIndividualInTab > 0;
      if (sc === "household") return householdCount > 0 || totalHouseholdInTab > 0;
      return false;
    });

    return {
      eligibleTotal,
      unknownTotal,
      ineligibleTotal,
      totalInTab: inTab.length,
      categoryCounts,
      levelCounts: {
        central: centralCount,
        state: stateCount,
      },
      scopeCounts: {
        individual: individualCount,
        household: householdCount,
      },
      showLevelGroup,
      showScopeGroup,
      filteredSchemes: filtered,
      activeSelectedCategories,
      activeSelectedLevels,
      activeSelectedScopes,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Renderers
  // ─────────────────────────────────────────────────────────────────────────

  function render() {
    renderQuestionStepper();
    renderAnsweredFacts();
    renderSchemes();
    renderCategoriesRail();
  }

  function renderQuestionStepper() {
    const isHi = state.lang === "hi";

    if (!state.activeField) {
      els.questionBox.innerHTML = `
        <div class="empty-state-editorial" style="padding: 24px 8px; text-align: left; align-items: flex-start;">
          <div class="msg-primary" style="font-size: 16px;">
            ${isHi ? "सभी प्रमुख प्रश्नों के उत्तर दर्ज हैं" : "All key questions answered"}
          </div>
          <div class="msg-secondary" style="font-size: 13px;">
            ${isHi ? "दाईं ओर अपनी पात्र योजनाओं की समीक्षा करें।" : "Review your matching schemes on the right."}
          </div>
        </div>
      `;
      return;
    }

    const field = getFieldMeta(state.activeField);
    const label = isHi ? (field.label_hi || field.label_en) : field.label_en;
    const hint = isHi ? (field.hint_hi || field.hint_en) : field.hint_en;
    const rulesCount = field.used_by_count || (field.used_by && field.used_by.length) || 1;

    const answeredCount = Object.keys(state.facts).length;
    const progressPercent = Math.min(100, Math.max(15, answeredCount * 18));

    let controlHtml = "";

    if (field.type === "boolean") {
      controlHtml = `
        <div class="options-stack">
          <button class="btn-option-row" id="choice-yes" type="button">
            <span>${isHi ? "हाँ (लागू होता है)" : "Yes, applicable"}</span>
            <span class="radio-indicator"></span>
          </button>
          <button class="btn-option-row" id="choice-no" type="button">
            <span>${isHi ? "नहीं (लागू नहीं)" : "No, not applicable"}</span>
            <span class="radio-indicator"></span>
          </button>
        </div>
        <div class="stepper-actions" style="margin-top: 8px;">
          <button class="btn-text-skip" id="stepper-skip-btn" type="button">${isHi ? "छोड़ें (Skip)" : "Skip"}</button>
        </div>
      `;
    } else if (field.type === "enum" && field.options) {
      if (field.options.length <= 5) {
        controlHtml = `
          <div class="options-stack">
            ${field.options
              .map(
                (opt) => `
              <button class="btn-option-row stepper-option-btn" data-value="${opt.value}" type="button">
                <span>${isHi ? (opt.label_hi || opt.label_en) : opt.label_en}</span>
                <span class="radio-indicator"></span>
              </button>`
              )
              .join("")}
          </div>
          <div class="stepper-actions" style="margin-top: 8px;">
            <button class="btn-text-skip" id="stepper-skip-btn" type="button">${isHi ? "छोड़ें (Skip)" : "Skip"}</button>
          </div>
        `;
      } else {
        controlHtml = `
          <div class="select-wrapper">
            <select class="custom-select" id="stepper-enum-select">
              <option value="">${isHi ? "-- एक विकल्प चुनें --" : "-- Choose an option --"}</option>
              ${field.options
                .map(
                  (opt) => `
                <option value="${opt.value}">
                  ${isHi ? (opt.label_hi || opt.label_en) : opt.label_en}
                </option>`
                )
                .join("")}
            </select>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div class="stepper-actions">
            <button class="btn-accent" id="stepper-save-btn" type="button">${isHi ? "आगे बढ़ें" : "Save & Next"}</button>
            <button class="btn-text-skip" id="stepper-skip-btn" type="button">${isHi ? "छोड़ें (Skip)" : "Skip"}</button>
          </div>
        `;
      }
    } else if (field.type === "integer" || field.type === "number") {
      const min = field.min !== undefined ? `min="${field.min}"` : "";
      const max = field.max !== undefined ? `max="${field.max}"` : "";
      controlHtml = `
        <div style="display: flex; gap: 8px;">
          <input type="number" class="custom-input" id="stepper-num-input" ${min} ${max} placeholder="${isHi ? 'संख्या दर्ज करें...' : 'Enter value...'}" />
        </div>
        <div class="stepper-actions">
          <button class="btn-accent" id="stepper-save-btn" type="button">${isHi ? "आगे बढ़ें" : "Save & Next"}</button>
          <button class="btn-text-skip" id="stepper-skip-btn" type="button">${isHi ? "छोड़ें (Skip)" : "Skip"}</button>
        </div>
      `;
    } else {
      controlHtml = `
        <div>
          <input type="text" class="custom-input" id="stepper-text-input" placeholder="${isHi ? 'यहाँ लिखें...' : 'Type here...'}" />
        </div>
        <div class="stepper-actions">
          <button class="btn-accent" id="stepper-save-btn" type="button">${isHi ? "आगे बढ़ें" : "Save & Next"}</button>
          <button class="btn-text-skip" id="stepper-skip-btn" type="button">${isHi ? "छोड़ें (Skip)" : "Skip"}</button>
        </div>
      `;
    }

    els.questionBox.innerHTML = `
      <div class="question-stepper">
        <div class="stepper-progress-bar">
          <div class="stepper-progress-fill" style="width: ${progressPercent}%;"></div>
        </div>

        <div class="question-meta-row">
          <span>${isHi ? "प्रश्न" : "Question"}</span>
          <span>${isHi ? `प्रभाव: ${rulesCount} योजनाएँ` : `Affects ${rulesCount} schemes`}</span>
        </div>

        <h3 class="question-title">${label}</h3>
        ${hint ? `<p class="question-hint">${hint}</p>` : ""}

        <div class="input-control-box">
          ${controlHtml}
        </div>
      </div>
    `;

    // Event binding
    if (field.type === "boolean") {
      const yesBtn = document.getElementById("choice-yes");
      const noBtn = document.getElementById("choice-no");
      if (yesBtn) yesBtn.onclick = () => answerField(field.id, true);
      if (noBtn) noBtn.onclick = () => answerField(field.id, false);
    } else if (field.type === "enum" && field.options && field.options.length <= 5) {
      els.questionBox.querySelectorAll(".stepper-option-btn").forEach((btn) => {
        btn.onclick = () => {
          const val = btn.getAttribute("data-value");
          answerField(field.id, val);
        };
      });
    } else {
      const saveBtn = document.getElementById("stepper-save-btn");
      if (saveBtn) {
        saveBtn.onclick = () => {
          if (field.type === "enum") {
            const sel = document.getElementById("stepper-enum-select");
            if (sel && sel.value) answerField(field.id, sel.value);
          } else if (field.type === "integer" || field.type === "number") {
            const inp = document.getElementById("stepper-num-input");
            if (inp && inp.value !== "") answerField(field.id, Number(inp.value));
          } else {
            const inp = document.getElementById("stepper-text-input");
            if (inp && inp.value.trim() !== "") answerField(field.id, inp.value.trim());
          }
        };
      }
    }

    const skipBtn = document.getElementById("stepper-skip-btn");
    if (skipBtn) {
      skipBtn.onclick = () => {
        const rules = window.ALL_RULES || [];
        const next = window.GovEngine.nextQuestion(rules, {
          ...state.facts,
          [field.id]: null,
        });
        if (next && next.field !== field.id) {
          state.activeField = next.field;
          render();
        } else {
          state.activeField = null;
          render();
        }
      };
    }
  }

  function flattenFacts(obj, prefix = "") {
    let result = [];
    for (const [key, val] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (val !== null && typeof val === "object" && !Array.isArray(val)) {
        result = result.concat(flattenFacts(val, path));
      } else {
        result.push({ path, value: val });
      }
    }
    return result;
  }

  function renderAnsweredFacts() {
    const isHi = state.lang === "hi";
    const flat = flattenFacts(state.facts);

    els.factsCount.textContent = `(${flat.length})`;

    if (flat.length === 0) {
      els.factsList.innerHTML = `
        <div style="font-size: 13px; color: var(--text-muted); padding: 8px 0;">
          ${isHi ? "अभी तक कोई उत्तर नहीं दिया गया है।" : "No answers provided yet."}
        </div>
      `;
      return;
    }

    els.factsList.innerHTML = flat
      .map(({ path, value }) => {
        const meta = getFieldMeta(path);
        let displayVal = value;
        if (typeof value === "boolean") {
          displayVal = value ? (isHi ? "हाँ" : "Yes") : (isHi ? "नहीं" : "No");
        } else if (meta.options) {
          const opt = meta.options.find((o) => o.value === value);
          if (opt) displayVal = isHi ? (opt.label_hi || opt.label_en) : opt.label_en;
        }

        const labelShort = (isHi ? (meta.label_hi || meta.label_en || path) : (meta.label_en || path))
          .replace(/\?.*/, "")
          .replace("What is your ", "")
          .replace("Do you ", "");

        return `
          <div class="def-row">
            <span class="def-label" title="${path}">${labelShort}</span>
            <div class="def-val-wrap">
              <span class="def-value">${displayVal}</span>
              <button class="btn-remove-fact del-btn" title="Remove" data-field="${path}" aria-label="Remove answer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    els.factsList.querySelectorAll(".del-btn").forEach((btn) => {
      btn.onclick = (e) => {
        const field = e.currentTarget.getAttribute("data-field");
        clearFact(field);
      };
    });
  }

  function populateManualCatalog() {
    const isHi = state.lang === "hi";
    const fields = (window.FIELD_CATALOG && window.FIELD_CATALOG.fields) || [];

    const categories = {
      [isHi ? "व्यक्तिगत विवरण" : "Personal & Demographics"]: [
        "age", "gender", "marital_status", "has_bank_account", "has_aadhaar",
        "has_aadhaar_linked_bank_account", "has_mobile", "is_destitute"
      ],
      [isHi ? "पारिवारिक व आवास" : "Household & Living"]: [
        "household.state", "household.area_type", "household.bpl", "household.income",
        "household.owns_pucca_house", "household.house_type", "household.rooms",
        "household.has_lpg", "household.ration_card_type", "household.is_sc_st"
      ],
      [isHi ? "व्यवसाय व भूमि" : "Occupation & Land"]: [
        "is_unorganised_worker", "monthly_income", "is_street_vendor", "vendor_status",
        "household.owns_cultivable_land", "owns_land_in_own_name", "land_hectares",
        "wants_business_loan", "is_loan_defaulter"
      ],
      [isHi ? "स्वास्थ्य व विशेष श्रेणी" : "Health & Special Status"]: [
        "has_disability", "disability_percent", "has_serious_disease",
        "household.special_vulnerable_group", "is_orphan", "is_transgender"
      ]
    };

    let html = "";
    for (const [groupName, fieldIds] of Object.entries(categories)) {
      html += `<div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; color: var(--text-faint); margin: 12px 0 6px;">${groupName}</div>`;
      for (const fid of fieldIds) {
        const f = fields.find((item) => item.id === fid);
        if (!f) continue;
        const currentVal = window.GovEngine.resolvePath(state.facts, fid);
        const label = isHi ? (f.label_hi || f.label_en) : f.label_en;

        let inputHtml = "";
        if (f.type === "boolean") {
          inputHtml = `
            <select class="custom-select" data-cat-field="${fid}" style="padding: 4px 8px; font-size: 12px; min-height: 32px;">
              <option value="" ${currentVal === undefined ? "selected" : ""}>--</option>
              <option value="true" ${currentVal === true ? "selected" : ""}>${isHi ? "हाँ" : "Yes"}</option>
              <option value="false" ${currentVal === false ? "selected" : ""}>${isHi ? "नहीं" : "No"}</option>
            </select>
          `;
        } else if (f.type === "enum" && f.options) {
          inputHtml = `
            <select class="custom-select" data-cat-field="${fid}" style="padding: 4px 8px; font-size: 12px; min-height: 32px;">
              <option value="">--</option>
              ${f.options
                .map(
                  (opt) => `
                <option value="${opt.value}" ${currentVal === opt.value ? "selected" : ""}>
                  ${isHi ? (opt.label_hi || opt.label_en) : opt.label_en}
                </option>`
                )
                .join("")}
            </select>
          `;
        } else {
          inputHtml = `
            <input type="${f.type === "integer" || f.type === "number" ? "number" : "text"}"
              class="custom-input" data-cat-field="${fid}"
              value="${currentVal !== undefined && currentVal !== null ? currentVal : ""}"
              placeholder="--" style="padding: 4px 8px; font-size: 12px; min-height: 32px;" />
          `;
        }

        html += `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
            <label style="font-size: 12px; color: var(--text-muted); flex: 1; margin: 0;">${label.replace(/\?.*/, "")}</label>
            <div style="width: 120px;">${inputHtml}</div>
          </div>
        `;
      }
    }

    els.catalogContent.innerHTML = html;

    els.catalogContent.querySelectorAll("[data-cat-field]").forEach((input) => {
      input.addEventListener("change", (e) => {
        const fid = e.target.getAttribute("data-cat-field");
        const f = fields.find((item) => item.id === fid);
        let val = e.target.value;

        if (val === "") {
          clearFact(fid);
          return;
        }

        if (f && f.type === "boolean") {
          val = val === "true";
        } else if (f && (f.type === "integer" || f.type === "number")) {
          val = Number(val);
        }

        answerField(fid, val);
      });
    });
  }

  function renderSchemes() {
    const isHi = state.lang === "hi";

    // Run active pipeline
    const {
      eligibleTotal,
      unknownTotal,
      ineligibleTotal,
      totalInTab,
      filteredSchemes,
      activeSelectedCategories,
      activeSelectedLevels,
      activeSelectedScopes,
    } = computeActiveSchemesAndCategories();

    // Update tab counts (stays unfiltered totals)
    els.countEligible.textContent = eligibleTotal;
    els.countUnknown.textContent = unknownTotal;
    els.countIneligible.textContent = ineligibleTotal;

    const activeFilterCount =
      activeSelectedCategories.length +
      activeSelectedLevels.length +
      activeSelectedScopes.length;

    // Update summary line
    const filteredCount = filteredSchemes.length;
    let summaryText = "";
    if (activeFilterCount > 0 || state.searchQuery) {
      summaryText = isHi
        ? `${totalInTab} में से ${filteredCount} योजनाएँ`
        : `${filteredCount} of ${totalInTab} schemes`;
    } else {
      summaryText = isHi ? `${totalInTab} योजनाएँ` : `${totalInTab} schemes`;
    }
    els.resultsSummary.textContent = summaryText;

    // Update selected filter chips (categories, levels & scopes)
    renderSelectedChips(
      activeSelectedCategories,
      activeSelectedLevels,
      activeSelectedScopes
    );

    // Update mobile/tablet filters toggle badge
    if (els.filtersBadge) {
      if (activeFilterCount > 0) {
        els.filtersBadge.textContent = activeFilterCount;
        els.filtersBadge.style.display = "inline-block";
      } else {
        els.filtersBadge.style.display = "none";
      }
    }

    // Update mobile sheet apply button label
    if (els.btnSheetApply) {
      els.btnSheetApply.textContent = isHi
        ? `${filteredCount} योजनाएँ दिखाएं`
        : `Show ${filteredCount} schemes`;
    }

    // Initial zero profile answers state
    const hasAnyFacts = Object.keys(state.facts).length > 0;
    const mainLayout = document.querySelector(".main-layout");
    const filterWrap = document.querySelector(".filters-toggle-wrap");

    if (!hasAnyFacts && state.currentTab === "eligible" && !state.searchQuery && activeFilterCount === 0) {
      els.resultsSummary.textContent = "";
      els.categoryChips.innerHTML = "";
      if (els.categoryRail) els.categoryRail.style.display = "none";
      if (filterWrap) filterWrap.style.display = "none";
      if (mainLayout) mainLayout.classList.add("no-rail");

      els.schemesList.innerHTML = `
        <div class="empty-state-editorial">
          <div class="msg-primary">
            ${isHi ? "अपनी पात्रता जाँचने के लिए कुछ प्रश्नों के उत्तर दें" : "Answer a few questions to see your matches"}
          </div>
          <div class="msg-secondary">
            ${isHi ? "बाईं ओर दिए गए प्रश्नों से शुरुआत करें या ऊपर से कोई नमूना प्रोफाइल चुनें।" : "Start with the questionnaire on the left, or select a sample profile above."}
          </div>
          <button class="link-quiet" id="btn-browse-anyway" style="margin-top: 12px;" type="button">
            ${isHi ? "या सभी संभावित योजनाएँ देखें" : "Or browse all schemes anyway"}
          </button>
        </div>
      `;
      const browseBtn = document.getElementById("btn-browse-anyway");
      if (browseBtn) {
        browseBtn.onclick = () => {
          state.facts = { _browsing: true };
          resetListScroll();
          renderSchemes();
          renderCategoriesRail();
        };
      }
      return;
    }

    // When facts are present, ensure category rail and filter toggles are shown
    if (els.categoryRail) els.categoryRail.style.display = "";
    if (filterWrap) filterWrap.style.display = "";
    if (mainLayout) mainLayout.classList.remove("no-rail");

    // Empty state when no schemes match filters
    if (filteredCount === 0) {
      const isFiltered = activeFilterCount > 0 || Boolean(state.searchQuery);
      els.schemesList.innerHTML = `
        <div class="empty-state-editorial">
          <div class="msg-primary">
            ${isHi ? "इस फ़िल्टर से कोई योजना नहीं मिली" : "No schemes match these filters"}
          </div>
          <div class="msg-secondary">
            ${isFiltered
              ? (isHi ? "चयनित फ़िल्टर या खोज शब्दों को हटाएं।" : "Try clearing selected filters or search terms.")
              : (isHi ? "अन्य टैब देखें या अधिक विवरण प्रदान करें।" : "Check other status tabs or answer more questions.")}
          </div>
          ${isFiltered ? `
            <button class="btn-accent" id="btn-empty-clear-filters" style="margin-top: 14px;" type="button">
              ${isHi ? "सभी फ़िल्टर हटाएं" : "Clear filters"}
            </button>
          ` : ""}
        </div>
      `;
      const emptyClearBtn = document.getElementById("btn-empty-clear-filters");
      if (emptyClearBtn) {
        emptyClearBtn.onclick = () => clearAllFilters();
      }
      return;
    }

    // Pagination: slice visibleBatch
    const visibleBatch = filteredSchemes.slice(0, state.visibleCount);
    const hasMore = filteredCount > state.visibleCount;

    let html = visibleBatch
      .map((scheme) => {
        const isEligible = scheme.result === "eligible";
        const isUnknown = scheme.result === "unknown";

        // Status indicator (6px dot + text)
        let statusHtml = "";
        if (isEligible) {
          statusHtml = `
            <div class="status-indicator">
              <span class="status-dot eligible"></span>
              <span class="status-label eligible">${isHi ? "पात्र (Eligible)" : "Eligible"}</span>
            </div>
          `;
        } else if (isUnknown) {
          statusHtml = `
            <div class="status-indicator">
              <span class="status-dot unknown"></span>
              <span class="status-label unknown">${
                isHi
                  ? `${scheme.missingFields.length} उत्तर चाहिए`
                  : `Needs ${scheme.missingFields.length} more answers`
              }</span>
            </div>
          `;
        } else {
          statusHtml = `
            <div class="status-indicator">
              <span class="status-dot ineligible"></span>
              <span class="status-label ineligible">${isHi ? "अपात्र (Ineligible)" : "Ineligible"}</span>
            </div>
          `;
        }

        // Cleaned benefit text & 2-line clamp toggle
        const cleanedBenefit = cleanBenefitText(scheme.benefit);
        const isExpanded = state.expandedBenefits.has(scheme.id);
        let benefitHtml = "";
        if (cleanedBenefit) {
          benefitHtml = `
            <div class="scheme-benefit-text ${isExpanded ? "" : "clamped"}" id="benefit-${scheme.id}">
              ${cleanedBenefit}
            </div>
            ${cleanedBenefit.length > 140 ? `
              <button class="btn-read-more" data-toggle-benefit="${scheme.id}" type="button">
                ${isExpanded ? (isHi ? "संक्षेप में देखें" : "Show less") : (isHi ? "अधिक पढ़ें" : "Read more")}
              </button>
            ` : ""}
          `;
        }

        // Missing fields prompt
        let missingHtml = "";
        if (isUnknown && scheme.missingFields.length > 0) {
          missingHtml = `
            <div class="missing-box">
              <span class="missing-box-title">${isHi ? "पात्रता पुष्टि के लिए आवश्यक जानकारी:" : "Required to determine eligibility:"}</span>
              <div class="missing-chips-flow">
                ${scheme.missingFields
                  .map((fid) => {
                    const fmeta = getFieldMeta(fid);
                    const label = isHi ? (fmeta.label_hi || fmeta.label_en || fid) : (fmeta.label_en || fid);
                    return `<button class="missing-btn" data-focus-field="${fid}" type="button">+ ${label.replace(/\?.*/, "")}</button>`;
                  })
                  .join("")}
              </div>
            </div>
          `;
        }

        // Documents disclosure (collapsed by default)
        const cleanedDocs = cleanDocumentSlugs(scheme.documents);
        let docsHtml = "";
        if (cleanedDocs.length > 0) {
          const isDocOpen = state.openDocDisclosures.has(scheme.id);
          docsHtml = `
            <div class="docs-disclosure">
              <button class="docs-toggle" data-toggle-docs="${scheme.id}" type="button">
                <span>${cleanedDocs.length} ${isHi ? "आवश्यक दस्तावेज" : "documents needed"}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="transform: ${isDocOpen ? 'rotate(180deg)' : 'none'}; transition: transform var(--transition-fast);"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              <div class="docs-content ${isDocOpen ? 'open' : ''}">
                ${cleanedDocs
                  .map((docTitle, idx) => {
                    const docKey = `${scheme.id}:${idx}`;
                    const isChecked = state.checkedDocs.has(docKey);
                    return `
                      <label class="doc-check-row ${isChecked ? "checked" : ""}">
                        <input type="checkbox" data-doc="${docKey}" ${isChecked ? "checked" : ""} />
                        <span>${docTitle}</span>
                      </label>
                    `;
                  })
                  .join("")}
              </div>
            </div>
          `;
        }

        // Action links
        let actionsHtml = "";
        if (scheme.links && (scheme.links.info || scheme.links.apply)) {
          actionsHtml = `
            <div class="scheme-actions-row">
              ${
                scheme.links.info
                  ? `<a href="${scheme.links.info}" target="_blank" rel="noopener noreferrer" class="link-official-info">
                      <span>${isHi ? "आधिकारिक जानकारी" : "Official info"}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                    </a>`
                  : ""
              }
              ${
                scheme.links.apply
                  ? `<a href="${scheme.links.apply}" target="_blank" rel="noopener noreferrer" class="btn-apply-solid">
                      <span>${isHi ? "ऑनलाइन आवेदन" : "Apply online"}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                    </a>`
                  : ""
              }
            </div>
          `;
        }

        // Format metadata line
        const levelLabel = scheme.level ? scheme.level.charAt(0).toUpperCase() + scheme.level.slice(1) : "Central";
        const scopeLabel = scheme.scope === "household" ? (isHi ? "परिवार के लिए" : "For households") : (isHi ? "व्यक्तिगत" : "For individuals");
        const stateLabel = scheme.state ? ` · ${scheme.state}` : "";

        return `
          <div class="scheme-row status-${scheme.result}">
            <div class="scheme-row-head">
              <div class="scheme-heading-block">
                <h3 class="scheme-row-title">${scheme.name}</h3>
                <div class="scheme-meta-line">
                  <span>${levelLabel}${stateLabel} · ${scopeLabel}</span>
                </div>
              </div>
              <div>${statusHtml}</div>
            </div>

            ${benefitHtml}
            ${missingHtml}
            ${docsHtml}
            ${actionsHtml}
          </div>
        `;
      })
      .join("");

    if (hasMore) {
      html += `
        <div class="show-more-wrap">
          <button class="btn-show-more" id="btn-show-more" type="button">
            ${isHi
              ? `और दिखाएं (${visibleBatch.length} / ${filteredCount})`
              : `Show more schemes (${visibleBatch.length} of ${filteredCount})`}
          </button>
        </div>
      `;
    }

    els.schemesList.innerHTML = html;

    // Event handlers
    const showMoreBtn = document.getElementById("btn-show-more");
    if (showMoreBtn) {
      showMoreBtn.onclick = () => {
        state.visibleCount += 30;
        renderSchemes();
      };
    }

    els.schemesList.querySelectorAll("[data-focus-field]").forEach((btn) => {
      btn.onclick = (e) => {
        const fid = e.currentTarget.getAttribute("data-focus-field");
        state.activeField = fid;
        renderQuestionStepper();
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    });

    els.schemesList.querySelectorAll("[data-toggle-benefit]").forEach((btn) => {
      btn.onclick = (e) => {
        const sid = e.currentTarget.getAttribute("data-toggle-benefit");
        if (state.expandedBenefits.has(sid)) {
          state.expandedBenefits.delete(sid);
        } else {
          state.expandedBenefits.add(sid);
        }
        renderSchemes();
      };
    });

    els.schemesList.querySelectorAll("[data-toggle-docs]").forEach((btn) => {
      btn.onclick = (e) => {
        const sid = e.currentTarget.getAttribute("data-toggle-docs");
        if (state.openDocDisclosures.has(sid)) {
          state.openDocDisclosures.delete(sid);
        } else {
          state.openDocDisclosures.add(sid);
        }
        renderSchemes();
      };
    });

    els.schemesList.querySelectorAll("input[data-doc]").forEach((chk) => {
      chk.onchange = (e) => {
        const docKey = e.target.getAttribute("data-doc");
        if (e.target.checked) {
          state.checkedDocs.add(docKey);
        } else {
          state.checkedDocs.delete(docKey);
        }
        e.target.closest(".doc-check-row").classList.toggle("checked", e.target.checked);
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Selected Category Chips
  // ─────────────────────────────────────────────────────────────────────────

  function renderSelectedChips(
    activeSelectedCategories,
    activeSelectedLevels,
    activeSelectedScopes
  ) {
    const isHi = state.lang === "hi";
    const chips = [];

    // 1. Level chips
    (activeSelectedLevels || []).forEach((lvl) => {
      const label = lvl === "central" 
        ? (isHi ? "केंद्रीय" : "Central")
        : (isHi ? "राज्य" : "State");
      chips.push({ type: "level", key: lvl, label });
    });

    // 2. Scope / Beneficiary chips
    (activeSelectedScopes || []).forEach((sc) => {
      const label = sc === "individual"
        ? (isHi ? "व्यक्तिगत" : "Individual")
        : (isHi ? "परिवार" : "Household");
      chips.push({ type: "scope", key: sc, label });
    });

    // 3. Category chips
    (activeSelectedCategories || []).forEach((cat) => {
      const label = isHi ? (CATEGORY_NAMES_HI[cat] || cat) : cat;
      chips.push({ type: "cat", key: cat, label });
    });

    if (chips.length === 0) {
      els.categoryChips.innerHTML = "";
      return;
    }

    els.categoryChips.innerHTML = chips
      .map((chip) => {
        return `
          <span class="cat-chip">
            <span>${chip.label}</span>
            <button class="cat-chip-remove" data-remove-type="${chip.type}" data-remove-key="${chip.key}" type="button" aria-label="${isHi ? 'फ़िल्टर हटाएं' : 'Remove filter'}: ${chip.label}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </span>
        `;
      })
      .join("");

    els.categoryChips.querySelectorAll("[data-remove-type]").forEach((btn) => {
      btn.onclick = (e) => {
        const type = e.currentTarget.getAttribute("data-remove-type");
        const key = e.currentTarget.getAttribute("data-remove-key");
        if (type === "level") {
          state.selectedLevels.delete(key);
        } else if (type === "scope") {
          state.selectedScopes.delete(key);
        } else {
          state.selectedCategories.delete(key);
        }
        resetListScroll();
        renderSchemes();
        renderCategoriesRail();
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Category, Level & Scope Rail Renderer (Desktop Right Column & Mobile Sheet)
  // ─────────────────────────────────────────────────────────────────────────

  function renderCategoriesRail() {
    const isHi = state.lang === "hi";
    const hasAnyFacts = Object.keys(state.facts).length > 0;
    const mainLayout = document.querySelector(".main-layout");
    const filterWrap = document.querySelector(".filters-toggle-wrap");

    // Hide rail on start until user answers questions or browses
    if (
      !hasAnyFacts &&
      state.currentTab === "eligible" &&
      !state.searchQuery &&
      state.selectedCategories.size === 0 &&
      state.selectedLevels.size === 0 &&
      state.selectedScopes.size === 0
    ) {
      if (els.categoryRail) els.categoryRail.style.display = "none";
      if (filterWrap) filterWrap.style.display = "none";
      if (mainLayout) mainLayout.classList.add("no-rail");
      return;
    }

    if (els.categoryRail) els.categoryRail.style.display = "";
    if (filterWrap) filterWrap.style.display = "";
    if (mainLayout) mainLayout.classList.remove("no-rail");

    if (els.catRailTitle) {
      els.catRailTitle.textContent = isHi ? "श्रेणी के अनुसार फ़िल्टर करें" : "Filter by Category";
    }
    if (els.levelRailTitle) {
      els.levelRailTitle.textContent = isHi ? "योजना स्तर" : "Scheme Level";
    }
    if (els.scopeRailTitle) {
      els.scopeRailTitle.textContent = isHi ? "लाभार्थी" : "Beneficiary";
    }

    const {
      categoryCounts,
      levelCounts,
      scopeCounts,
      showLevelGroup,
      showScopeGroup,
      activeSelectedCategories,
      activeSelectedLevels,
      activeSelectedScopes,
    } = computeActiveSchemesAndCategories();

    // Show/hide Clear all button
    const hasAnySelection =
      activeSelectedCategories.length > 0 ||
      activeSelectedLevels.length > 0 ||
      activeSelectedScopes.length > 0;

    if (els.btnClearCategories) {
      els.btnClearCategories.style.display = hasAnySelection ? "inline-block" : "none";
      els.btnClearCategories.textContent = isHi ? "सभी हटाएं" : "Clear all";
    }
    if (els.btnSheetClear) {
      els.btnSheetClear.style.display = hasAnySelection ? "inline-block" : "none";
      els.btnSheetClear.textContent = isHi ? "सभी हटाएं" : "Clear all";
    }

    // 1. Render Categories Section
    const entries = Array.from(categoryCounts.entries()).filter(([cat, count]) => count > 0);
    entries.sort(([aCat, aCount], [bCat, bCount]) => {
      if (aCat === "Other") return 1;
      if (bCat === "Other") return -1;
      return bCount - aCount || aCat.localeCompare(bCat);
    });

    if (entries.length === 0) {
      els.categoryListContainer.innerHTML = `
        <div style="font-size: 13px; color: var(--text-muted); padding: 8px 0;">
          ${isHi ? "कोई श्रेणी उपलब्ध नहीं है।" : "No categories available."}
        </div>
      `;
    } else {
      // Top 10 categories
      const limit = state.showAllCategories ? entries.length : 10;
      const visibleEntries = entries.slice(0, limit);
      const hasMoreThan10 = entries.length > 10;

      const itemsHtml = visibleEntries
        .map(([cat, count]) => {
          const isChecked = state.selectedCategories.has(cat);
          const label = isHi ? (CATEGORY_NAMES_HI[cat] || cat) : cat;
          const inputId = `cat-chk-${cat.replace(/[^a-zA-Z0-9]/g, "-")}`;

          return `
            <label class="cat-check-row" for="${inputId}">
              <input type="checkbox" id="${inputId}" class="cat-checkbox-native" data-category="${cat}" ${isChecked ? "checked" : ""} />
              <span class="cat-checkbox-custom" aria-hidden="true">
                <svg class="cat-check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
              <span class="cat-label-text">${label}</span>
              <span class="cat-count-badge">${count}</span>
            </label>
          `;
        })
        .join("");

      let toggleBtnHtml = "";
      if (hasMoreThan10) {
        const remaining = entries.length - 10;
        toggleBtnHtml = `
          <button class="btn-toggle-more-cats" id="btn-toggle-more-cats" type="button">
            ${state.showAllCategories
              ? (isHi ? "कम दिखाएं" : "Show less")
              : (isHi ? `${remaining} और श्रेणियाँ देखें` : `Show ${remaining} more`)}
          </button>
        `;
      }

      els.categoryListContainer.innerHTML = itemsHtml + toggleBtnHtml;

      // Event handlers for category checkboxes
      els.categoryListContainer.querySelectorAll("input[data-category]").forEach((chk) => {
        chk.onchange = (e) => {
          const cat = e.target.getAttribute("data-category");
          if (e.target.checked) {
            state.selectedCategories.add(cat);
          } else {
            state.selectedCategories.delete(cat);
          }
          resetListScroll();
          renderSchemes();
          renderCategoriesRail();
        };
      });

      const toggleBtn = document.getElementById("btn-toggle-more-cats");
      if (toggleBtn) {
        toggleBtn.onclick = () => {
          state.showAllCategories = !state.showAllCategories;
          renderCategoriesRail();
        };
      }
    }

    // 2. Render Scheme Level Section (Below category list)
    if (!showLevelGroup) {
      if (els.railLevelDivider) els.railLevelDivider.style.display = "none";
      if (els.levelRailSection) els.levelRailSection.style.display = "none";
    } else {
      if (els.railLevelDivider) els.railLevelDivider.style.display = "";
      if (els.levelRailSection) els.levelRailSection.style.display = "";

      const levelOptions = [];
      if (levelCounts.central > 0) {
        levelOptions.push({
          key: "central",
          label: isHi ? "केंद्र सरकार की योजनाएँ" : "Central schemes",
          count: levelCounts.central,
        });
      }
      if (levelCounts.state > 0) {
        levelOptions.push({
          key: "state",
          label: isHi ? "राज्य सरकार की योजनाएँ" : "State schemes",
          count: levelCounts.state,
        });
      }

      els.levelListContainer.innerHTML = levelOptions
        .map((opt) => {
          const isChecked = state.selectedLevels.has(opt.key);
          const inputId = `level-chk-${opt.key}`;
          return `
            <label class="cat-check-row" for="${inputId}">
              <input type="checkbox" id="${inputId}" class="cat-checkbox-native" data-level="${opt.key}" ${isChecked ? "checked" : ""} />
              <span class="cat-checkbox-custom" aria-hidden="true">
                <svg class="cat-check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
              <span class="cat-label-text">${opt.label}</span>
              <span class="cat-count-badge">${opt.count}</span>
            </label>
          `;
        })
        .join("");

      els.levelListContainer.querySelectorAll("input[data-level]").forEach((chk) => {
        chk.onchange = (e) => {
          const lvl = e.target.getAttribute("data-level");
          if (e.target.checked) {
            state.selectedLevels.add(lvl);
          } else {
            state.selectedLevels.delete(lvl);
          }
          resetListScroll();
          renderSchemes();
          renderCategoriesRail();
        };
      });
    }

    // 3. Render Scheme Scope / Beneficiary Section (Below level list)
    if (!showScopeGroup) {
      if (els.railScopeDivider) els.railScopeDivider.style.display = "none";
      if (els.scopeRailSection) els.scopeRailSection.style.display = "none";
    } else {
      if (els.railScopeDivider) els.railScopeDivider.style.display = "";
      if (els.scopeRailSection) els.scopeRailSection.style.display = "";

      const scopeOptions = [];
      if (scopeCounts.individual > 0) {
        scopeOptions.push({
          key: "individual",
          label: isHi ? "व्यक्तिगत योजनाएँ" : "Individual schemes",
          count: scopeCounts.individual,
        });
      }
      if (scopeCounts.household > 0) {
        scopeOptions.push({
          key: "household",
          label: isHi ? "पारिवारिक योजनाएँ" : "Household schemes",
          count: scopeCounts.household,
        });
      }

      els.scopeListContainer.innerHTML = scopeOptions
        .map((opt) => {
          const isChecked = state.selectedScopes.has(opt.key);
          const inputId = `scope-chk-${opt.key}`;
          return `
            <label class="cat-check-row" for="${inputId}">
              <input type="checkbox" id="${inputId}" class="cat-checkbox-native" data-scope="${opt.key}" ${isChecked ? "checked" : ""} />
              <span class="cat-checkbox-custom" aria-hidden="true">
                <svg class="cat-check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
              <span class="cat-label-text">${opt.label}</span>
              <span class="cat-count-badge">${opt.count}</span>
            </label>
          `;
        })
        .join("");

      els.scopeListContainer.querySelectorAll("input[data-scope]").forEach((chk) => {
        chk.onchange = (e) => {
          const sc = e.target.getAttribute("data-scope");
          if (e.target.checked) {
            state.selectedScopes.add(sc);
          } else {
            state.selectedScopes.delete(sc);
          }
          resetListScroll();
          renderSchemes();
          renderCategoriesRail();
        };
      });
    }

    updateRailStickyState();
  }

  function renderMobileSheetFilters() {
    const isHi = state.lang === "hi";
    if (els.sheetTitleText) {
      els.sheetTitleText.textContent = isHi ? "फ़िल्टर" : "Filters";
    }
    if (els.sheetLevelTitle) {
      els.sheetLevelTitle.textContent = isHi ? "योजना स्तर" : "Scheme Level";
    }
    if (els.sheetScopeTitle) {
      els.sheetScopeTitle.textContent = isHi ? "लाभार्थी" : "Beneficiary";
    }
    if (els.sheetCatTitle) {
      els.sheetCatTitle.textContent = isHi ? "श्रेणी के अनुसार फ़िल्टर करें" : "Filter by Category";
    }

    const {
      categoryCounts,
      levelCounts,
      scopeCounts,
      showLevelGroup,
      showScopeGroup,
    } = computeActiveSchemesAndCategories();

    // 1. Render Scheme Level FIRST
    if (!showLevelGroup) {
      if (els.sheetLevelSection) els.sheetLevelSection.style.display = "none";
      if (els.sheetLevelDivider) els.sheetLevelDivider.style.display = "none";
    } else {
      if (els.sheetLevelSection) els.sheetLevelSection.style.display = "";
      if (els.sheetLevelDivider) els.sheetLevelDivider.style.display = "";

      const levelOptions = [];
      if (levelCounts.central > 0) {
        levelOptions.push({
          key: "central",
          label: isHi ? "केंद्र सरकार की योजनाएँ" : "Central schemes",
          count: levelCounts.central,
        });
      }
      if (levelCounts.state > 0) {
        levelOptions.push({
          key: "state",
          label: isHi ? "राज्य सरकार की योजनाएँ" : "State schemes",
          count: levelCounts.state,
        });
      }

      els.sheetLevelList.innerHTML = levelOptions
        .map((opt) => {
          const isChecked = state.selectedLevels.has(opt.key);
          const inputId = `sheet-lvl-${opt.key}`;
          return `
            <label class="cat-check-row" for="${inputId}">
              <input type="checkbox" id="${inputId}" class="cat-checkbox-native" data-sheet-level="${opt.key}" ${isChecked ? "checked" : ""} />
              <span class="cat-checkbox-custom" aria-hidden="true">
                <svg class="cat-check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
              <span class="cat-label-text">${opt.label}</span>
              <span class="cat-count-badge">${opt.count}</span>
            </label>
          `;
        })
        .join("");

      els.sheetLevelList.querySelectorAll("input[data-sheet-level]").forEach((chk) => {
        chk.onchange = (e) => {
          const lvl = e.target.getAttribute("data-sheet-level");
          if (e.target.checked) {
            state.selectedLevels.add(lvl);
          } else {
            state.selectedLevels.delete(lvl);
          }
          resetListScroll();
          renderSchemes();
          renderCategoriesRail();
        };
      });
    }

    // 2. Render Scheme Scope / Beneficiary SECOND
    if (!showScopeGroup) {
      if (els.sheetScopeSection) els.sheetScopeSection.style.display = "none";
      if (els.sheetScopeDivider) els.sheetScopeDivider.style.display = "none";
    } else {
      if (els.sheetScopeSection) els.sheetScopeSection.style.display = "";
      if (els.sheetScopeDivider) els.sheetScopeDivider.style.display = "";

      const scopeOptions = [];
      if (scopeCounts.individual > 0) {
        scopeOptions.push({
          key: "individual",
          label: isHi ? "व्यक्तिगत योजनाएँ" : "Individual schemes",
          count: scopeCounts.individual,
        });
      }
      if (scopeCounts.household > 0) {
        scopeOptions.push({
          key: "household",
          label: isHi ? "पारिवारिक योजनाएँ" : "Household schemes",
          count: scopeCounts.household,
        });
      }

      els.sheetScopeList.innerHTML = scopeOptions
        .map((opt) => {
          const isChecked = state.selectedScopes.has(opt.key);
          const inputId = `sheet-scope-${opt.key}`;
          return `
            <label class="cat-check-row" for="${inputId}">
              <input type="checkbox" id="${inputId}" class="cat-checkbox-native" data-sheet-scope="${opt.key}" ${isChecked ? "checked" : ""} />
              <span class="cat-checkbox-custom" aria-hidden="true">
                <svg class="cat-check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
              <span class="cat-label-text">${opt.label}</span>
              <span class="cat-count-badge">${opt.count}</span>
            </label>
          `;
        })
        .join("");

      els.sheetScopeList.querySelectorAll("input[data-sheet-scope]").forEach((chk) => {
        chk.onchange = (e) => {
          const sc = e.target.getAttribute("data-sheet-scope");
          if (e.target.checked) {
            state.selectedScopes.add(sc);
          } else {
            state.selectedScopes.delete(sc);
          }
          resetListScroll();
          renderSchemes();
          renderCategoriesRail();
        };
      });
    }

    // 3. Render Categories THIRD
    const entries = Array.from(categoryCounts.entries()).filter(([cat, count]) => count > 0);
    entries.sort(([aCat, aCount], [bCat, bCount]) => {
      if (aCat === "Other") return 1;
      if (bCat === "Other") return -1;
      return bCount - aCount || aCat.localeCompare(bCat);
    });

    if (entries.length === 0) {
      els.sheetCatList.innerHTML = `
        <div style="font-size: 13px; color: var(--text-muted); padding: 16px 0; text-align: center;">
          ${isHi ? "कोई श्रेणी उपलब्ध नहीं है।" : "No categories available."}
        </div>
      `;
    } else {
      els.sheetCatList.innerHTML = entries
        .map(([cat, count]) => {
          const isChecked = state.selectedCategories.has(cat);
          const label = isHi ? (CATEGORY_NAMES_HI[cat] || cat) : cat;
          const inputId = `sheet-chk-${cat.replace(/[^a-zA-Z0-9]/g, "-")}`;

          return `
            <label class="cat-check-row" for="${inputId}">
              <input type="checkbox" id="${inputId}" class="cat-checkbox-native" data-sheet-category="${cat}" ${isChecked ? "checked" : ""} />
              <span class="cat-checkbox-custom" aria-hidden="true">
                <svg class="cat-check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
              <span class="cat-label-text">${label}</span>
              <span class="cat-count-badge">${count}</span>
            </label>
          `;
        })
        .join("");

      els.sheetCatList.querySelectorAll("input[data-sheet-category]").forEach((chk) => {
        chk.onchange = (e) => {
          const cat = e.target.getAttribute("data-sheet-category");
          if (e.target.checked) {
            state.selectedCategories.add(cat);
          } else {
            state.selectedCategories.delete(cat);
          }
          resetListScroll();
          renderSchemes();
          renderCategoriesRail();
        };
      });
    }
  }

  // Boot on DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
