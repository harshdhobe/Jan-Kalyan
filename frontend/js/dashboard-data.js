/**
 * dashboard-data.js
 * -----------------
 * Pure function data processor for the JanKalyan Helper Dashboard (#/helper).
 *
 * Requirements:
 * - Single pass computation over profiles and applications.
 * - Zero browser DOM dependencies (can run in Node.js or browser).
 * - Implements "What to do today" action rows with deterministic rules and thresholds.
 * - Computes application-level counts for the 4 action count cards.
 * - Resolves profile saved scheme counts and most urgent status without rule evaluation.
 */

(function (root, factory) {
  "use strict";
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.GovDashboardData = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  /**
   * Action rules thresholds (constants to be tuned after Helper interviews).
   */
  const DASHBOARD_THRESHOLDS = Object.freeze({
    FOLLOW_UP_THRESHOLD_DAYS: 7, // Reused FOLLOW_UP_THRESHOLD_DAYS for Documents pending
    REJECTED_MAX_DAYS: 14,       // Max days to surface recent rejections for review
    APPLIED_MIN_DAYS: 30,        // Min days to prompt checking status for applied schemes
  });

  /**
   * Status urgency hierarchy for the beneficiary profile status chip.
   * Lower number = higher urgency.
   */
  const STATUS_URGENCY = Object.freeze({
    "Ready to apply": 1,
    "Documents pending": 2,
    "Rejected": 3,
    "Applied": 4,
    "Approved": 5,
    "Benefit received": 6,
    "Saved": 7,
  });

  /**
   * Priority ordering for "What to do today" action rows:
   * 1. Ready to apply
   * 2. Documents pending
   * 3. Rejected
   * 4. Applied
   */
  const ACTION_GROUP_ORDER = Object.freeze({
    "Ready to apply": 1,
    "Documents pending": 2,
    "Rejected": 3,
    "Applied": 4,
  });

  const ACTION_KEYS = Object.freeze({
    "Ready to apply": "apply_now",
    "Documents pending": "collect_documents",
    "Rejected": "rejected_review",
    "Applied": "check_status",
  });

  const DEFAULT_ACTION_LABELS = Object.freeze({
    apply_now: "Apply now",
    collect_documents: "Collect documents",
    rejected_review: "Rejected: review",
    check_status: "Check status",
  });

  /**
   * Calculate elapsed days between timestamp and now.
   * Invariant: Invalid or future date counts as 0, never NaN.
   *
   * @param {string|number|null|undefined} dateVal
   * @param {number} nowMs
   * @returns {number}
   */
  function calculateDaysElapsed(dateVal, nowMs) {
    if (!dateVal) return 0;
    const t = typeof dateVal === "number" ? dateVal : new Date(dateVal).getTime();
    if (isNaN(t) || t <= 0) return 0;
    const diffMs = nowMs - t;
    if (diffMs <= 0) return 0; // future or current time = 0
    const days = Math.floor(diffMs / 86400000);
    return isNaN(days) || days < 0 ? 0 : days;
  }

  /**
   * Helper to resolve most urgent status between two statuses.
   */
  function pickMoreUrgentStatus(statusA, statusB) {
    if (!statusA) return statusB || null;
    if (!statusB) return statusA || null;
    const rankA = STATUS_URGENCY[statusA] || 99;
    const rankB = STATUS_URGENCY[statusB] || 99;
    return rankA <= rankB ? statusA : statusB;
  }

  /**
   * Pure function: compute everything from profiles and applications in ONE pass.
   *
   * @param {Array<Object>} profiles - List of profile objects
   * @param {Array<Object>} applications - List of application objects
   * @param {Function} getRuleName - Function (schemeId) => string | null
   * @param {number|Date} [now] - Current timestamp (default Date.now())
   * @returns {Object} Computed dashboard data
   */
  function computeDashboardData(profiles, applications, getRuleName, now) {
    const nowMs = typeof now === "number" ? now : (now instanceof Date ? now.getTime() : Date.now());
    const safeProfiles = Array.isArray(profiles) ? profiles : [];
    const safeApps = Array.isArray(applications) ? applications : [];
    const ruleLookup = typeof getRuleName === "function" ? getRuleName : () => null;

    // Index profiles by ID and prepare profile metadata aggregation
    const profileMap = new Map();
    const profileMetaMap = new Map();

    for (let i = 0; i < safeProfiles.length; i++) {
      const p = safeProfiles[i];
      profileMap.set(p.id, p);
      profileMetaMap.set(p.id, {
        profile: p,
        savedCount: 0,
        mostUrgentStatus: null,
        statusSet: new Set(),
      });
    }

    // Counts per APPLICATION
    const counts = {
      docsPending: 0,
      readyToApply: 0,
      waitingDecision: 0,
      benefitsReceived: 0,
      totalApplications: safeApps.length,
      totalProfiles: safeProfiles.length,
    };

    const actionRows = [];

    // SINGLE PASS over applications
    for (let i = 0; i < safeApps.length; i++) {
      const app = safeApps[i];
      const status = app.status;

      // 1. Accumulate counts per application
      if (status === "Documents pending") {
        counts.docsPending++;
      } else if (status === "Ready to apply") {
        counts.readyToApply++;
      } else if (status === "Applied") {
        counts.waitingDecision++;
      } else if (status === "Benefit received") {
        counts.benefitsReceived++;
      }

      // 2. Aggregate profile metadata (savedCount, mostUrgentStatus, statusSet)
      const pMeta = profileMetaMap.get(app.profileId);
      if (pMeta) {
        pMeta.savedCount++;
        if (status) {
          pMeta.statusSet.add(status);
          pMeta.mostUrgentStatus = pickMoreUrgentStatus(pMeta.mostUrgentStatus, status);
        }
      }

      // 3. Evaluate eligibility for "What to do today" action rows
      let qualifies = false;
      let actionKey = null;
      let groupOrder = 99;

      const updatedVal = app.statusUpdatedAt || app.updatedAt || app.createdAt;
      const days = calculateDaysElapsed(updatedVal, nowMs);

      if (status === "Ready to apply") {
        // Ready to apply: always listed, action "Apply now", days since statusUpdatedAt
        qualifies = true;
        actionKey = ACTION_KEYS["Ready to apply"];
        groupOrder = ACTION_GROUP_ORDER["Ready to apply"];
      } else if (status === "Documents pending") {
        // Documents pending with days >= 7: "Collect documents"
        if (days >= DASHBOARD_THRESHOLDS.FOLLOW_UP_THRESHOLD_DAYS) {
          qualifies = true;
          actionKey = ACTION_KEYS["Documents pending"];
          groupOrder = ACTION_GROUP_ORDER["Documents pending"];
        }
      } else if (status === "Rejected") {
        // Rejected with days <= 14: "Rejected: review"
        if (days <= DASHBOARD_THRESHOLDS.REJECTED_MAX_DAYS) {
          qualifies = true;
          actionKey = ACTION_KEYS["Rejected"];
          groupOrder = ACTION_GROUP_ORDER["Rejected"];
        }
      } else if (status === "Applied") {
        // Applied with days >= 30: "Check status"
        if (days >= DASHBOARD_THRESHOLDS.APPLIED_MIN_DAYS) {
          qualifies = true;
          actionKey = ACTION_KEYS["Applied"];
          groupOrder = ACTION_GROUP_ORDER["Applied"];
        }
      }

      if (qualifies) {
        const prof = profileMap.get(app.profileId);
        const resolvedName = app.schemeId ? ruleLookup(app.schemeId) : null;
        const isSchemeMissing = !app.schemeId || !resolvedName;
        const schemeDisplayName = isSchemeMissing
          ? "Scheme no longer in the list"
          : resolvedName;

        actionRows.push({
          applicationId: app.id,
          profileId: app.profileId,
          beneficiaryName: prof && prof.name ? prof.name.trim() : "Beneficiary",
          schemeId: app.schemeId || "",
          schemeName: schemeDisplayName,
          isSchemeMissing,
          actionKey,
          actionLabel: DEFAULT_ACTION_LABELS[actionKey] || actionKey,
          status,
          days,
          groupOrder,
        });
      }
    }

    // Sort action rows:
    // Order: Ready to apply (1), Documents pending (2), Rejected (3), Applied (4)
    // Within a group: longest waiting first (descending days)
    actionRows.sort((a, b) => {
      if (a.groupOrder !== b.groupOrder) {
        return a.groupOrder - b.groupOrder;
      }
      if (b.days !== a.days) {
        return b.days - a.days;
      }
      return (a.beneficiaryName || "").localeCompare(b.beneficiaryName || "");
    });

    // Prepare sorted profiles: sorted by most recently updated
    const enrichedProfiles = safeProfiles.map((p) => {
      const meta = profileMetaMap.get(p.id) || {
        savedCount: 0,
        mostUrgentStatus: null,
        statusSet: new Set(),
      };
      return {
        id: p.id,
        name: p.name || "",
        facts: p.facts || {},
        createdAt: p.createdAt || "",
        updatedAt: p.updatedAt || p.createdAt || "",
        savedCount: meta.savedCount,
        mostUrgentStatus: meta.mostUrgentStatus,
        statusSet: meta.statusSet,
      };
    });

    enrichedProfiles.sort((a, b) => {
      const timeA = new Date(a.updatedAt || 0).getTime() || 0;
      const timeB = new Date(b.updatedAt || 0).getTime() || 0;
      return timeB - timeA;
    });

    return {
      actionRows,
      counts,
      profiles: enrichedProfiles,
      profileMetaMap,
    };
  }

  /**
   * Pure filter helper for dashboard profiles.
   *
   * @param {Array<Object>} enrichedProfiles
   * @param {Object} options
   * @param {string|null} [options.statusFilter] - Target application status or "all"/null
   * @param {string} [options.searchQuery] - Search query matching profile name
   * @returns {Array<Object>}
   */
  function filterDashboardProfiles(enrichedProfiles, options) {
    const list = Array.isArray(enrichedProfiles) ? enrichedProfiles : [];
    const { statusFilter, searchQuery } = options || {};

    const cleanFilter = statusFilter && statusFilter !== "all" ? statusFilter : null;
    const cleanQuery = searchQuery && typeof searchQuery === "string" ? searchQuery.trim().toLowerCase() : "";

    return list.filter((p) => {
      if (cleanFilter) {
        if (!p.statusSet || !p.statusSet.has(cleanFilter)) {
          return false;
        }
      }
      if (cleanQuery) {
        const name = (p.name || "").toLowerCase();
        if (!name.includes(cleanQuery)) {
          return false;
        }
      }
      return true;
    });
  }

  return {
    DASHBOARD_THRESHOLDS,
    STATUS_URGENCY,
    ACTION_GROUP_ORDER,
    ACTION_KEYS,
    DEFAULT_ACTION_LABELS,
    calculateDaysElapsed,
    pickMoreUrgentStatus,
    computeDashboardData,
    filterDashboardProfiles,
  };
});
