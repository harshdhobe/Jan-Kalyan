/**
 * app.js
 * ------
 * Main UI Controller for JanKalyan Scheme Eligibility Portal.
 * Minimalist, quiet editorial interface (Linear / Stripe / Notion design).
 * Pure Vanilla JavaScript, zero build dependencies.
 */

(function () {
  "use strict";

  // Debug timing and URL flags
  const urlParams = new URLSearchParams(window.location.search);
  const isDebug = urlParams.get("debug") === "1";
  const debugStats = {
    evalCount: 0,
    renderCount: 0,
    lastEvalMs: 0,
    lastRenderMs: 0,
  };
  window.__DEBUG_STATS = debugStats;

  // Stage 4: Follow-up threshold in days (logged in decisions.md)
  const FOLLOW_UP_THRESHOLD_DAYS = 7;

  // Global state
  const state = {
    lang: "en", // "en" | "hi" | "mr"
    currentView: "landing", // "landing" | "setup" | "helper" | "finder"
    helperAccount: null, // { name, helper_type, district, language }
    pendingQuickCheckFacts: null,
    pendingQuickCheckConversion: false,
    activeProfileId: null,
    activeProfileName: "",
    profiles: [],
    applications: [], // All applications in DB (Stage 3)
    profileApplications: new Map(), // schemeId -> application object for active profile
    dashboardStatusFilter: "all", // "all" or one of the 7 statuses
    profileSearchQuery: "",
    pendingDeleteProfileId: null,
    facts: {},
    activeField: null,
    currentTab: "eligible", // "eligible" | "unknown" | "ineligible" | "saved"
    searchQuery: "",
    selectedCategories: new Set(),
    selectedLevels: new Set(), // "central" | "state"
    selectedScopes: new Set(), // "individual" | "household"
    showAllCategories: false, // Toggle top 10 vs all
    checkedDocs: new Set(),
    accordionOpen: false,
    expandedBenefits: new Set(),
    openDocDisclosures: new Set(),
    visibleCount: 30, // Batch size for rendering performance (Stage P1: 30 cards)
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

  // Marathi display translations (needs_review)
  const CATEGORY_NAMES_MR = {
    "Social welfare & Empowerment": "सामाजिक कल्याण आणि सक्षमीकरण", // needs_review
    "Education & Learning": "शिक्षण आणि अध्ययन", // needs_review
    "Agriculture, Rural & Environment": "कृषी, ग्रामीण आणि पर्यावरण", // needs_review
    "Business & Entrepreneurship": "व्यवसाय आणि उद्योजकता", // needs_review
    "Women and Child": "महिला आणि बाल विकास", // needs_review
    "Skills & Employment": "कौशल्य आणि रोजगार", // needs_review
    "Banking, Financial Services & Insurance": "बँकिंग, वित्तीय सेवा आणि विमा", // needs_review
    "Health & Wellness": "आरोग्य आणि कल्याण", // needs_review
    "Sports & Culture": "क्रीडा आणि संस्कृती", // needs_review
    "Housing & Shelter": "गृहनिर्माण आणि निवारा", // needs_review
    "Science": "विज्ञान", // needs_review
    "IT & Communications": "माहिती तंत्रज्ञान आणि संप्रेषण", // needs_review
    "Transport & Infrastructure": "वाहतूक आणि पायाभूत सुविधा", // needs_review
    "Travel & Tourism": "पर्यटन आणि प्रवास", // needs_review
    "Utility & Sanitation": "उपयुक्तता आणि स्वच्छता", // needs_review
    "Public Safety, Law & Justice": "सार्वजनिक सुरक्षा, कायदा आणि न्याय", // needs_review
    "Pensions": "पेन्शन", // needs_review
    "Other": "इतर", // needs_review
  };

  // Strict i18n translation dictionary (Hard Rule 7: Marathi drafts flagged needs_review)
  const I18N = {
    landingLine1: {
      en: "Discover government welfare schemes for families in Maharashtra.",
      hi: "महाराष्ट्र के परिवारों के लिए सरकारी कल्याणकारी योजनाओं की खोज करें।",
      mr: "महाराष्ट्रातील कुटुंबांसाठी सरकारी कल्याणकारी योजना शोधा.", // needs_review
    },
    landingLine2: {
      en: "Check eligibility in seconds, prepare documents, and track application status offline.",
      hi: "कुछ ही सेकंडों में पात्रता जांचें, दस्तावेज तैयार करें और आवेदनों को ट्रैक करें।",
      mr: "काही सेकंदात पात्रता तपासा, कागदपत्रे तयार करा आणि अर्जाची स्थिती ट्रॅक करा.", // needs_review
    },
    imHelper: {
      en: "I'm a Helper",
      hi: "मैं सहायक हूँ",
      mr: "मी सहाय्यक आहे", // needs_review
    },
    imHelperSub: {
      en: "ASHA, Anganwadi, Panchayat, CSC",
      hi: "आशा, आंगनवाड़ी, पंचायत, सीएससी",
      mr: "आशा, अंगणवाडी, पंचायत, सीएससी", // needs_review
    },
    quickCheckBtn: {
      en: "Quick check",
      hi: "त्वरित जांच",
      mr: "त्वरित तपासणी", // needs_review
    },
    quickCheckSub: {
      en: "Check eligibility without saving",
      hi: "बिना सहेजे पात्रता जांचें",
      mr: "जतन न करता पात्रता तपासा", // needs_review
    },
    landingPrivacyNote: {
      en: "Works on this phone. Aadhaar is never stored.",
      hi: "यह इस फ़ोन पर काम करता है। आधार कभी संग्रहीत नहीं किया जाता है।",
      mr: "हे या फोनवर काम करते. आधार कधीही साठवले जात नाही.", // needs_review
    },
    setupTitle: {
      en: "Helper Setup",
      hi: "सहायक सेटअप",
      mr: "सहाय्यक सेटअप", // needs_review
    },
    setupNotice: {
      en: "This sets up this phone. Secure login will be added later.",
      hi: "यह इस फोन को सेटअप करता है। सुरक्षित लॉगिन बाद में जोड़ा जाएगा।",
      mr: "हे या फोनचा सेटअप करते. सुरक्षित लॉगिन नंतर जोडले जाईल.", // needs_review
    },
    labelHelperName: {
      en: "Helper Name *",
      hi: "सहायक का नाम *",
      mr: "सहाय्यकाचे नाव *", // needs_review
    },
    labelHelperType: {
      en: "Role / Helper Type *",
      hi: "भूमिका / सहायक प्रकार *",
      mr: "भूमिका / सहाय्यक प्रकार *", // needs_review
    },
    labelDistrict: {
      en: "District",
      hi: "ज़िला",
      mr: "जिल्हा", // needs_review
    },
    labelLanguage: {
      en: "Preferred Language",
      hi: "पसंदीदा भाषा",
      mr: "पसंतीची भाषा", // needs_review
    },
    saveAndContinue: {
      en: "Save & Continue",
      hi: "सहेजें और आगे बढ़ें",
      mr: "जतन करा आणि पुढे चला", // needs_review
    },
    editHelperDetails: {
      en: "Edit Details",
      hi: "विवरण संपादित करें",
      mr: "तपशील संपादित करा", // needs_review
    },
    docsPending: {
      en: "Documents pending",
      hi: "दस्तावेज लंबित",
      mr: "कागदपत्रे प्रलंबित", // needs_review
    },
    needsFollowUp: {
      en: "Needs Follow-Up",
      hi: "अनुवर्ती कार्रवाई आवश्यक",
      mr: "पाठपुरावा आवश्यक", // needs_review
    },
    needsFollowUpSub: {
      en: "Applications in Documents pending or Ready to apply for 7 or more days.",
      hi: "दस्तावेज लंबित या आवेदन के लिए तैयार में 7 या अधिक दिनों से प्रतीक्षारत आवेदन।",
      mr: "कागदपत्रे प्रलंबित किंवा अर्ज करण्यास तयार मध्ये ७ किंवा अधिक दिवस असलेले अर्ज.", // needs_review
    },
    noFollowUp: {
      en: "No profiles currently need follow-up.",
      hi: "वर्तमान में किसी प्रोफाइल को अनुवर्ती कार्रवाई की आवश्यकता नहीं है।",
      mr: "सध्या कोणत्याही प्रोफाइलसाठी पाठपुराव्याची आवश्यकता नाही.", // needs_review
    },
    daysWaiting: {
      en: "days waiting",
      hi: "दिन प्रतीक्षारत",
      mr: "दिवस प्रतीक्षेत", // needs_review
    },
    days: {
      en: "days",
      hi: "दिन",
      mr: "दिवस", // needs_review
    },
    day: {
      en: "day",
      hi: "दिन",
      mr: "दिवस", // needs_review
    },
    searchProfilesPlaceholder: {
      en: "Search profiles by name...",
      hi: "नाम से प्रोफाइल खोजें...",
      mr: "नावाने प्रोफाइल शोधा...", // needs_review
    },
    quickCheckBanner: {
      en: "Quick check: nothing is saved",
      hi: "त्वरित जांच: कुछ भी सहेजा नहीं जाता है",
      mr: "त्वरित तपासणी: काहीही जतन केले जात नाही", // needs_review
    },
    quickConvertTitle: {
      en: "Save this family and track applications?",
      hi: "इस परिवार को सहेजें और आवेदनों को ट्रैक करें?",
      mr: "हे कुटुंब जतन करा आणि अर्ज ट्रॅक करायचे?", // needs_review
    },
    quickConvertDesc: {
      en: "Set up as a Helper to track documents and application progress across visits.",
      hi: "विभिन्न यात्राओं में दस्तावेजों और आवेदन की प्रगति को ट्रैक करने के लिए सहायक के रूप में सेटअप करें।",
      mr: "भेटींमध्ये कागदपत्रे आणि अर्जाची प्रगती ट्रॅक करण्यासाठी सहाय्यक म्हणून सेटअप करा.", // needs_review
    },
    setUpAsHelper: {
      en: "Set up as a Helper",
      hi: "सहायक के रूप में सेटअप करें",
      mr: "सहाय्यक म्हणून सेटअप करा", // needs_review
    },
    helperHome: {
      en: "Helper Home",
      hi: "सहायक होम",
      mr: "सहाय्यक मुख्यपृष्ठ", // needs_review
    },
    dashboardTitle: {
      en: "Beneficiary Profiles",
      hi: "लाभार्थी प्रोफाइल",
      mr: "लाभार्थी प्रोफाइल", // needs_review
    },
    dashboardSubtitle: {
      en: "Manage profiles for rural beneficiaries, evaluate scheme entitlements, and track applications.",
      hi: "ग्रामीण लाभार्थियों के लिए प्रोफाइल प्रबंधित करें, योजना पात्रता का मूल्यांकन करें और आवेदनों को ट्रैक करें।",
      mr: "ग्रामीण लाभार्थ्यांचे प्रोफाइल व्यवस्थापित करा, योजना पात्रता तपासा आणि अर्ज ट्रॅक करा.", // needs_review
    },
    quickCheck: {
      en: "Quick check without saving",
      hi: "बिना सहेजे त्वरित जांच",
      mr: "जतन न करता त्वरित तपासणी", // needs_review
    },
    addProfile: {
      en: "Add profile",
      hi: "प्रोफाइल जोड़ें",
      mr: "प्रोफाइल जोडा", // needs_review
    },
    totalProfiles: {
      en: "Total Profiles",
      hi: "कुल प्रोफाइल",
      mr: "एकूण प्रोफाइल", // needs_review
    },
    readyToApply: {
      en: "Ready to apply",
      hi: "आवेदन के लिए तैयार",
      mr: "अर्ज करण्यास तयार", // needs_review
    },
    applied: {
      en: "Applied",
      hi: "आवेदन किया गया",
      mr: "अर्ज सादर केला", // needs_review
    },
    noProfilesPrimary: {
      en: "No beneficiary profiles yet",
      hi: "अभी तक कोई लाभार्थी प्रोफाइल नहीं है",
      mr: "अद्याप कोणताही लाभार्थी प्रोफाइल नाही", // needs_review
    },
    noProfilesSecondary: {
      en: "Create a profile on behalf of a beneficiary with their consent, or perform a quick eligibility check.",
      hi: "सहमति के साथ लाभार्थी की ओर से प्रोफाइल बनाएं, या त्वरित पात्रता जांच करें।",
      mr: "संमतीसह लाभार्थ्याच्या वतीने प्रोफाइल तयार करा, किंवा त्वरित पात्रता तपासणी करा.", // needs_review
    },
    checkSchemes: {
      en: "Check schemes",
      hi: "योजनाएं जांचें",
      mr: "योजना तपासा", // needs_review
    },
    backToProfiles: {
      en: "Profiles",
      hi: "प्रोफाइल",
      mr: "प्रोफाइल", // needs_review
    },
    saveAsProfile: {
      en: "Save as profile",
      hi: "प्रोफाइल के रूप में सहेजें",
      mr: "प्रोफाइल म्हणून जतन करा", // needs_review
    },
    saved: {
      en: "Saved",
      hi: "सहेजा गया",
      mr: "जतन केले", // needs_review
    },
    saving: {
      en: "Saving...",
      hi: "सहेजा जा रहा है...",
      mr: "जतन होत आहे...", // needs_review
    },
    quickCheckSession: {
      en: "Quick check (unsaved)",
      hi: "त्वरित जांच (असंरक्षित)",
      mr: "त्वरित तपासणी (अजतन)", // needs_review
    },
    delete: {
      en: "Delete",
      hi: "हटाएं",
      mr: "हटवा", // needs_review
    },
    eligibleSchemesCount: {
      en: "eligible schemes",
      hi: "पात्र योजनाएं",
      mr: "पात्र योजना", // needs_review
    },
    needsInfoSchemesCount: {
      en: "needs info",
      hi: "अधिक जानकारी चाहिए",
      mr: "अधिक माहिती आवश्यक", // needs_review
    },
    modalAddTitle: {
      en: "Add Beneficiary Profile",
      hi: "लाभार्थी प्रोफाइल जोड़ें",
      mr: "लाभार्थी प्रोफाइल जोडा", // needs_review
    },
    labelProfileName: {
      en: "Beneficiary Full Name *",
      hi: "लाभार्थी का पूरा नाम *",
      mr: "लाभार्थ्याचे पूर्ण नाव *", // needs_review
    },
    consentText: {
      en: "Beneficiary agreed to share these details",
      hi: "लाभार्थी ने यह विवरण साझा करने की सहमति दी है",
      mr: "लाभार्थ्याने हा तपशील सामायिक करण्यास संमती दिली आहे", // needs_review
    },
    consentNote: {
      en: "Minimal personal data is stored locally. Government ID numbers are never collected or stored.",
      hi: "न्यूनतम व्यक्तिगत डेटा स्थानीय रूप से संग्रहीत किया जाता है। सरकारी पहचान संख्या कभी एकत्र या संग्रहीत नहीं की जाती है।",
      mr: "किमान वैयक्तिक डेटा स्थानिक पातळीवर संग्रहित केला जातो. सरकारी ओळख क्रमांक कधीही संकलित किंवा संग्रहित केले जात नाहीत.", // needs_review
    },
    modalCreateBtn: {
      en: "Create & Check Schemes",
      hi: "बनाएं और योजनाएं जांचें",
      mr: "तयार करा आणि योजना तपासा", // needs_review
    },
    cancel: {
      en: "Cancel",
      hi: "रद्द करें",
      mr: "रद्द करा", // needs_review
    },
    modalDeleteTitle: {
      en: "Delete Profile",
      hi: "प्रोफाइल हटाएं",
      mr: "प्रोफाइल हटवा", // needs_review
    },
    deleteConfirmText: {
      en: "Are you sure you want to delete this profile? This action cannot be undone.",
      hi: "क्या आप वाकई इस प्रोफाइल को हटाना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।",
      mr: "तुम्हाला खात्री आहे की तुम्ही हे प्रोफाइल हटवू इच्छिता? ही कृती पूर्ववत केली जाऊ शकत नाही.", // needs_review
    },
    btnConfirmDelete: {
      en: "Delete Profile",
      hi: "प्रोफाइल हटाएं",
      mr: "प्रोफाइल हटवा", // needs_review
    },
    errNameRequired: {
      en: "Please enter the beneficiary full name.",
      hi: "कृपया लाभार्थी का पूरा नाम दर्ज करें।",
      mr: "कृपया लाभार्थ्याचे पूर्ण नाव प्रविष्ट करा.", // needs_review
    },
    errConsentRequired: {
      en: "Explicit consent from the beneficiary is required.",
      hi: "लाभार्थी से स्पष्ट सहमति आवश्यक है।",
      mr: "लाभार्थ्याची स्पष्ट संमती आवश्यक आहे.", // needs_review
    },
    demographicsPending: {
      en: "Demographics pending",
      hi: "जनसांख्यिकी विवरण लंबित",
      mr: "लोकसंख्या तपशील प्रलंबित", // needs_review
    },
    noSpecificAge: {
      en: "Profile details pending",
      hi: "विवरण लंबित",
      mr: "तपशील प्रलंबित", // needs_review
    },
    saveScheme: {
      en: "Save scheme",
      hi: "योजना सहेजें",
      mr: "योजना जतन करा", // needs_review
    },
    schemesTab: {
      en: "Schemes",
      hi: "योजनाएँ",
      mr: "योजना", // needs_review
    },
    schemeNotInList: {
      en: "Scheme no longer in the list",
      hi: "यह योजना अब सूची में उपलब्ध नहीं है",
      mr: "ही योजना आता यादीत उपलब्ध नाही", // needs_review
    },
    applicationStatus: {
      en: "Application Status",
      hi: "आवेदन की स्थिति",
      mr: "अर्जाची स्थिती", // needs_review
    },
    docsRequired: {
      en: "Documents Required",
      hi: "आवश्यक दस्तावेज",
      mr: "आवश्यक कागदपत्रे", // needs_review
    },
    notesLabel: {
      en: "Notes & Follow-up",
      hi: "टिप्पणी एवं अनुवर्ती",
      mr: "नोंदी आणि पाठपुरावा", // needs_review
    },
    notesPlaceholder: {
      en: "Add private notes on application progress, documents, or officer visits...",
      hi: "आवेदन की प्रगति, दस्तावेज या अधिकारी से भेंट पर निजी टिप्पणी लिखें...",
      mr: "अर्जाची प्रगती, कागदपत्रे किंवा अधिकारी भेटीवर खाजगी नोंदी जोडा...", // needs_review
    },
    noSavedSchemesPrimary: {
      en: "No saved schemes yet",
      hi: "अभी तक कोई योजना सहेजी नहीं गई है",
      mr: "अद्याप कोणतीही योजना जतन केलेली नाही", // needs_review
    },
    noSavedSchemesSecondary: {
      en: "Browse eligible or needs info schemes and click 'Save scheme' to track application progress.",
      hi: "पात्र योजनाएँ देखें और प्रगति ट्रैक करने के लिए 'योजना सहेजें' पर क्लिक करें।",
      mr: "पात्र योजना तपासा आणि प्रगती ट्रॅक करण्यासाठी 'योजना जतन करा' वर क्लिक करा.", // needs_review
    },
    browseEligibleSchemes: {
      en: "Browse eligible schemes",
      hi: "पात्र योजनाएँ देखें",
      mr: "पात्र योजना पहा", // needs_review
    },
    statusUpdatedPrefix: {
      en: "Updated",
      hi: "अद्यतन",
      mr: "अद्ययावत", // needs_review
    },
    removeSaved: {
      en: "Remove",
      hi: "हटाएं",
      mr: "काढून टाका", // needs_review
    },
    filterAllStatuses: {
      en: "All Profiles",
      hi: "सभी प्रोफाइल",
      mr: "सर्व प्रोफाइल", // needs_review
    },
    filterLabel: {
      en: "Filter profiles by application status:",
      hi: "आवेदन स्थिति के अनुसार प्रोफाइल फ़िल्टर करें:",
      mr: "अर्ज स्थितीनुसार प्रोफाइल फिल्टर करा:", // needs_review
    },
    showAll: {
      en: "Show all",
      hi: "सभी दिखाएं",
      mr: "सर्व दाखवा", // needs_review
    },
    noFilteredProfilesPrimary: {
      en: "No profiles match this status filter",
      hi: "इस स्थिति फ़िल्टर से कोई प्रोफाइल नहीं मिली",
      mr: "या स्थिती फिल्टरशी जुळणारे प्रोफाइल आढळले नाही", // needs_review
    },
    noFilteredProfilesSecondary: {
      en: "Try selecting a different status filter or clear the filter.",
      hi: "कोई अन्य स्थिति चुनें या फ़िल्टर साफ़ करें।",
      mr: "दुसरी स्थिती निवडा किंवा फिल्टर साफ करा.", // needs_review
    },
    clearFilter: {
      en: "Clear filter",
      hi: "फ़िल्टर हटाएं",
      mr: "फिल्टर काढा", // needs_review
    },
  };

  function t(key) {
    const entry = I18N[key];
    if (!entry) return key;
    return entry[state.lang] || entry.en || key;
  }

  function getCategoryLabel(cat) {
    if (state.lang === "hi") return CATEGORY_NAMES_HI[cat] || cat;
    if (state.lang === "mr") return CATEGORY_NAMES_MR[cat] || cat;
    return cat;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Category Parser & Derived Pension Group Helper
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Checks if scheme text mentions pension (English or Hindi).
   * Derived group helper: easy to adapt if criteria evolve.
   */
  function isPensionScheme(scheme) {
    if (!scheme) return false;
    if (scheme.is_pension) return true;
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

  // ─────────────────────────────────────────────────────────────────────────
  // Stage P1: Precomputed Static Rule Data (Startup)
  // ─────────────────────────────────────────────────────────────────────────

  let staticRuleMap = null;
  let staticAllCategories = new Set();
  let staticAllLevels = new Set();
  let staticAllScopes = new Set();

  function precomputeStaticRuleData() {
    const rules = window.ALL_RULES || [];
    staticRuleMap = new Map();
    staticAllCategories = new Set();
    staticAllLevels = new Set();
    staticAllScopes = new Set();

    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      staticRuleMap.set(r.id, r);

      // Precompute parsed categories
      r._parsedCategories = parseSchemeCategories(r.category || "", r);
      for (let j = 0; j < r._parsedCategories.length; j++) {
        staticAllCategories.add(r._parsedCategories[j]);
      }

      // Precompute level & scope
      r._level = getLevel(r) || "unknown";
      if (r._level && r._level !== "unknown") staticAllLevels.add(r._level);

      r._scope = getScope(r) || "unknown";
      if (r._scope && r._scope !== "unknown") staticAllScopes.add(r._scope);

      // Precompute lowercase search string
      r._searchStr = `${r.name || ""} ${r.benefit || ""} ${r.id || ""}`.toLowerCase();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stage P2: On-Demand & Idle Detail Loader
  // ─────────────────────────────────────────────────────────────────────────

  let detailLoadStatus = "idle"; // "idle" | "loading" | "loaded" | "failed"
  let detailLoadPromise = null;

  function applyLoadedDetails(details) {
    if (!details) return;
    for (const [id, det] of Object.entries(details)) {
      const rule = staticRuleMap.get(id);
      if (rule) {
        if (det.benefit !== undefined) rule.benefit = det.benefit;
        if (det.documents !== undefined) rule.documents = det.documents;
        if (det.links !== undefined) rule.links = det.links;
        if (det.benefit) {
          rule._searchStr = `${rule.name || ""} ${det.benefit} ${rule.id || ""}`.toLowerCase();
        }
      }
    }
  }

  function loadRulesDetail() {
    if (detailLoadStatus === "loaded") {
      return Promise.resolve(window.RULES_DETAIL);
    }
    if (window.RULES_DETAIL && Object.keys(window.RULES_DETAIL).length > 0) {
      detailLoadStatus = "loaded";
      applyLoadedDetails(window.RULES_DETAIL);
      return Promise.resolve(window.RULES_DETAIL);
    }
    if (detailLoadPromise) {
      return detailLoadPromise;
    }

    detailLoadStatus = "loading";
    detailLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "data/rules_detail.js";
      script.async = true;
      script.onload = () => {
        detailLoadStatus = "loaded";
        if (window.RULES_DETAIL) {
          applyLoadedDetails(window.RULES_DETAIL);
        }
        if (state.currentView === "finder") {
          const filterData = getFilterData();
          renderSchemes(filterData);
        } else if (state.activeProfileId && state.activeProfileTab === "schemes") {
          renderSavedApplications(state.activeProfileId);
        }
        resolve(window.RULES_DETAIL);
      };
      script.onerror = (err) => {
        detailLoadStatus = "failed";
        detailLoadPromise = null;
        console.warn("JanKalyan: rules_detail.js unavailable offline", err);
        if (state.currentView === "finder") {
          const filterData = getFilterData();
          renderSchemes(filterData);
        } else if (state.activeProfileId && state.activeProfileTab === "schemes") {
          renderSavedApplications(state.activeProfileId);
        }
        reject(new Error("Details unavailable offline"));
      };
      document.head.appendChild(script);
    });

    return detailLoadPromise;
  }

  function scheduleIdleDetailPreload() {
    const runPreload = () => {
      loadRulesDetail().catch(() => {});
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(runPreload, { timeout: 2000 });
    } else {
      setTimeout(runPreload, 1000);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stage P1: Single Evaluation Cache & Pipeline
  // ─────────────────────────────────────────────────────────────────────────

  const evaluationCache = {
    factsVersion: 0,
    cachedVersion: -1,
    results: null,
    tabEligible: [],
    tabUnknown: [],
    tabIneligible: [],
    nextQuestion: null,
    eligibleTotal: 0,
    unknownTotal: 0,
    ineligibleTotal: 0,
    evalDurationMs: 0,
  };

  function ensureEvaluation() {
    if (evaluationCache.cachedVersion === evaluationCache.factsVersion && evaluationCache.results) {
      return evaluationCache;
    }

    const t0 = performance.now();
    debugStats.evalCount++;

    const rules = window.ALL_RULES || [];
    const results = window.GovEngine.evaluateAll(rules, state.facts);

    let eligibleTotal = 0;
    let unknownTotal = 0;
    let ineligibleTotal = 0;
    const tabEligible = [];
    const tabUnknown = [];
    const tabIneligible = [];
    const fieldFrequency = new Map();

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const meta = staticRuleMap ? staticRuleMap.get(r.id) : null;
      if (meta) {
        r._parsedCategories = meta._parsedCategories;
        r._level = meta._level;
        r._scope = meta._scope;
        r._searchStr = meta._searchStr;
      }

      if (r.result === "eligible") {
        eligibleTotal++;
        tabEligible.push(r);
      } else if (r.result === "unknown") {
        unknownTotal++;
        tabUnknown.push(r);
        if (r.missingFields) {
          for (let j = 0; j < r.missingFields.length; j++) {
            const f = r.missingFields[j];
            fieldFrequency.set(f, (fieldFrequency.get(f) || 0) + 1);
          }
        }
      } else if (r.result === "ineligible") {
        ineligibleTotal++;
        tabIneligible.push(r);
      }
    }

    let nextQ = null;
    if (fieldFrequency.size > 0) {
      const sorted = Array.from(fieldFrequency.entries()).sort(
        ([fa, ca], [fb, cb]) => cb - ca || fa.localeCompare(fb)
      );
      const [field, schemeCount] = sorted[0];
      nextQ = { field, schemeCount };
    }

    const evalDurationMs = performance.now() - t0;
    debugStats.lastEvalMs = evalDurationMs;
    if (isDebug) {
      console.log(
        `[JanKalyan Perf] evaluateAll: ${evalDurationMs.toFixed(2)}ms (factsVersion: ${evaluationCache.factsVersion}, evalCount: ${debugStats.evalCount})`
      );
    }

    evaluationCache.cachedVersion = evaluationCache.factsVersion;
    evaluationCache.results = results;
    evaluationCache.tabEligible = tabEligible;
    evaluationCache.tabUnknown = tabUnknown;
    evaluationCache.tabIneligible = tabIneligible;
    evaluationCache.nextQuestion = nextQ;
    evaluationCache.eligibleTotal = eligibleTotal;
    evaluationCache.unknownTotal = unknownTotal;
    evaluationCache.ineligibleTotal = ineligibleTotal;
    evaluationCache.evalDurationMs = evalDurationMs;

    return evaluationCache;
  }

  function getFilterData() {
    const evalData = ensureEvaluation();

    let inTab = [];
    if (state.currentTab === "eligible") inTab = evalData.tabEligible;
    else if (state.currentTab === "unknown") inTab = evalData.tabUnknown;
    else if (state.currentTab === "ineligible") inTab = evalData.tabIneligible;

    if (state.searchQuery) {
      const q = state.searchQuery;
      inTab = inTab.filter((r) => r._searchStr && r._searchStr.includes(q));
    }

    const hasCatFilter = state.selectedCategories.size > 0;
    const hasLevelFilter = state.selectedLevels.size === 1;
    const hasScopeFilter = state.selectedScopes.size === 1;

    const matchesCategory = (s) => {
      if (!hasCatFilter) return true;
      return s._parsedCategories && s._parsedCategories.some((c) => state.selectedCategories.has(c));
    };

    const matchesLevel = (s) => {
      if (!hasLevelFilter) return true;
      return state.selectedLevels.has(s._level);
    };

    const matchesScope = (s) => {
      if (!hasScopeFilter) return true;
      return state.selectedScopes.has(s._scope);
    };

    const categoryCounts = new Map();
    let centralCount = 0;
    let stateCount = 0;
    let individualCount = 0;
    let householdCount = 0;
    let totalCentralInTab = 0;
    let totalStateInTab = 0;
    let totalIndividualInTab = 0;
    let totalHouseholdInTab = 0;
    const filteredSchemes = [];

    for (let i = 0; i < inTab.length; i++) {
      const s = inTab[i];
      const matchCat = matchesCategory(s);
      const matchLvl = matchesLevel(s);
      const matchSc = matchesScope(s);

      if (s._level === "central") totalCentralInTab++;
      else if (s._level === "state") totalStateInTab++;

      if (s._scope === "individual") totalIndividualInTab++;
      else if (s._scope === "household") totalHouseholdInTab++;

      if (matchLvl && matchSc && s._parsedCategories) {
        for (let j = 0; j < s._parsedCategories.length; j++) {
          const cat = s._parsedCategories[j];
          categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        }
      }

      if (matchCat && matchSc) {
        if (s._level === "central") centralCount++;
        else if (s._level === "state") stateCount++;
      }

      if (matchCat && matchLvl) {
        if (s._scope === "individual") individualCount++;
        else if (s._scope === "household") householdCount++;
      }

      if (matchCat && matchLvl && matchSc) {
        filteredSchemes.push(s);
      }
    }

    const showLevelGroup = totalCentralInTab > 0 && totalStateInTab > 0;
    const showScopeGroup = totalIndividualInTab > 0 && totalHouseholdInTab > 0;

    const activeSelectedCategories = Array.from(state.selectedCategories).filter(
      (c) => categoryCounts.has(c) && categoryCounts.get(c) > 0
    );

    const activeSelectedLevels = Array.from(state.selectedLevels).filter((lvl) => {
      if (lvl === "central") return centralCount > 0 || totalCentralInTab > 0;
      if (lvl === "state") return stateCount > 0 || totalStateInTab > 0;
      return false;
    });

    const activeSelectedScopes = Array.from(state.selectedScopes).filter((sc) => {
      if (sc === "individual") return individualCount > 0 || totalIndividualInTab > 0;
      if (sc === "household") return householdCount > 0 || totalHouseholdInTab > 0;
      return false;
    });

    return {
      eligibleTotal: evalData.eligibleTotal,
      unknownTotal: evalData.unknownTotal,
      ineligibleTotal: evalData.ineligibleTotal,
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
      filteredSchemes,
      activeSelectedCategories,
      activeSelectedLevels,
      activeSelectedScopes,
    };
  }

  let showMoreObserver = null;
  function observeShowMore() {
    if (showMoreObserver) {
      showMoreObserver.disconnect();
      showMoreObserver = null;
    }
    const btn = document.getElementById("btn-show-more");
    if (!btn || typeof IntersectionObserver === "undefined") return;
    showMoreObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0] && entries[0].isIntersecting) {
          state.visibleCount += 30;
          const filterData = getFilterData();
          renderSchemes(filterData);
        }
      },
      { rootMargin: "200px" }
    );
    showMoreObserver.observe(btn);
  }

  // Cache DOM elements
  const els = {};

  function init() {
    try {
      precomputeStaticRuleData();
    // Header & Language
    els.langEn = document.getElementById("lang-en");
    els.langHi = document.getElementById("lang-hi");
    els.langMr = document.getElementById("lang-mr");
    els.brandLogo = document.getElementById("brand-logo");
    els.btnBackToDashboard = document.getElementById("btn-back-to-dashboard");
    els.btnBackText = document.getElementById("btn-back-text");
    els.activeProfilePill = document.getElementById("active-profile-pill");
    els.activeProfileName = document.getElementById("active-profile-name");
    els.activeProfileSaveStatus = document.getElementById("active-profile-save-status");
    els.btnSaveAsProfile = document.getElementById("btn-save-as-profile");
    els.btnSaveAsProfileText = document.getElementById("btn-save-as-profile-text");
    els.personaSelect = document.getElementById("persona-select");
    els.resetBtn = document.getElementById("reset-btn");

    // Stage 4: Landing View Elements
    els.landingView = document.getElementById("landing-view");
    els.landingLine1 = document.getElementById("landing-line-1");
    els.landingLine2 = document.getElementById("landing-line-2");
    els.btnLandingHelper = document.getElementById("btn-landing-helper");
    els.btnLandingHelperText = document.getElementById("btn-landing-helper-text");
    els.btnLandingHelperSub = document.getElementById("btn-landing-helper-sub");
    els.btnLandingQuick = document.getElementById("btn-landing-quick");
    els.btnLandingQuickText = document.getElementById("btn-landing-quick-text");
    els.btnLandingQuickSub = document.getElementById("btn-landing-quick-sub");
    els.landingPrivacyNote = document.getElementById("landing-privacy-note");

    // Stage 4: Helper Setup View Elements
    els.setupView = document.getElementById("setup-view");
    els.setupTitleText = document.getElementById("setup-title-text");
    els.setupNoticeText = document.getElementById("setup-notice-text");
    els.labelHelperName = document.getElementById("label-helper-name");
    els.inputHelperName = document.getElementById("input-helper-name");
    els.labelHelperType = document.getElementById("label-helper-type");
    els.selectHelperType = document.getElementById("select-helper-type");
    els.labelHelperDistrict = document.getElementById("label-helper-district");
    els.inputHelperDistrict = document.getElementById("input-helper-district");
    els.labelHelperLanguage = document.getElementById("label-helper-language");
    els.selectHelperLanguage = document.getElementById("select-helper-language");
    els.setupErrorMsg = document.getElementById("setup-error-msg");
    els.btnCancelSetup = document.getElementById("btn-cancel-setup");
    els.btnSaveSetup = document.getElementById("btn-save-setup");
    els.formHelperSetup = document.getElementById("form-helper-setup");

    // Stage 4: Helper Header Badge Pill & Welcome Bar Elements
    els.headerHelperPill = document.getElementById("header-helper-pill");
    els.headerHelperName = document.getElementById("header-helper-name");
    els.headerHelperRole = document.getElementById("header-helper-role");
    els.helperWelcomeBar = document.getElementById("helper-welcome-bar");
    els.helperTagRole = document.getElementById("helper-tag-role");
    els.helperTagName = document.getElementById("helper-tag-name");
    els.helperTagDistrict = document.getElementById("helper-tag-district");
    els.btnEditHelper = document.getElementById("btn-edit-helper");
    els.btnEditHelperText = document.getElementById("btn-edit-helper-text");

    // Views & Alerts
    els.dbUnavailableBanner = document.getElementById("db-unavailable-banner");
    els.dashboardView = document.getElementById("dashboard-view");
    els.finderView = document.getElementById("finder-view");

    // Dashboard / Helper Home View Elements
    els.dashboardTitleText = document.getElementById("dashboard-title-text");
    els.dashboardSubtitleText = document.getElementById("dashboard-subtitle-text");
    els.btnAddProfile = document.getElementById("btn-add-profile");
    els.btnAddProfileText = document.getElementById("btn-add-profile-text");

    // 4 Summary Metric Tiles
    els.statTotalProfiles = document.getElementById("stat-total-profiles");
    els.statDocsPending = document.getElementById("stat-docs-pending");
    els.statReadyApply = document.getElementById("stat-ready-apply");
    els.statApplied = document.getElementById("stat-applied");
    els.metricLabelTotal = document.getElementById("metric-label-total");
    els.metricLabelDocsPending = document.getElementById("metric-label-docs-pending");
    els.metricLabelReady = document.getElementById("metric-label-ready");
    els.metricLabelApplied = document.getElementById("metric-label-applied");
    els.metricCardTotal = document.getElementById("metric-card-total");
    els.metricCardDocsPending = document.getElementById("metric-card-docs-pending");
    els.metricCardReady = document.getElementById("metric-card-ready");
    els.metricCardApplied = document.getElementById("metric-card-applied");
    els.metricHintTotal = document.getElementById("metric-hint-total");
    els.metricHintDocsPending = document.getElementById("metric-hint-docs-pending");
    els.metricHintReady = document.getElementById("metric-hint-ready");
    els.metricHintApplied = document.getElementById("metric-hint-applied");

    // Follow-Up Section Elements
    els.followupSection = document.getElementById("followup-section");
    els.followupTitle = document.getElementById("followup-title");
    els.followupBadge = document.getElementById("followup-badge");
    els.followupSubtext = document.getElementById("followup-subtext");
    els.followupList = document.getElementById("followup-list");
    els.followupEmpty = document.getElementById("followup-empty");
    els.followupEmptyText = document.getElementById("followup-empty-text");

    // Profile search input
    els.inputProfileSearch = document.getElementById("input-profile-search");

    els.dashboardFilterBar = document.getElementById("dashboard-filter-bar");
    els.filterBarTitle = document.getElementById("filter-bar-title");
    els.btnDashboardFilterClear = document.getElementById("btn-dashboard-filter-clear");
    els.dashboardFilterChips = document.getElementById("dashboard-filter-chips");
    els.profilesList = document.getElementById("profiles-list");
    els.profilesEmptyState = document.getElementById("profiles-empty-state");
    els.emptyStatePrimary = document.getElementById("empty-state-primary");
    els.emptyStateSecondary = document.getElementById("empty-state-secondary");
    els.btnEmptyAddProfile = document.getElementById("btn-empty-add-profile");

    // Modals
    els.modalAddProfile = document.getElementById("modal-add-profile");
    els.modalAddTitle = document.getElementById("modal-add-title");
    els.btnCloseAddModal = document.getElementById("btn-close-add-modal");
    els.inputProfileName = document.getElementById("input-profile-name");
    els.labelProfileName = document.getElementById("label-profile-name");
    els.checkProfileConsent = document.getElementById("check-profile-consent");
    els.consentTextLabel = document.getElementById("consent-text-label");
    els.consentNoteText = document.getElementById("consent-note-text");
    els.addProfileError = document.getElementById("add-profile-error");
    els.btnCancelAddProfile = document.getElementById("btn-cancel-add-profile");
    els.btnCreateProfile = document.getElementById("btn-create-profile");
    els.formAddProfile = document.getElementById("form-add-profile");

    els.modalConfirmDelete = document.getElementById("modal-confirm-delete");
    els.modalDeleteTitle = document.getElementById("modal-delete-title");
    els.deleteConfirmText = document.getElementById("delete-confirm-text");
    els.btnCancelDelete = document.getElementById("btn-cancel-delete");
    els.btnConfirmDelete = document.getElementById("btn-confirm-delete");

    // Quick Check & Finder View Elements
    els.personaSelectWrap = document.getElementById("persona-select-wrap");
    els.quickCheckBanner = document.getElementById("quick-check-banner");
    els.quickCheckBannerText = document.getElementById("quick-check-banner-text");
    els.quickConvertCard = document.getElementById("quick-convert-card");
    els.quickConvertTitle = document.getElementById("quick-convert-title");
    els.quickConvertDesc = document.getElementById("quick-convert-desc");
    els.btnQuickConvert = document.getElementById("btn-quick-convert");
    els.btnQuickConvertText = document.getElementById("btn-quick-convert-text");

    // Finder View Elements
    els.questionBox = document.getElementById("question-box");
    els.factsList = document.getElementById("facts-list");
    els.factsCount = document.getElementById("facts-count");

    els.catalogAccordion = document.getElementById("catalog-accordion");
    els.catalogToggle = document.getElementById("catalog-toggle");
    els.catalogContent = document.getElementById("catalog-content");

    els.tabEligible = document.getElementById("tab-eligible");
    els.tabUnknown = document.getElementById("tab-unknown");
    els.tabIneligible = document.getElementById("tab-ineligible");
    els.tabSaved = document.getElementById("tab-saved");
    els.tabSavedLabel = document.getElementById("tab-saved-label");

    els.countEligible = document.getElementById("count-eligible");
    els.countUnknown = document.getElementById("count-unknown");
    els.countIneligible = document.getElementById("count-ineligible");
    els.countSaved = document.getElementById("count-saved");

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

    updateI18nLabels();

    // Hash change routing
    window.addEventListener("hashchange", handleRoute);

    // Initial load: check if helper account exists in meta store
    loadHelperAccount().then((helper) => {
      const rawHash = (window.location.hash || "").trim();
      if (!rawHash || rawHash === "#") {
        if (helper) {
          window.location.hash = "#/helper";
        } else {
          window.location.hash = "#/";
        }
      }
      handleRoute();
    });
    window.__INIT_DONE = true;
    } catch (err) {
      console.error("JanKalyan init error:", err);
      window.__INIT_ERR = err.toString() + "\n" + (err.stack || "");
    }
  }

  function bindEvents() {
    // Language
    if (els.langEn) els.langEn.addEventListener("click", () => setLanguage("en"));
    if (els.langHi) els.langHi.addEventListener("click", () => setLanguage("hi"));
    if (els.langMr) els.langMr.addEventListener("click", () => setLanguage("mr"));

    // Brand logo
    if (els.brandLogo) {
      els.brandLogo.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.hash = "#/";
      });
    }

    // Back button
    if (els.btnBackToDashboard) {
      els.btnBackToDashboard.addEventListener("click", () => {
        window.location.hash = state.helperAccount ? "#/helper" : "#/";
      });
    }

    // Landing Page Buttons
    if (els.btnLandingHelper) {
      els.btnLandingHelper.addEventListener("click", () => {
        if (state.helperAccount) {
          window.location.hash = "#/helper";
        } else {
          if (window.GovDB && window.GovDB.isAvailable()) {
            window.GovDB.getMeta("helper_account").then((acc) => {
              if (acc) {
                state.helperAccount = acc;
                updateHeaderHelperPill();
                window.location.hash = "#/helper";
              } else {
                window.location.hash = "#/setup";
              }
            });
          } else {
            window.location.hash = "#/setup";
          }
        }
      });
    }
    if (els.btnLandingQuick) {
      els.btnLandingQuick.addEventListener("click", () => {
        window.location.hash = "#/quick";
      });
    }

    // Helper Setup Form
    if (els.formHelperSetup) {
      els.formHelperSetup.addEventListener("submit", handleSaveHelperSetup);
    }
    if (els.btnSaveSetup) {
      els.btnSaveSetup.addEventListener("click", handleSaveHelperSetup);
    }
    if (els.btnCancelSetup) {
      els.btnCancelSetup.addEventListener("click", () => {
        window.location.hash = "#/helper";
      });
    }
    if (els.btnEditHelper) {
      els.btnEditHelper.addEventListener("click", () => {
        window.location.hash = "#/setup";
      });
    }

    // Metric Summary Tiles filter clicks
    if (els.metricCardTotal) els.metricCardTotal.addEventListener("click", () => setDashboardStatusFilter("all"));
    if (els.metricCardDocsPending) els.metricCardDocsPending.addEventListener("click", () => setDashboardStatusFilter("Documents pending"));
    if (els.metricCardReady) els.metricCardReady.addEventListener("click", () => setDashboardStatusFilter("Ready to apply"));
    if (els.metricCardApplied) els.metricCardApplied.addEventListener("click", () => setDashboardStatusFilter("Applied"));

    // Profile search input
    if (els.inputProfileSearch) {
      els.inputProfileSearch.addEventListener("input", (e) => {
        state.profileSearchQuery = e.target.value;
        renderDashboardProfiles(state.profiles, state.applications);
      });
    }

    // Quick Check Convert Button
    if (els.btnQuickConvert) {
      els.btnQuickConvert.addEventListener("click", handleQuickCheckConvert);
    }

    // Add Profile Buttons
    if (els.btnAddProfile) els.btnAddProfile.addEventListener("click", () => openAddProfileModal());
    if (els.btnEmptyAddProfile) els.btnEmptyAddProfile.addEventListener("click", () => openAddProfileModal());
    if (els.btnSaveAsProfile) els.btnSaveAsProfile.addEventListener("click", () => {
      if (state.activeProfileId) {
        openAddProfileModal();
      } else {
        handleQuickCheckConvert();
      }
    });

    // Add Profile Modal Actions
    if (els.formAddProfile) {
      els.formAddProfile.addEventListener("submit", (e) => {
        e.preventDefault();
        handleCreateProfile();
      });
    }
    if (els.btnCloseAddModal) els.btnCloseAddModal.addEventListener("click", closeAddProfileModal);
    if (els.btnCancelAddProfile) els.btnCancelAddProfile.addEventListener("click", closeAddProfileModal);
    if (els.btnCreateProfile) {
      els.btnCreateProfile.addEventListener("click", (e) => {
        e.preventDefault();
        handleCreateProfile();
      });
    }
    if (els.modalAddProfile) {
      els.modalAddProfile.addEventListener("click", (e) => {
        if (e.target === els.modalAddProfile) closeAddProfileModal();
      });
    }

    // Delete Confirmation Modal Actions
    if (els.btnCancelDelete) els.btnCancelDelete.addEventListener("click", closeDeleteModal);
    if (els.btnConfirmDelete) els.btnConfirmDelete.addEventListener("click", confirmDeleteProfile);
    if (els.modalConfirmDelete) {
      els.modalConfirmDelete.addEventListener("click", (e) => {
        if (e.target === els.modalConfirmDelete) closeDeleteModal();
      });
    }

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
      const isMr = state.lang === "mr";
      const span = els.catalogToggle.querySelector("span");
      if (span) {
        span.textContent = state.accordionOpen
          ? (isHi ? "बंद करें" : isMr ? "बंद करा" : "Close")
          : (isHi ? "सभी संपादित करें" : isMr ? "सर्व संपादित करा" : "Edit all");
      }
    });

    // Tabs
    els.tabEligible.addEventListener("click", () => setTab("eligible"));
    els.tabUnknown.addEventListener("click", () => setTab("unknown"));
    els.tabIneligible.addEventListener("click", () => setTab("ineligible"));
    if (els.tabSaved) els.tabSaved.addEventListener("click", () => setTab("saved"));

    // Metric Cards Filter Clicks
    if (els.metricCardTotal) els.metricCardTotal.addEventListener("click", () => setDashboardStatusFilter("all"));
    if (els.metricCardReady) els.metricCardReady.addEventListener("click", () => setDashboardStatusFilter("Ready to apply"));
    if (els.metricCardApplied) els.metricCardApplied.addEventListener("click", () => setDashboardStatusFilter("Applied"));
    if (els.btnDashboardFilterClear) els.btnDashboardFilterClear.addEventListener("click", () => setDashboardStatusFilter("all"));

    // Search (Debounced by 200ms)
    let searchDebounceTimer = null;
    els.searchInput.addEventListener("input", (e) => {
      clearTimeout(searchDebounceTimer);
      const query = e.target.value.toLowerCase().trim();
      searchDebounceTimer = setTimeout(() => {
        state.searchQuery = query;
        state.visibleCount = 30;
        resetListScroll();
        const filterData = getFilterData();
        renderSchemes(filterData);
        renderCategoriesRail(filterData);
      }, 200);
    });

    // Delegated event handling on schemes list (Requirement 4: Event delegation)
    if (els.schemesList) {
      els.schemesList.addEventListener("click", (e) => {
        // Save scheme button
        const saveBtn = e.target.closest("[data-action='save-scheme']");
        if (saveBtn) {
          const sid = saveBtn.getAttribute("data-scheme-id");
          handleSaveScheme(sid);
          return;
        }

        // Go to saved chip
        const gotoSaved = e.target.closest("[data-goto-saved]");
        if (gotoSaved) {
          setTab("saved");
          return;
        }

        // Focus field button
        const focusBtn = e.target.closest("[data-focus-field]");
        if (focusBtn) {
          const fid = focusBtn.getAttribute("data-focus-field");
          state.activeField = fid;
          renderQuestionStepper();
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }

        // Toggle benefit clamp (Targeted DOM toggle)
        const toggleBenBtn = e.target.closest("[data-toggle-benefit]");
        if (toggleBenBtn) {
          const sid = toggleBenBtn.getAttribute("data-toggle-benefit");
          const isExpanded = state.expandedBenefits.has(sid);
          if (isExpanded) {
            state.expandedBenefits.delete(sid);
          } else {
            state.expandedBenefits.add(sid);
            const rule = staticRuleMap.get(sid);
            if (rule && !rule.benefit && detailLoadStatus !== "loaded") {
              loadRulesDetail().catch(() => {});
            }
          }
          const benEl = document.getElementById(`benefit-${sid}`);
          if (benEl) {
            benEl.classList.toggle("clamped", isExpanded);
          }
          toggleBenBtn.textContent = !isExpanded
            ? (state.lang === "hi" ? "संक्षेप में देखें" : "Show less")
            : (state.lang === "hi" ? "अधिक पढ़ें" : "Read more");
          return;
        }

        // Toggle docs disclosure (Targeted DOM toggle)
        const toggleDocsBtn = e.target.closest("[data-toggle-docs]");
        if (toggleDocsBtn) {
          const sid = toggleDocsBtn.getAttribute("data-toggle-docs");
          const isOpen = state.openDocDisclosures.has(sid);
          if (isOpen) {
            state.openDocDisclosures.delete(sid);
          } else {
            state.openDocDisclosures.add(sid);
            const rule = staticRuleMap.get(sid);
            if (rule && !rule.documents && detailLoadStatus !== "loaded") {
              loadRulesDetail().catch(() => {});
            }
          }
          const disclosure = toggleDocsBtn.closest(".docs-disclosure");
          if (disclosure) {
            const content = disclosure.querySelector(".docs-content");
            const arrow = toggleDocsBtn.querySelector("svg");
            if (content) content.classList.toggle("open", !isOpen);
            if (arrow) arrow.style.transform = !isOpen ? "rotate(180deg)" : "none";
          }
          return;
        }

        // Show more button
        const showMoreBtn = e.target.closest("#btn-show-more");
        if (showMoreBtn) {
          state.visibleCount += 30;
          const filterData = getFilterData();
          renderSchemes(filterData);
          return;
        }

        // Browse anyway empty state button
        const browseBtn = e.target.closest("#btn-browse-anyway");
        if (browseBtn) {
          state.facts = { _browsing: true };
          evaluationCache.factsVersion++;
          state.visibleCount = 30;
          resetListScroll();
          render();
          return;
        }

        // Clear filters empty state button
        const emptyClearBtn = e.target.closest("#btn-empty-clear-filters");
        if (emptyClearBtn) {
          clearAllFilters();
          return;
        }

        // Remove saved application button
        const removeSavedBtn = e.target.closest("[data-action='remove-saved']");
        if (removeSavedBtn) {
          const appId = removeSavedBtn.getAttribute("data-app-id");
          if (!appId || !window.GovDB) return;
          window.GovDB.deleteApplication(appId).then(() => {
            const app = Array.from(state.profileApplications.values()).find((a) => a.id === appId);
            if (app) state.profileApplications.delete(app.schemeId);
            state.applications = state.applications.filter((a) => a.id !== appId);
            if (els.countSaved) els.countSaved.textContent = String(state.profileApplications.size);
            renderSavedSchemes();
          });
          return;
        }

        // Browse eligible from empty saved tab
        const browseEligibleSaved = e.target.closest("#btn-browse-eligible-saved");
        if (browseEligibleSaved) {
          setTab("eligible");
          return;
        }
      });

      // Delegated change handler
      els.schemesList.addEventListener("change", (e) => {
        // Scheme card doc checklist checkbox
        if (e.target.matches("input[data-doc]")) {
          const docKey = e.target.getAttribute("data-doc");
          if (e.target.checked) {
            state.checkedDocs.add(docKey);
          } else {
            state.checkedDocs.delete(docKey);
          }
          const row = e.target.closest(".doc-check-row");
          if (row) row.classList.toggle("checked", e.target.checked);
          return;
        }

        // Saved scheme status select
        if (e.target.matches("select[data-action='change-status']")) {
          const appId = e.target.getAttribute("data-app-id");
          const app = state.applications.find((a) => a.id === appId);
          if (!app || !window.GovDB) return;
          app.status = e.target.value;
          app.statusUpdatedAt = new Date().toISOString();
          window.GovDB.saveApplication(app).then((saved) => {
            state.profileApplications.set(saved.schemeId, saved);
            const idx = state.applications.findIndex((a) => a.id === saved.id);
            if (idx >= 0) state.applications[idx] = saved;
            else state.applications.push(saved);
            renderSavedSchemes();
          });
          return;
        }

        // Saved scheme doc checklist checkbox
        if (e.target.matches("input[type='checkbox'][data-doc-idx]")) {
          const appId = e.target.getAttribute("data-app-id");
          const docIdx = Number(e.target.getAttribute("data-doc-idx"));
          const app = state.applications.find((a) => a.id === appId);
          if (!app || !window.GovDB) return;
          const set = new Set(app.docsDone || []);
          if (e.target.checked) set.add(docIdx);
          else set.delete(docIdx);
          app.docsDone = Array.from(set);
          window.GovDB.saveApplication(app).then((saved) => {
            state.profileApplications.set(saved.schemeId, saved);
            const idx = state.applications.findIndex((a) => a.id === saved.id);
            if (idx >= 0) state.applications[idx] = saved;
            const row = e.target.closest(".saved-doc-row");
            if (row) row.classList.toggle("checked", e.target.checked);
            const sec = e.target.closest(".saved-docs-section");
            if (sec) {
              const lbl = sec.querySelector(".saved-section-label");
              const allChecks = sec.querySelectorAll("input[type='checkbox']");
              const checkedCount = sec.querySelectorAll("input[type='checkbox']:checked").length;
              if (lbl) {
                lbl.textContent = `${t("docsRequired")} (${checkedCount} / ${allChecks.length})`;
              }
            }
          });
          return;
        }
      });

      // Delegated input handler (notes auto-save)
      els.schemesList.addEventListener("input", (e) => {
        if (e.target.matches("textarea[data-action='edit-note']")) {
          const appId = e.target.getAttribute("data-app-id");
          const app = state.applications.find((a) => a.id === appId);
          if (!app || !window.GovDB) return;
          clearTimeout(noteSaveTimeouts[appId]);
          noteSaveTimeouts[appId] = setTimeout(() => {
            app.note = e.target.value;
            window.GovDB.saveApplication(app).then((saved) => {
              state.profileApplications.set(saved.schemeId, saved);
              const idx = state.applications.findIndex((a) => a.id === saved.id);
              if (idx >= 0) state.applications[idx] = saved;
            });
          }, 300);
        }
      });
    }

    // Schedule background preload of rules_detail.js during idle browser time
    scheduleIdleDetailPreload();
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
    const filterData = getFilterData();
    renderSchemes(filterData);
    renderCategoriesRail(filterData);
  }

  function resetListScroll() {
    state.visibleCount = 30;
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

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .split("&").join("&amp;")
      .split("<").join("&lt;")
      .split(">").join("&gt;")
      .split('"').join("&quot;")
      .split("'").join("&#39;");
  }

  function setLanguage(lang) {
    state.lang = lang;
    document.body.classList.toggle("lang-hi", lang === "hi");
    document.body.classList.toggle("lang-mr", lang === "mr");
    if (els.langEn) els.langEn.classList.toggle("active", lang === "en");
    if (els.langHi) els.langHi.classList.toggle("active", lang === "hi");
    if (els.langMr) els.langMr.classList.toggle("active", lang === "mr");
    if (state.helperAccount) {
      state.helperAccount.language = lang;
      if (window.GovDB && window.GovDB.isAvailable()) {
        window.GovDB.setMeta("helper_account", state.helperAccount).catch(() => {});
      }
    }
    updateI18nLabels();
    populatePersonaDropdown();
    populateManualCatalog();
    if (state.currentView === "helper" || state.currentView === "dashboard") {
      refreshDashboard();
    } else if (state.currentView === "finder") {
      render();
    }
  }

  function updateI18nLabels() {
    // Landing
    if (els.landingLine1) els.landingLine1.textContent = t("landingLine1");
    if (els.landingLine2) els.landingLine2.textContent = t("landingLine2");
    if (els.btnLandingHelperText) els.btnLandingHelperText.textContent = t("imHelper");
    if (els.btnLandingHelperSub) els.btnLandingHelperSub.textContent = t("imHelperSub");
    if (els.btnLandingQuickText) els.btnLandingQuickText.textContent = t("quickCheckBtn");
    if (els.btnLandingQuickSub) els.btnLandingQuickSub.textContent = t("quickCheckSub");
    if (els.landingPrivacyNote) els.landingPrivacyNote.textContent = t("landingPrivacyNote");

    // Helper Setup
    if (els.setupTitleText) els.setupTitleText.textContent = t("setupTitle");
    if (els.setupNoticeText) els.setupNoticeText.textContent = t("setupNotice");
    if (els.labelHelperName) els.labelHelperName.textContent = t("labelHelperName");
    if (els.labelHelperType) els.labelHelperType.textContent = t("labelHelperType");
    if (els.labelHelperDistrict) els.labelHelperDistrict.textContent = t("labelDistrict");
    if (els.labelHelperLanguage) els.labelHelperLanguage.textContent = t("labelLanguage");
    if (els.btnSaveSetup) els.btnSaveSetup.textContent = t("saveAndContinue");
    if (els.btnCancelSetup) els.btnCancelSetup.textContent = t("cancel");

    // Helper Welcome & Home
    if (els.btnEditHelperText) els.btnEditHelperText.textContent = t("editHelperDetails");
    if (els.dashboardTitleText) els.dashboardTitleText.textContent = t("dashboardTitle");
    if (els.dashboardSubtitleText) els.dashboardSubtitleText.textContent = t("dashboardSubtitle");
    if (els.btnAddProfileText) els.btnAddProfileText.textContent = t("addProfile");
    if (els.metricLabelTotal) els.metricLabelTotal.textContent = t("totalProfiles");
    if (els.metricLabelDocsPending) els.metricLabelDocsPending.textContent = t("docsPending");
    if (els.metricLabelReady) els.metricLabelReady.textContent = t("readyToApply");
    if (els.metricLabelApplied) els.metricLabelApplied.textContent = t("applied");

    // Follow-up
    if (els.followupTitle) els.followupTitle.textContent = t("needsFollowUp");
    if (els.followupSubtext) els.followupSubtext.textContent = t("needsFollowUpSub");
    if (els.followupEmptyText) els.followupEmptyText.textContent = t("noFollowUp");

    // Profile search
    if (els.inputProfileSearch) els.inputProfileSearch.placeholder = t("searchProfilesPlaceholder");

    // Quick Check & Finder
    if (els.quickCheckBannerText) els.quickCheckBannerText.textContent = t("quickCheckBanner");
    if (els.quickConvertTitle) els.quickConvertTitle.textContent = t("quickConvertTitle");
    if (els.quickConvertDesc) els.quickConvertDesc.textContent = t("quickConvertDesc");
    if (els.btnQuickConvertText) {
      els.btnQuickConvertText.textContent = state.helperAccount ? t("saveAsProfile") : t("setUpAsHelper");
    }

    // Profiles List & Modals
    if (els.emptyStatePrimary) els.emptyStatePrimary.textContent = t("noProfilesPrimary");
    if (els.emptyStateSecondary) els.emptyStateSecondary.textContent = t("noProfilesSecondary");
    if (els.btnEmptyAddProfile) els.btnEmptyAddProfile.textContent = t("addProfile");
    if (els.btnBackText) {
      els.btnBackText.textContent = (state.currentView === "setup" || state.currentView === "finder")
        ? (state.helperAccount ? t("helperHome") : "Home")
        : t("backToProfiles");
    }
    if (els.btnSaveAsProfileText) els.btnSaveAsProfileText.textContent = t("saveAsProfile");
    if (els.modalAddTitle) els.modalAddTitle.textContent = t("modalAddTitle");
    if (els.labelProfileName) els.labelProfileName.textContent = t("labelProfileName");
    if (els.consentTextLabel) els.consentTextLabel.textContent = t("consentText");
    if (els.consentNoteText) els.consentNoteText.textContent = t("consentNote");
    if (els.btnCreateProfile) els.btnCreateProfile.textContent = t("modalCreateBtn");
    if (els.btnCancelAddProfile) els.btnCancelAddProfile.textContent = t("cancel");
    if (els.modalDeleteTitle) els.modalDeleteTitle.textContent = t("modalDeleteTitle");
    if (els.deleteConfirmText) els.deleteConfirmText.textContent = t("deleteConfirmText");
    if (els.btnConfirmDelete) els.btnConfirmDelete.textContent = t("btnConfirmDelete");
    if (els.btnCancelDelete) els.btnCancelDelete.textContent = t("cancel");
    if (els.tabSavedLabel) els.tabSavedLabel.textContent = t("schemesTab");
    if (els.filterBarTitle) els.filterBarTitle.textContent = t("filterLabel");
    if (els.btnDashboardFilterClear) els.btnDashboardFilterClear.textContent = t("showAll");
  }

  function updateHeaderHelperPill() {
    if (!els.headerHelperPill) return;
    if (state.helperAccount && state.helperAccount.name) {
      els.headerHelperPill.style.display = "inline-flex";
      if (els.headerHelperName) {
        els.headerHelperName.textContent = state.helperAccount.name;
      }
      if (els.headerHelperRole) {
        els.headerHelperRole.textContent = state.helperAccount.helper_type || "ASHA";
      }
      els.headerHelperPill.onclick = () => {
        window.location.hash = "#/setup";
      };
    } else {
      els.headerHelperPill.style.display = "none";
    }
  }

  function updateHelperWelcomeBar() {
    if (state.helperAccount && state.helperAccount.name) {
      if (els.helperWelcomeBar) els.helperWelcomeBar.style.display = "flex";
      if (els.helperTagRole) els.helperTagRole.textContent = state.helperAccount.helper_type || "ASHA";
      if (els.helperTagName) els.helperTagName.textContent = state.helperAccount.name;
      if (els.helperTagDistrict) {
        if (state.helperAccount.district) {
          els.helperTagDistrict.textContent = state.helperAccount.district;
          els.helperTagDistrict.style.display = "inline-block";
        } else {
          els.helperTagDistrict.style.display = "none";
        }
      }
    } else {
      if (els.helperWelcomeBar) els.helperWelcomeBar.style.display = "none";
    }
  }

  function loadHelperAccount() {
    if (!window.GovDB || !window.GovDB.isAvailable()) {
      return Promise.resolve(null);
    }
    return window.GovDB.getMeta("helper_account")
      .then((account) => {
        state.helperAccount = account || null;
        updateHeaderHelperPill();
        if (account && account.language && ["en", "hi", "mr"].includes(account.language)) {
          if (state.lang !== account.language) {
            setLanguage(account.language);
          }
        }
        return account;
      })
      .catch((err) => {
        console.warn("Could not load helper account:", err);
        return null;
      });
  }

  function handleSaveHelperSetup(e) {
    if (e && e.preventDefault) e.preventDefault();
    const name = els.inputHelperName ? els.inputHelperName.value.trim() : "";
    const helperType = els.selectHelperType ? els.selectHelperType.value : "ASHA";
    const district = els.inputHelperDistrict ? els.inputHelperDistrict.value.trim() : "";
    const language = els.selectHelperLanguage ? els.selectHelperLanguage.value : state.lang;

    if (!name) {
      if (els.setupErrorMsg) {
        els.setupErrorMsg.textContent = t("errNameRequired") || "Helper full name is required.";
        els.setupErrorMsg.style.display = "block";
      }
      if (els.inputHelperName) els.inputHelperName.focus();
      return;
    }

    if (els.setupErrorMsg) {
      els.setupErrorMsg.textContent = "";
      els.setupErrorMsg.style.display = "none";
    }

    const helperData = {
      name,
      helper_type: helperType,
      district,
      language,
      createdAt: state.helperAccount ? state.helperAccount.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (window.GovDB && window.GovDB.isAvailable()) {
      window.GovDB.setMeta("helper_account", helperData)
        .then(() => {
          state.helperAccount = helperData;
          updateHeaderHelperPill();
          if (language && language !== state.lang) {
            setLanguage(language);
          }

          if (state.pendingQuickCheckConversion) {
            state.pendingQuickCheckConversion = false;
            window.location.hash = "#/helper";
            openAddProfileModal(state.pendingQuickCheckFacts);
          } else {
            window.location.hash = "#/helper";
          }
        })
        .catch((err) => {
          console.error("Failed to save helper account:", err);
          if (els.setupErrorMsg) {
            els.setupErrorMsg.textContent = "Failed to save helper account: " + err.message;
            els.setupErrorMsg.style.display = "block";
          }
        });
    } else {
      state.helperAccount = helperData;
      updateHeaderHelperPill();
      if (state.pendingQuickCheckConversion) {
        state.pendingQuickCheckConversion = false;
        window.location.hash = "#/helper";
        openAddProfileModal(state.pendingQuickCheckFacts);
      } else {
        window.location.hash = "#/helper";
      }
    }
  }

  function handleRoute() {
    const rawHash = (window.location.hash || "").trim();

    if (!rawHash || rawHash === "#" || rawHash === "#/") {
      showLandingView();
      return;
    }

    if (rawHash === "#/setup") {
      showSetupView();
      return;
    }

    if (rawHash === "#/helper") {
      checkHelperAndShowHome();
      return;
    }

    if (rawHash.startsWith("#/profile/")) {
      const id = rawHash.replace("#/profile/", "").trim();
      if (id) {
        openProfile(id);
      } else {
        window.location.hash = "#/helper";
      }
      return;
    }

    if (rawHash === "#/quick") {
      showQuickCheck();
      return;
    }

    // Default fallback
    window.location.hash = "#/";
  }

  function showLandingView() {
    switchView("landing");
  }

  function showSetupView() {
    switchView("setup");
    if (els.setupErrorMsg) {
      els.setupErrorMsg.style.display = "none";
      els.setupErrorMsg.textContent = "";
    }
    if (state.helperAccount) {
      if (els.inputHelperName) els.inputHelperName.value = state.helperAccount.name || "";
      if (els.selectHelperType) els.selectHelperType.value = state.helperAccount.helper_type || "ASHA";
      if (els.inputHelperDistrict) els.inputHelperDistrict.value = state.helperAccount.district || "";
      if (els.selectHelperLanguage) els.selectHelperLanguage.value = state.helperAccount.language || state.lang;
      if (els.btnCancelSetup) els.btnCancelSetup.style.display = "inline-flex";
    } else {
      if (els.inputHelperName) els.inputHelperName.value = "";
      if (els.selectHelperType) els.selectHelperType.value = "ASHA";
      if (els.inputHelperDistrict) els.inputHelperDistrict.value = "";
      if (els.selectHelperLanguage) els.selectHelperLanguage.value = state.lang;
      if (els.btnCancelSetup) els.btnCancelSetup.style.display = "none";
    }
  }

  function checkHelperAndShowHome() {
    if (!state.helperAccount) {
      if (window.GovDB && window.GovDB.isAvailable()) {
        window.GovDB.getMeta("helper_account").then((acc) => {
          if (acc) {
            state.helperAccount = acc;
            updateHeaderHelperPill();
            showHelperHome();
          } else {
            window.location.hash = "#/setup";
          }
        });
        return;
      } else {
        window.location.hash = "#/setup";
        return;
      }
    }
    showHelperHome();
  }

  function showHelperHome() {
    switchView("helper");
    updateHelperWelcomeBar();
    refreshDashboard();
  }

  function showQuickCheck() {
    startQuickCheck();
  }

  function handleQuickCheckConvert() {
    if (!state.helperAccount) {
      state.pendingQuickCheckFacts = JSON.parse(JSON.stringify(state.facts || {}));
      state.pendingQuickCheckConversion = true;
      window.location.hash = "#/setup";
    } else {
      openAddProfileModal(state.facts);
    }
  }

  function switchView(viewName) {
    state.currentView = viewName;

    const isLanding = viewName === "landing";
    const isSetup = viewName === "setup";
    const isHelper = viewName === "helper" || viewName === "dashboard";
    const isFinder = viewName === "finder";

    if (els.landingView) els.landingView.style.display = isLanding ? "block" : "none";
    if (els.setupView) els.setupView.style.display = isSetup ? "block" : "none";
    if (els.dashboardView) els.dashboardView.style.display = isHelper ? "block" : "none";
    if (els.finderView) els.finderView.style.display = isFinder ? "" : "none";

    // Header controls & sub-banners
    if (isLanding) {
      if (els.btnBackToDashboard) els.btnBackToDashboard.style.display = "none";
      if (els.activeProfilePill) els.activeProfilePill.style.display = "none";
      if (els.btnSaveAsProfile) els.btnSaveAsProfile.style.display = "none";
      if (els.personaSelectWrap) els.personaSelectWrap.style.display = "none";
      if (els.resetBtn) els.resetBtn.style.display = "none";
      if (els.quickCheckBanner) els.quickCheckBanner.style.display = "none";
      if (els.quickConvertCard) els.quickConvertCard.style.display = "none";
    } else if (isSetup) {
      if (els.btnBackToDashboard) {
        els.btnBackToDashboard.style.display = state.helperAccount ? "inline-flex" : "none";
        if (els.btnBackText) els.btnBackText.textContent = t("helperHome");
      }
      if (els.activeProfilePill) els.activeProfilePill.style.display = "none";
      if (els.btnSaveAsProfile) els.btnSaveAsProfile.style.display = "none";
      if (els.personaSelectWrap) els.personaSelectWrap.style.display = "none";
      if (els.resetBtn) els.resetBtn.style.display = "none";
      if (els.quickCheckBanner) els.quickCheckBanner.style.display = "none";
      if (els.quickConvertCard) els.quickConvertCard.style.display = "none";
    } else if (isHelper) {
      if (els.btnBackToDashboard) els.btnBackToDashboard.style.display = "none";
      if (els.activeProfilePill) els.activeProfilePill.style.display = "none";
      if (els.btnSaveAsProfile) els.btnSaveAsProfile.style.display = "none";
      if (els.personaSelectWrap) els.personaSelectWrap.style.display = "none";
      if (els.resetBtn) els.resetBtn.style.display = "none";
      if (els.quickCheckBanner) els.quickCheckBanner.style.display = "none";
      if (els.quickConvertCard) els.quickConvertCard.style.display = "none";
    } else if (isFinder) {
      if (state.activeProfileId) {
        // Beneficiary profile mode
        if (els.btnBackToDashboard) {
          els.btnBackToDashboard.style.display = "inline-flex";
          if (els.btnBackText) els.btnBackText.textContent = t("helperHome");
        }
        if (els.activeProfilePill) {
          els.activeProfilePill.style.display = "inline-flex";
          if (els.activeProfileName) els.activeProfileName.textContent = state.activeProfileName;
          if (els.activeProfileSaveStatus) els.activeProfileSaveStatus.textContent = t("saved");
        }
        if (els.btnSaveAsProfile) els.btnSaveAsProfile.style.display = "none";
        if (els.personaSelectWrap) els.personaSelectWrap.style.display = "none";
        if (els.resetBtn) els.resetBtn.style.display = "inline-flex";
        if (els.quickCheckBanner) els.quickCheckBanner.style.display = "none";
        if (els.quickConvertCard) els.quickConvertCard.style.display = "none";
      } else {
        // Quick check mode
        if (els.btnBackToDashboard) {
          els.btnBackToDashboard.style.display = "inline-flex";
          if (els.btnBackText) els.btnBackText.textContent = state.helperAccount ? t("helperHome") : "Home";
        }
        if (els.activeProfilePill) {
          els.activeProfilePill.style.display = "inline-flex";
          if (els.activeProfileName) els.activeProfileName.textContent = t("quickCheckSession");
          if (els.activeProfileSaveStatus) els.activeProfileSaveStatus.textContent = "";
        }
        if (els.btnSaveAsProfile) els.btnSaveAsProfile.style.display = "inline-flex";
        if (els.personaSelectWrap) els.personaSelectWrap.style.display = "inline-flex";
        if (els.resetBtn) els.resetBtn.style.display = "inline-flex";
        if (els.quickCheckBanner) els.quickCheckBanner.style.display = "flex";
        if (els.quickConvertCard) els.quickConvertCard.style.display = "flex";
        if (els.btnQuickConvertText) {
          els.btnQuickConvertText.textContent = state.helperAccount ? t("saveAsProfile") : t("setUpAsHelper");
        }
      }

      updateActiveQuestion();
      render();
    }

    updateHeaderHelperPill();
    updateI18nLabels();
  }

  function startQuickCheck() {
    if (state.activeProfileId) {
      state.activeProfileId = null;
      state.activeProfileName = "";
      state.facts = {};
    }
    state.checkedDocs.clear();
    state.selectedCategories.clear();
    state.selectedLevels.clear();
    state.selectedScopes.clear();
    state.searchQuery = "";
    state.profileApplications = new Map();
    if (els.countSaved) els.countSaved.textContent = "0";
    if (els.searchInput) els.searchInput.value = "";
    state.currentTab = "eligible";
    switchView("finder");
  }

  function openProfile(id) {
    if (!window.GovDB || !window.GovDB.isAvailable()) return;
    Promise.all([
      window.GovDB.getProfile(id),
      window.GovDB.getApplicationsByProfile(id),
    ])
      .then(([profile, applications]) => {
        if (!profile) {
          window.location.hash = "#/helper";
          return;
        }
        state.activeProfileId = profile.id;
        state.activeProfileName = profile.name;
        state.facts = JSON.parse(JSON.stringify(profile.facts || {}));
        state.checkedDocs.clear();
        state.selectedCategories.clear();
        state.selectedLevels.clear();
        state.selectedScopes.clear();
        state.searchQuery = "";

        state.profileApplications = new Map();
        (applications || []).forEach((app) => {
          state.profileApplications.set(app.schemeId, app);
        });
        if (els.countSaved) {
          els.countSaved.textContent = String(state.profileApplications.size);
        }

        if (els.searchInput) els.searchInput.value = "";
        if (els.personaSelect) els.personaSelect.value = "";
        state.currentTab = "eligible";
        switchView("finder");
      })
      .catch((err) => {
        console.error("Error opening profile:", err);
        window.location.hash = "#/helper";
      });
  }

  function openAddProfileModal(prefilledFacts) {
    if (els.btnCreateProfile) els.btnCreateProfile.disabled = false;
    if (els.inputProfileName) els.inputProfileName.value = "";
    if (els.checkProfileConsent) els.checkProfileConsent.checked = false;
    if (els.addProfileError) {
      els.addProfileError.textContent = "";
      els.addProfileError.style.display = "none";
    }
    state.tempModalFacts = prefilledFacts ? JSON.parse(JSON.stringify(prefilledFacts)) : null;

    if (els.modalAddProfile) {
      els.modalAddProfile.style.display = "flex";
      if (els.inputProfileName) els.inputProfileName.focus();
    }
  }

  function closeAddProfileModal() {
    if (els.modalAddProfile) {
      els.modalAddProfile.style.display = "none";
    }
    state.tempModalFacts = null;
    if (els.inputProfileName) els.inputProfileName.value = "";
    if (els.checkProfileConsent) els.checkProfileConsent.checked = false;
    if (els.addProfileError) {
      els.addProfileError.textContent = "";
      els.addProfileError.style.display = "none";
    }
  }

  function handleCreateProfile() {
    if (!els.inputProfileName || !els.checkProfileConsent) return;
    const name = els.inputProfileName.value.trim();
    const consent = els.checkProfileConsent.checked;

    if (!name || !consent) {
      if (els.addProfileError) {
        els.addProfileError.textContent = t("consentRequired") || "Please enter a name and confirm beneficiary consent.";
        els.addProfileError.style.display = "block";
      }
      return;
    }

    if (!window.GovDB || !window.GovDB.isAvailable()) {
      if (els.addProfileError) {
        els.addProfileError.textContent = "Local storage is not available.";
        els.addProfileError.style.display = "block";
      }
      return;
    }

    if (els.btnCreateProfile) els.btnCreateProfile.disabled = true;

    const factsToSave = state.tempModalFacts || state.pendingQuickCheckFacts || {};
    const newProfile = {
      name: name,
      consent: true,
      consentGiven: true,
      consentDate: new Date().toISOString(),
      facts: JSON.parse(JSON.stringify(factsToSave)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    window.GovDB.saveProfile(newProfile)
      .then((saved) => {
        state.pendingQuickCheckFacts = null;
        state.pendingQuickCheckConversion = false;
        closeAddProfileModal();
        window.location.hash = `#/profile/${saved.id}`;
      })
      .catch((err) => {
        console.error("Error creating profile:", err);
        if (els.addProfileError) {
          els.addProfileError.textContent = "Failed to save profile. Please try again.";
          els.addProfileError.style.display = "block";
        }
        if (els.btnCreateProfile) els.btnCreateProfile.disabled = false;
      });
  }

  function promptDeleteProfile(profileId) {
    state.pendingDeleteProfileId = profileId;
    if (els.modalConfirmDelete) {
      els.modalConfirmDelete.style.display = "flex";
    }
  }

  function closeDeleteModal() {
    state.pendingDeleteProfileId = null;
    if (els.modalConfirmDelete) {
      els.modalConfirmDelete.style.display = "none";
    }
  }

  function confirmDeleteProfile() {
    if (!state.pendingDeleteProfileId || !window.GovDB || !window.GovDB.isAvailable()) {
      closeDeleteModal();
      return;
    }

    const idToDelete = state.pendingDeleteProfileId;
    window.GovDB.deleteProfile(idToDelete)
      .then(() => {
        closeDeleteModal();
        refreshDashboard();
      })
      .catch((err) => {
        console.error("Failed to delete profile:", err);
        closeDeleteModal();
      });
  }

  let autoSaveTimeout = null;
  function autoSaveActiveProfile() {
    if (!state.activeProfileId || !window.GovDB || !window.GovDB.isAvailable()) return;
    if (els.activeProfileSaveStatus) {
      els.activeProfileSaveStatus.textContent = t("saving");
    }
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
      window.GovDB.getProfile(state.activeProfileId)
        .then((profile) => {
          if (!profile) return;
          profile.facts = JSON.parse(JSON.stringify(state.facts));
          return window.GovDB.saveProfile(profile);
        })
        .then(() => {
          if (els.activeProfileSaveStatus) {
            els.activeProfileSaveStatus.textContent = t("saved");
          }
        })
        .catch((err) => {
          console.error("Failed to auto-save profile:", err);
          if (els.activeProfileSaveStatus) {
            els.activeProfileSaveStatus.textContent = "Error";
          }
        });
    }, 250);
  }

  function setDashboardStatusFilter(status) {
    state.dashboardStatusFilter = status;
    refreshDashboard();
  }

  function refreshDashboard() {
    updateI18nLabels();
    updateHelperWelcomeBar();

    if (!window.GovDB || !window.GovDB.isAvailable()) {
      if (els.dbUnavailableBanner) els.dbUnavailableBanner.style.display = "block";
      if (els.profilesEmptyState) els.profilesEmptyState.style.display = "flex";
      if (els.profilesList) els.profilesList.innerHTML = "";
      if (els.statTotalProfiles) els.statTotalProfiles.textContent = "0";
      if (els.statDocsPending) els.statDocsPending.textContent = "0";
      if (els.statReadyApply) els.statReadyApply.textContent = "0";
      if (els.statApplied) els.statApplied.textContent = "0";
      if (els.followupEmpty) els.followupEmpty.style.display = "block";
      if (els.followupList) els.followupList.innerHTML = "";
      return;
    }

    if (els.dbUnavailableBanner) els.dbUnavailableBanner.style.display = "none";

    Promise.all([
      window.GovDB.getAllProfiles(),
      window.GovDB.getAllApplications(),
    ])
      .then(([profiles, applications]) => {
        state.profiles = profiles || [];
        state.applications = applications || [];
        renderDashboardProfiles(state.profiles, state.applications);
        renderFollowUpList(state.profiles, state.applications);
      })
      .catch((err) => {
        console.error("Error loading profiles & applications:", err);
        if (els.profilesEmptyState) els.profilesEmptyState.style.display = "flex";
        if (els.profilesList) els.profilesList.innerHTML = "";
      });
  }

  function renderFollowUpList(profiles, applications) {
    if (!els.followupList) return;

    const profileMap = new Map();
    (profiles || []).forEach((p) => profileMap.set(p.id, p));

    const now = Date.now();
    const followUps = [];

    (applications || []).forEach((app) => {
      if (app.status === "Documents pending" || app.status === "Ready to apply") {
        const updatedTime = app.statusUpdatedAt ? new Date(app.statusUpdatedAt).getTime() : 0;
        if (updatedTime > 0) {
          const diffMs = now - updatedTime;
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays >= FOLLOW_UP_THRESHOLD_DAYS) {
            const profile = profileMap.get(app.profileId);
            if (profile) {
              followUps.push({
                app,
                profile,
                days: diffDays,
              });
            }
          }
        }
      }
    });

    // Sort oldest first (highest number of elapsed days first)
    followUps.sort((a, b) => b.days - a.days);

    if (els.followupBadge) {
      els.followupBadge.textContent = String(followUps.length);
    }

    if (followUps.length === 0) {
      if (els.followupEmpty) els.followupEmpty.style.display = "block";
      els.followupList.innerHTML = "";
      return;
    }

    if (els.followupEmpty) els.followupEmpty.style.display = "none";

    els.followupList.innerHTML = followUps
      .map((item) => {
        const ruleName = getRuleName(item.app.schemeId);
        const meta = (window.GovStatus && window.GovStatus.getStatusMeta)
          ? window.GovStatus.getStatusMeta(item.app.status)
          : { slug: "docs-pending" };
        const statusLabel = (window.GovStatus && window.GovStatus.getStatusLabel)
          ? window.GovStatus.getStatusLabel(item.app.status, state.lang)
          : item.app.status;
        const daysLabel = item.days === 1 ? (t("day") || "day") : (t("days") || "days");
        const daysText = `${item.days} ${daysLabel}`;

        return `
          <div class="followup-card" data-profile-id="${item.profile.id}" role="button" tabindex="0">
            <div class="followup-card-top">
              <span class="followup-beneficiary">${escapeHtml(item.profile.name)}</span>
              <span class="followup-days-badge">${daysText}</span>
            </div>
            <div class="followup-scheme">${escapeHtml(ruleName)}</div>
            <span class="status-chip chip-${meta.slug} followup-status-tag">
              <span class="status-chip-dot"></span>
              <span>${escapeHtml(statusLabel)}</span>
            </span>
          </div>
        `;
      })
      .join("");

    els.followupList.querySelectorAll(".followup-card").forEach((card) => {
      card.addEventListener("click", () => {
        const profId = card.getAttribute("data-profile-id");
        if (profId) {
          window.location.hash = `#/profile/${profId}`;
        }
      });
    });
  }

  function getRuleName(schemeId) {
    if (!schemeId) return "";
    if (typeof staticRuleMap !== "undefined" && staticRuleMap && staticRuleMap.has(schemeId)) {
      const r = staticRuleMap.get(schemeId);
      return r.name || r.id || schemeId;
    }
    const rules = window.ALL_RULES || [];
    const found = rules.find((r) => r.id === schemeId);
    return found ? (found.name || found.id) : schemeId;
  }

  function renderDashboardProfiles(profiles, applications) {
    const rules = window.ALL_RULES || [];
    const count = profiles.length;
    const allApps = applications || [];

    const docsPendingCount = allApps.filter((a) => a.status === "Documents pending").length;
    const readyToApplyCount = allApps.filter((a) => a.status === "Ready to apply").length;
    const appliedCount = allApps.filter((a) => a.status === "Applied").length;

    if (els.statTotalProfiles) els.statTotalProfiles.textContent = String(count);
    if (els.statDocsPending) els.statDocsPending.textContent = String(docsPendingCount);
    if (els.statReadyApply) els.statReadyApply.textContent = String(readyToApplyCount);
    if (els.statApplied) els.statApplied.textContent = String(appliedCount);

    if (els.metricCardTotal) els.metricCardTotal.classList.toggle("active-filter", state.dashboardStatusFilter === "all");
    if (els.metricCardDocsPending) els.metricCardDocsPending.classList.toggle("active-filter", state.dashboardStatusFilter === "Documents pending");
    if (els.metricCardReady) els.metricCardReady.classList.toggle("active-filter", state.dashboardStatusFilter === "Ready to apply");
    if (els.metricCardApplied) els.metricCardApplied.classList.toggle("active-filter", state.dashboardStatusFilter === "Applied");

    // Render filter chips
    renderDashboardFilterChips(profiles, allApps);

    if (count === 0) {
      if (els.profilesEmptyState) els.profilesEmptyState.style.display = "flex";
      if (els.profilesList) els.profilesList.innerHTML = "";
      if (els.dashboardFilterBar) els.dashboardFilterBar.style.display = "none";
      return;
    }

    if (els.dashboardFilterBar) els.dashboardFilterBar.style.display = "flex";

    // Filter profiles by status and search query
    let filteredProfiles = profiles;
    if (state.dashboardStatusFilter !== "all") {
      filteredProfiles = profiles.filter((p) =>
        allApps.some((a) => a.profileId === p.id && a.status === state.dashboardStatusFilter)
      );
    }
    if (state.profileSearchQuery && state.profileSearchQuery.trim()) {
      const q = state.profileSearchQuery.trim().toLowerCase();
      filteredProfiles = filteredProfiles.filter((p) =>
        (p.name || "").toLowerCase().includes(q)
      );
    }

    if (filteredProfiles.length === 0) {
      if (els.profilesEmptyState) els.profilesEmptyState.style.display = "none";
      els.profilesList.innerHTML = `
        <div class="empty-state-editorial" style="grid-column: 1 / -1;">
          <div class="msg-primary">${t("noFilteredProfilesPrimary")}</div>
          <div class="msg-secondary">${t("noFilteredProfilesSecondary")}</div>
          <button class="btn-secondary" id="btn-clear-dash-filter" style="margin-top: 14px;" type="button">
            ${t("clearFilter")}
          </button>
        </div>
      `;
      const clrBtn = document.getElementById("btn-clear-dash-filter");
      if (clrBtn) {
        clrBtn.onclick = () => {
          state.profileSearchQuery = "";
          if (els.inputProfileSearch) els.inputProfileSearch.value = "";
          setDashboardStatusFilter("all");
        };
      }
      return;
    }

    if (els.profilesEmptyState) els.profilesEmptyState.style.display = "none";

    const cardsHtml = filteredProfiles.map((p) => {
      const pFacts = p.facts || {};
      const evalResults = window.GovEngine.evaluateAll(rules, pFacts);
      const eligibleCount = evalResults.filter((r) => r.result === "eligible").length;
      const unknownCount = evalResults.filter((r) => r.result === "unknown").length;

      const ageStr = pFacts.age != null ? `${pFacts.age} yr` : "";
      const genderStr = pFacts.gender ? pFacts.gender.charAt(0).toUpperCase() + pFacts.gender.slice(1) : "";
      const stateStr = pFacts.household && pFacts.household.state ? pFacts.household.state : "";

      const demoParts = [ageStr, genderStr, stateStr].filter(Boolean);
      const demoBadge = demoParts.length > 0 ? demoParts.join(" • ") : t("noSpecificAge");

      // Applications for this profile
      const profApps = allApps.filter((a) => a.profileId === p.id);
      let appBadgesHtml = "";
      if (profApps.length > 0) {
        appBadgesHtml = `
          <div class="profile-card-app-badges">
            ${profApps.map((a) => {
              const meta = (window.GovStatus && window.GovStatus.getStatusMeta)
                ? window.GovStatus.getStatusMeta(a.status)
                : { slug: "saved" };
              const label = (window.GovStatus && window.GovStatus.getStatusLabel)
                ? window.GovStatus.getStatusLabel(a.status, state.lang)
                : a.status;
              return `
                <span class="status-chip chip-${meta.slug}" title="${escapeHtml(a.schemeId)}">
                  <span class="status-chip-dot"></span>
                  <span>${escapeHtml(label)}</span>
                </span>
              `;
            }).join("")}
          </div>
        `;
      }

      return `
        <div class="profile-card" data-profile-id="${p.id}">
          <div class="profile-card-top">
            <div>
              <h3 class="profile-card-name">${escapeHtml(p.name)}</h3>
              <span class="profile-card-age">${escapeHtml(demoBadge)}</span>
            </div>
          </div>
          <div class="profile-card-stats">
            <div class="profile-stat-item">
              <span class="stat-item-label">${t("eligibleSchemesCount")}</span>
              <span class="stat-item-badge">${eligibleCount}</span>
            </div>
            <div class="profile-stat-item">
              <span class="stat-item-label">${t("needsInfoSchemesCount")}</span>
              <span style="font-size: 12px; color: var(--text-muted);">${unknownCount}</span>
            </div>
          </div>
          ${appBadgesHtml}
          <div class="profile-card-actions">
            <button class="btn-primary btn-card-open" type="button" data-action="open-profile" data-profile-id="${p.id}">
              ${t("checkSchemes")}
            </button>
            <button class="btn-secondary btn-card-delete" type="button" data-action="delete-profile" data-profile-id="${p.id}" aria-label="${t("delete")}">
              ${t("delete")}
            </button>
          </div>
        </div>
      `;
    }).join("");

    els.profilesList.innerHTML = cardsHtml;

    els.profilesList.querySelectorAll(".profile-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("button[data-action='delete-profile']")) return;
        const profId = card.getAttribute("data-profile-id");
        if (profId) window.location.hash = `#/profile/${profId}`;
      });
    });

    els.profilesList.querySelectorAll("button[data-action='open-profile']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const profId = btn.getAttribute("data-profile-id");
        window.location.hash = `#/profile/${profId}`;
      });
    });

    els.profilesList.querySelectorAll("button[data-action='delete-profile']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const profId = btn.getAttribute("data-profile-id");
        promptDeleteProfile(profId);
      });
    });
  }

  function renderDashboardFilterChips(profiles, applications) {
    if (!els.dashboardFilterChips) return;

    const statuses = (window.GovStatus && window.GovStatus.STATUSES)
      ? window.GovStatus.STATUSES
      : (window.APPLICATION_STATUSES || []);
    const isAllActive = state.dashboardStatusFilter === "all";

    if (els.btnDashboardFilterClear) {
      els.btnDashboardFilterClear.style.display = isAllActive ? "none" : "inline-block";
    }

    const allChipHtml = `
      <button class="filter-status-chip ${isAllActive ? "active" : ""}" type="button" data-filter-status="all">
        <span>${t("filterAllStatuses")}</span>
        <span class="filter-status-count">${profiles.length}</span>
      </button>
    `;

    const statusChipsHtml = statuses.map((st) => {
      const isActive = state.dashboardStatusFilter === st;
      const count = profiles.filter((p) =>
        applications.some((a) => a.profileId === p.id && a.status === st)
      ).length;
      const label = (window.GovStatus && window.GovStatus.getStatusLabel)
        ? window.GovStatus.getStatusLabel(st, state.lang)
        : st;
      return `
        <button class="filter-status-chip ${isActive ? "active" : ""}" type="button" data-filter-status="${escapeHtml(st)}">
          <span>${escapeHtml(label)}</span>
          <span class="filter-status-count">${count}</span>
        </button>
      `;
    }).join("");

    els.dashboardFilterChips.innerHTML = allChipHtml + statusChipsHtml;

    els.dashboardFilterChips.querySelectorAll("button[data-filter-status]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const st = btn.getAttribute("data-filter-status");
        setDashboardStatusFilter(st);
      });
    });
  }

  function setTab(tab) {
    state.currentTab = tab;
    state.visibleCount = 30;
    resetListScroll();
    [els.tabEligible, els.tabUnknown, els.tabIneligible, els.tabSaved].forEach((btn) => {
      if (btn) btn.classList.remove("active");
    });
    if (tab === "eligible" && els.tabEligible) els.tabEligible.classList.add("active");
    if (tab === "unknown" && els.tabUnknown) els.tabUnknown.classList.add("active");
    if (tab === "ineligible" && els.tabIneligible) els.tabIneligible.classList.add("active");
    if (tab === "saved" && els.tabSaved) els.tabSaved.classList.add("active");

    if (tab === "saved") {
      renderSavedSchemes();
    } else {
      const filterData = getFilterData();
      renderSchemes(filterData);
      renderCategoriesRail(filterData);
    }
  }

  function populatePersonaDropdown() {
    const isHi = state.lang === "hi";
    const isMr = state.lang === "mr";
    els.personaSelect.innerHTML = `<option value="">${
      isHi ? "नमूना प्रोफाइल चुनें..." : isMr ? "नमुना प्रोफाइल निवडा..." : "Try a sample profile..."
    }</option>`;

    (window.SAMPLE_PERSONAS || []).forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = isHi ? p.name_hi : (isMr && p.name_mr ? p.name_mr : p.name_en);
      els.personaSelect.appendChild(opt);
    });
  }

  function loadPersona(id) {
    const persona = (window.SAMPLE_PERSONAS || []).find((p) => p.id === id);
    if (!persona) return;
    evaluationCache.factsVersion++;
    state.visibleCount = 30;
    state.facts = JSON.parse(JSON.stringify(persona.facts));
    state.activeField = null;
    autoSaveActiveProfile();
    pruneUnavailableSelections();
    resetListScroll();
    updateActiveQuestion();
    render();
  }

  function resetProfile() {
    evaluationCache.factsVersion++;
    state.visibleCount = 30;
    state.facts = {};
    state.activeField = null;
    state.checkedDocs.clear();
    state.selectedCategories.clear();
    state.selectedLevels.clear();
    state.selectedScopes.clear();
    resetListScroll();
    els.personaSelect.value = "";
    autoSaveActiveProfile();
    updateActiveQuestion();
    render();
  }

  function getFieldMeta(fieldId) {
    const fields = (window.FIELD_CATALOG && window.FIELD_CATALOG.fields) || [];
    return fields.find((f) => f.id === fieldId) || { id: fieldId, type: "string" };
  }

  function updateActiveQuestion() {
    const evalData = ensureEvaluation();
    state.activeField = evalData.nextQuestion ? evalData.nextQuestion.field : null;
  }

  function pruneUnavailableSelections() {
    ensureEvaluation();
    for (const c of state.selectedCategories) {
      if (!staticAllCategories.has(c)) state.selectedCategories.delete(c);
    }
    for (const l of state.selectedLevels) {
      if (!staticAllLevels.has(l)) state.selectedLevels.delete(l);
    }
    for (const sc of state.selectedScopes) {
      if (!staticAllScopes.has(sc)) state.selectedScopes.delete(sc);
    }
  }

  function answerField(fieldId, val) {
    evaluationCache.factsVersion++;
    state.visibleCount = 30;
    window.GovEngine.setPath(state.facts, fieldId, val);
    autoSaveActiveProfile();
    pruneUnavailableSelections();
    resetListScroll();
    updateActiveQuestion();
    render();
  }

  function clearFact(fieldId) {
    evaluationCache.factsVersion++;
    state.visibleCount = 30;
    window.GovEngine.deletePath(state.facts, fieldId);
    autoSaveActiveProfile();
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
   * Backward-compatible alias to getFilterData (Stage P1)
   */
  function computeActiveSchemesAndCategories() {
    return getFilterData();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Renderers
  // ─────────────────────────────────────────────────────────────────────────

  function render() {
    const t0 = performance.now();
    debugStats.renderCount++;

    renderQuestionStepper();
    renderAnsweredFacts();

    if (state.currentTab === "saved") {
      renderSavedSchemes();
    } else {
      const filterData = getFilterData();
      renderSchemes(filterData);
      renderCategoriesRail(filterData);
    }

    const renderDurationMs = performance.now() - t0;
    debugStats.lastRenderMs = renderDurationMs;
    if (isDebug) {
      console.log(
        `[JanKalyan Perf] render: ${renderDurationMs.toFixed(2)}ms (visibleCount: ${state.visibleCount}, renderCount: ${debugStats.renderCount})`
      );
    }
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

  function renderSchemes(filterData) {
    const isHi = state.lang === "hi";

    // Run active pipeline from cached evaluation
    const filterState = filterData || getFilterData();
    const {
      eligibleTotal,
      unknownTotal,
      ineligibleTotal,
      totalInTab,
      filteredSchemes,
      activeSelectedCategories,
      activeSelectedLevels,
      activeSelectedScopes,
    } = filterState;

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
        const cleanedBenefit = scheme.benefit ? cleanBenefitText(scheme.benefit) : "";
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
        } else if (isExpanded && detailLoadStatus === "failed") {
          benefitHtml = `
            <div class="details-offline-notice">
              ${isHi ? "विवरण ऑफ़लाइन अनुपलब्ध है" : "Details unavailable offline"}
            </div>
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
        const docCount = (scheme.documents && scheme.documents.length) || scheme.doc_count || 0;
        let docsHtml = "";
        if (docCount > 0) {
          const isDocOpen = state.openDocDisclosures.has(scheme.id);
          const cleanedDocs = scheme.documents ? cleanDocumentSlugs(scheme.documents) : [];
          let docsContentHtml = "";
          if (cleanedDocs.length > 0) {
            docsContentHtml = cleanedDocs
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
              .join("");
          } else if (detailLoadStatus === "failed") {
            docsContentHtml = `
              <div class="details-offline-notice">
                ${isHi ? "विवरण ऑफ़लाइन अनुपलब्ध है" : "Details unavailable offline"}
              </div>
            `;
          } else {
            docsContentHtml = `
              <div class="details-offline-notice">
                ${isHi ? "दस्तावेज लोड हो रहे हैं..." : "Loading documents..."}
              </div>
            `;
          }

          docsHtml = `
            <div class="docs-disclosure">
              <button class="docs-toggle" data-toggle-docs="${scheme.id}" type="button">
                <span>${docCount} ${isHi ? "आवश्यक दस्तावेज" : "documents needed"}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="transform: ${isDocOpen ? 'rotate(180deg)' : 'none'}; transition: transform var(--transition-fast);"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              <div class="docs-content ${isDocOpen ? 'open' : ''}">
                ${docsContentHtml}
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

        // Stage 3: Save scheme button or current status chip
        let saveChipHtml = "";
        const existingApp = state.activeProfileId ? state.profileApplications.get(scheme.id) : null;
        if (existingApp) {
          const meta = (window.GovStatus && window.GovStatus.getStatusMeta)
            ? window.GovStatus.getStatusMeta(existingApp.status)
            : { slug: "saved" };
          const label = (window.GovStatus && window.GovStatus.getStatusLabel)
            ? window.GovStatus.getStatusLabel(existingApp.status, state.lang)
            : existingApp.status;
          saveChipHtml = `
            <span class="status-chip chip-${meta.slug} scheme-card-saved-chip" data-goto-saved="${scheme.id}" title="${t("schemesTab")}">
              <span class="status-chip-dot"></span>
              <span class="status-chip-text">${escapeHtml(label)}</span>
            </span>
          `;
        } else {
          saveChipHtml = `
            <button class="btn-save-scheme" data-action="save-scheme" data-scheme-id="${scheme.id}" type="button">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>${t("saveScheme")}</span>
            </button>
          `;
        }

        return `
          <div class="scheme-row status-${scheme.result}">
            <div class="scheme-row-head">
              <div class="scheme-heading-block">
                <h3 class="scheme-row-title">${scheme.name}</h3>
                <div class="scheme-meta-line">
                  <span>${levelLabel}${stateLabel} · ${scopeLabel}</span>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
                ${saveChipHtml}
                ${statusHtml}
              </div>
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
    observeShowMore();
  }

  function handleSaveScheme(schemeId) {
    if (!state.activeProfileId) {
      openAddProfileModal();
      return;
    }

    if (state.profileApplications.has(schemeId)) {
      setTab("saved");
      return;
    }

    if (!window.GovDB || !window.GovDB.isAvailable()) {
      alert("Storage is not available in this browser environment.");
      return;
    }

    const newApp = {
      id: window.GovDB.generateId(),
      profileId: state.activeProfileId,
      schemeId: schemeId,
      status: "Saved",
      statusUpdatedAt: new Date().toISOString(),
      docsDone: [],
      note: "",
    };

    window.GovDB.saveApplication(newApp)
      .then((saved) => {
        state.profileApplications.set(schemeId, saved);
        const idx = state.applications.findIndex((a) => a.id === saved.id);
        if (idx >= 0) state.applications[idx] = saved;
        else state.applications.push(saved);

        if (els.countSaved) {
          els.countSaved.textContent = String(state.profileApplications.size);
        }
        renderSchemes();
      })
      .catch((err) => {
        console.error("Failed to save scheme application:", err);
      });
  }

  const noteSaveTimeouts = {};

  function renderSavedSchemes() {
    const isHi = state.lang === "hi";
    const isMr = state.lang === "mr";

    if (els.categoryRail) els.categoryRail.style.display = "none";
    const filterWrap = document.querySelector(".filters-toggle-wrap");
    if (filterWrap) filterWrap.style.display = "none";
    const mainLayout = document.querySelector(".main-layout");
    if (mainLayout) mainLayout.classList.add("no-rail");

    if (els.categoryChips) els.categoryChips.innerHTML = "";

    const savedApps = Array.from(state.profileApplications.values());
    const count = savedApps.length;

    if (els.countSaved) els.countSaved.textContent = String(count);

    const profileLabel = state.activeProfileName || t("quickCheckSession");
    if (els.resultsSummary) {
      els.resultsSummary.textContent = isHi
        ? `${profileLabel} के लिए ${count} सहेजी गई योजनाएँ`
        : isMr
        ? `${profileLabel} साठी ${count} जतन केलेल्या योजना`
        : `${count} saved scheme${count === 1 ? "" : "s"} for ${profileLabel}`;
    }

    if (count === 0) {
      els.schemesList.innerHTML = `
        <div class="empty-state-editorial">
          <div class="msg-primary">${t("noSavedSchemesPrimary")}</div>
          <div class="msg-secondary">${t("noSavedSchemesSecondary")}</div>
          <button class="btn-primary" id="btn-browse-eligible-saved" style="margin-top: 14px;" type="button">
            ${t("browseEligibleSchemes")}
          </button>
        </div>
      `;
      const browseBtn = document.getElementById("btn-browse-eligible-saved");
      if (browseBtn) {
        browseBtn.onclick = () => setTab("eligible");
      }
      return;
    }

    savedApps.sort((a, b) => new Date(b.statusUpdatedAt || 0) - new Date(a.statusUpdatedAt || 0));

    const html = `
      <div class="saved-schemes-container">
        ${savedApps.map((app) => {
          const scheme = (window.ALL_RULES || []).find((r) => r.id === app.schemeId);
          const isMissingScheme = !scheme;

          const statusOptions = (window.APPLICATION_STATUSES || []).map((st) => {
            const isSelected = st === app.status ? "selected" : "";
            const stLabel = (window.GovStatus && window.GovStatus.getStatusLabel)
              ? window.GovStatus.getStatusLabel(st, state.lang)
              : st;
            return `<option value="${escapeHtml(st)}" ${isSelected}>${escapeHtml(stLabel)}</option>`;
          }).join("");

          let updatedText = "";
          if (app.statusUpdatedAt) {
            try {
              const d = new Date(app.statusUpdatedAt);
              const dateStr = d.toLocaleDateString(state.lang === "hi" ? "hi-IN" : state.lang === "mr" ? "mr-IN" : "en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              updatedText = `${t("statusUpdatedPrefix")}: ${dateStr}`;
            } catch (e) {
              updatedText = `${t("statusUpdatedPrefix")}: ${app.statusUpdatedAt}`;
            }
          }

          let docsChecklistHtml = "";
          if (scheme) {
            const cleanedDocs = scheme.documents ? cleanDocumentSlugs(scheme.documents) : [];
            if (cleanedDocs.length > 0) {
              const docsDoneSet = new Set(app.docsDone || []);
              const tickedCount = cleanedDocs.filter((_, idx) => docsDoneSet.has(idx)).length;
              docsChecklistHtml = `
                <div class="saved-docs-section">
                  <span class="saved-section-label">${t("docsRequired")} (${tickedCount} / ${cleanedDocs.length})</span>
                  <div class="saved-docs-list">
                    ${cleanedDocs.map((docTitle, idx) => {
                      const isTicked = docsDoneSet.has(idx);
                      return `
                        <label class="saved-doc-row ${isTicked ? "checked" : ""}">
                          <input type="checkbox" data-app-id="${app.id}" data-doc-idx="${idx}" ${isTicked ? "checked" : ""} />
                          <span>${escapeHtml(docTitle)}</span>
                        </label>
                      `;
                    }).join("")}
                  </div>
                </div>
              `;
            } else if ((scheme.doc_count || 0) > 0) {
              if (detailLoadStatus !== "loaded" && detailLoadStatus !== "loading") {
                loadRulesDetail().catch(() => {});
              }
              docsChecklistHtml = `
                <div class="saved-docs-section">
                  <div class="details-offline-notice">
                    ${detailLoadStatus === "failed" ? (state.lang === "hi" ? "विवरण ऑफ़लाइन अनुपलब्ध है" : "Details unavailable offline") : (state.lang === "hi" ? "दस्तावेज लोड हो रहे हैं..." : "Loading documents...")}
                  </div>
                </div>
              `;
            }
          }

          if (isMissingScheme) {
            return `
              <div class="saved-scheme-card" data-app-id="${app.id}">
                <div class="saved-scheme-head">
                  <div class="saved-scheme-title-group">
                    <div class="saved-scheme-missing-banner">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                      </svg>
                      <span>${t("schemeNotInList")}</span>
                    </div>
                    <h3 class="saved-scheme-title">${escapeHtml(app.schemeId)}</h3>
                  </div>
                  <div class="saved-scheme-actions-top">
                    <button class="btn-text-quiet btn-remove-saved" data-action="remove-saved" data-app-id="${app.id}" type="button">
                      ${t("removeSaved")}
                    </button>
                  </div>
                </div>

                <div class="saved-scheme-body-grid">
                  <div class="saved-status-section">
                    <label class="saved-section-label" for="status-${app.id}">${t("applicationStatus")}</label>
                    <select class="app-status-select" id="status-${app.id}" data-action="change-status" data-app-id="${app.id}">
                      ${statusOptions}
                    </select>
                    ${updatedText ? `<span class="app-status-updated-text">${escapeHtml(updatedText)}</span>` : ""}
                  </div>

                  <div class="saved-note-section">
                    <label class="saved-section-label" for="note-${app.id}">${t("notesLabel")}</label>
                    <textarea class="saved-note-textarea" id="note-${app.id}" data-action="edit-note" data-app-id="${app.id}" placeholder="${t("notesPlaceholder")}">${escapeHtml(app.note || "")}</textarea>
                  </div>
                </div>
              </div>
            `;
          }

          const levelLabel = scheme.level ? scheme.level.charAt(0).toUpperCase() + scheme.level.slice(1) : "Central";
          const scopeLabel = scheme.scope === "household" ? (isHi ? "परिवार के लिए" : "For households") : (isHi ? "व्यक्तिगत" : "For individuals");
          const stateLabel = scheme.state ? ` · ${scheme.state}` : "";
          const metaSlug = (window.GovStatus && window.GovStatus.getStatusMeta) ? window.GovStatus.getStatusMeta(app.status).slug : "saved";

          return `
            <div class="saved-scheme-card" data-app-id="${app.id}">
              <div class="saved-scheme-head">
                <div class="saved-scheme-title-group">
                  <h3 class="saved-scheme-title">${escapeHtml(scheme.name)}</h3>
                  <div class="saved-scheme-meta">
                    <span>${levelLabel}${stateLabel} · ${scopeLabel} · ${escapeHtml(scheme.category || "")}</span>
                  </div>
                </div>
                <div class="saved-scheme-actions-top">
                  <span class="status-chip chip-${metaSlug}">
                    <span class="status-chip-dot"></span>
                    <span>${(window.GovStatus && window.GovStatus.getStatusLabel) ? window.GovStatus.getStatusLabel(app.status, state.lang) : app.status}</span>
                  </span>
                  <button class="btn-text-quiet btn-remove-saved" data-action="remove-saved" data-app-id="${app.id}" type="button">
                    ${t("removeSaved")}
                  </button>
                </div>
              </div>

              <div class="saved-scheme-body-grid">
                <div class="saved-status-section">
                  <label class="saved-section-label" for="status-${app.id}">${t("applicationStatus")}</label>
                  <select class="app-status-select" id="status-${app.id}" data-action="change-status" data-app-id="${app.id}">
                    ${statusOptions}
                  </select>
                  ${updatedText ? `<span class="app-status-updated-text">${escapeHtml(updatedText)}</span>` : ""}
                </div>

                ${docsChecklistHtml}

                <div class="saved-note-section">
                  <label class="saved-section-label" for="note-${app.id}">${t("notesLabel")}</label>
                  <textarea class="saved-note-textarea" id="note-${app.id}" data-action="edit-note" data-app-id="${app.id}" placeholder="${t("notesPlaceholder")}">${escapeHtml(app.note || "")}</textarea>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    els.schemesList.innerHTML = html;

    els.schemesList.querySelectorAll("select[data-action='change-status']").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const appId = e.currentTarget.getAttribute("data-app-id");
        const app = savedApps.find((a) => a.id === appId);
        if (!app) return;
        app.status = e.currentTarget.value;
        app.statusUpdatedAt = new Date().toISOString();
        window.GovDB.saveApplication(app).then((saved) => {
          state.profileApplications.set(saved.schemeId, saved);
          const idx = state.applications.findIndex((a) => a.id === saved.id);
          if (idx >= 0) state.applications[idx] = saved;
          else state.applications.push(saved);
          renderSavedSchemes();
        });
      });
    });

    els.schemesList.querySelectorAll("input[type='checkbox'][data-doc-idx]").forEach((chk) => {
      chk.addEventListener("change", (e) => {
        const appId = e.currentTarget.getAttribute("data-app-id");
        const docIdx = Number(e.currentTarget.getAttribute("data-doc-idx"));
        const app = savedApps.find((a) => a.id === appId);
        if (!app) return;
        const set = new Set(app.docsDone || []);
        if (e.currentTarget.checked) set.add(docIdx);
        else set.delete(docIdx);
        app.docsDone = Array.from(set);
        window.GovDB.saveApplication(app).then((saved) => {
          state.profileApplications.set(saved.schemeId, saved);
          const idx = state.applications.findIndex((a) => a.id === saved.id);
          if (idx >= 0) state.applications[idx] = saved;
          const row = e.currentTarget.closest(".saved-doc-row");
          if (row) row.classList.toggle("checked", e.currentTarget.checked);
        });
      });
    });

    els.schemesList.querySelectorAll("textarea[data-action='edit-note']").forEach((ta) => {
      ta.addEventListener("input", (e) => {
        const appId = e.currentTarget.getAttribute("data-app-id");
        const app = savedApps.find((a) => a.id === appId);
        if (!app) return;
        clearTimeout(noteSaveTimeouts[appId]);
        noteSaveTimeouts[appId] = setTimeout(() => {
          app.note = e.target.value;
          window.GovDB.saveApplication(app).then((saved) => {
            state.profileApplications.set(saved.schemeId, saved);
            const idx = state.applications.findIndex((a) => a.id === saved.id);
            if (idx >= 0) state.applications[idx] = saved;
          });
        }, 300);
      });
    });

    els.schemesList.querySelectorAll("button[data-action='remove-saved']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const appId = e.currentTarget.getAttribute("data-app-id");
        const app = savedApps.find((a) => a.id === appId);
        if (!app) return;
        window.GovDB.deleteApplication(appId).then(() => {
          state.profileApplications.delete(app.schemeId);
          state.applications = state.applications.filter((a) => a.id !== appId);
          if (els.countSaved) els.countSaved.textContent = String(state.profileApplications.size);
          renderSavedSchemes();
        });
      });
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
      const label = getCategoryLabel(cat);
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
        const filterData = getFilterData();
        renderSchemes(filterData);
        renderCategoriesRail(filterData);
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Category, Level & Scope Rail Renderer (Desktop Right Column & Mobile Sheet)
  // ─────────────────────────────────────────────────────────────────────────

  function renderCategoriesRail(filterData) {
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

    const filterState = filterData || getFilterData();
    const {
      categoryCounts,
      levelCounts,
      scopeCounts,
      showLevelGroup,
      showScopeGroup,
      activeSelectedCategories,
      activeSelectedLevels,
      activeSelectedScopes,
    } = filterState;

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
          const label = getCategoryLabel(cat);
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
          const filterData = getFilterData();
          renderSchemes(filterData);
          renderCategoriesRail(filterData);
        };
      });

      const toggleBtn = document.getElementById("btn-toggle-more-cats");
      if (toggleBtn) {
        toggleBtn.onclick = () => {
          state.showAllCategories = !state.showAllCategories;
          renderCategoriesRail(filterState);
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
          const filterData = getFilterData();
          renderSchemes(filterData);
          renderCategoriesRail(filterData);
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
          const filterData = getFilterData();
          renderSchemes(filterData);
          renderCategoriesRail(filterData);
        };
      });
    }

    updateRailStickyState();
  }

  function renderMobileSheetFilters(filterData) {
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

    const filterState = filterData || getFilterData();
    const {
      categoryCounts,
      levelCounts,
      scopeCounts,
      showLevelGroup,
      showScopeGroup,
    } = filterState;

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
          const filterData = getFilterData();
          renderSchemes(filterData);
          renderCategoriesRail(filterData);
          renderMobileSheetFilters(filterData);
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
          const filterData = getFilterData();
          renderSchemes(filterData);
          renderCategoriesRail(filterData);
          renderMobileSheetFilters(filterData);
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
          const label = getCategoryLabel(cat);
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
          const filterData = getFilterData();
          renderSchemes(filterData);
          renderCategoriesRail(filterData);
          renderMobileSheetFilters(filterData);
        };
      });
    }
  }

  // Boot on DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
