/**
 * status.js
 * ---------
 * Single source of truth for Application Status vocabulary.
 * Directly sourced from AGENTS.md Section 6.
 *
 * Ordered statuses (7):
 * 1. Saved
 * 2. Documents pending
 * 3. Ready to apply
 * 4. Applied
 * 5. Approved
 * 6. Rejected
 * 7. Benefit received
 */

(function (root) {
  "use strict";

  const APPLICATION_STATUSES = Object.freeze([
    "Saved",
    "Documents pending",
    "Ready to apply",
    "Applied",
    "Approved",
    "Rejected",
    "Benefit received",
  ]);

  const STATUS_META = Object.freeze({
    "Saved": {
      id: "saved",
      order: 1,
      slug: "saved",
      label: {
        en: "Saved",
        hi: "सहेजा गया",
        mr: "जतन केले", // needs_review
      },
    },
    "Documents pending": {
      id: "docs-pending",
      order: 2,
      slug: "docs-pending",
      label: {
        en: "Documents pending",
        hi: "दस्तावेज लंबित",
        mr: "कागदपत्रे प्रलंबित", // needs_review
      },
    },
    "Ready to apply": {
      id: "ready-apply",
      order: 3,
      slug: "ready-apply",
      label: {
        en: "Ready to apply",
        hi: "आवेदन के लिए तैयार",
        mr: "अर्ज करण्यास तयार", // needs_review
      },
    },
    "Applied": {
      id: "applied",
      order: 4,
      slug: "applied",
      label: {
        en: "Applied",
        hi: "आवेदन किया गया",
        mr: "अर्ज केला", // needs_review
      },
    },
    "Approved": {
      id: "approved",
      order: 5,
      slug: "approved",
      label: {
        en: "Approved",
        hi: "स्वीकृत",
        mr: "मंजूर", // needs_review
      },
    },
    "Rejected": {
      id: "rejected",
      order: 6,
      slug: "rejected",
      label: {
        en: "Rejected",
        hi: "अस्वीकृत",
        mr: "नाकारले", // needs_review
      },
    },
    "Benefit received": {
      id: "benefit-received",
      order: 7,
      slug: "benefit-received",
      label: {
        en: "Benefit received",
        hi: "लाभ प्राप्त",
        mr: "लाभ मिळाला", // needs_review
      },
    },
  });

  function isValidStatus(status) {
    return APPLICATION_STATUSES.includes(status);
  }

  function getStatusMeta(status) {
    return STATUS_META[status] || {
      id: "unknown",
      order: 99,
      slug: "unknown",
      label: { en: status || "Unknown", hi: status || "अज्ञात", mr: status || "अज्ञात" },
    };
  }

  function getStatusLabel(status, lang = "en") {
    const meta = STATUS_META[status];
    if (!meta) return status || "";
    return (meta.label && meta.label[lang]) || meta.label.en || status;
  }

  const GovStatus = {
    STATUSES: APPLICATION_STATUSES,
    STATUS_META,
    isValidStatus,
    getStatusMeta,
    getStatusLabel,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GovStatus;
  }
  if (typeof window !== "undefined") {
    window.APPLICATION_STATUSES = APPLICATION_STATUSES;
    window.GovStatus = GovStatus;
  }
})(typeof window !== "undefined" ? window : globalThis);
