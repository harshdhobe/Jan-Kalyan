/**
 * Jan Kalyan Landing Page Components & Renderer
 * Faithfully matches Google Stitch Design
 */

(function () {
  "use strict";

  // Icons used in design (consistent 2px stroke, no background circles)
  const ICONS = {
    twoPeople: `
      <svg class="landing-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    `,
    checkmark: `
      <svg class="landing-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>
    `,
    shield: `
      <svg class="landing-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
    `,
    clipboard: `
      <svg class="landing-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
        <rect x="8" y="2" width="8" height="4" rx="1"></rect>
        <path d="M12 11h4"></path>
        <path d="M12 16h4"></path>
        <path d="M8 11h.01"></path>
        <path d="M8 16h.01"></path>
      </svg>
    `,
    checklist: `
      <svg class="landing-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 6h11"></path>
        <path d="M9 12h11"></path>
        <path d="M9 18h11"></path>
        <path d="M4 6l1.5 1.5L8 5"></path>
        <path d="M4 12l1.5 1.5L8 11"></path>
        <path d="M4 18l1.5 1.5L8 17"></path>
      </svg>
    `,
    document: `
      <svg class="landing-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <line x1="10" y1="9" x2="8" y2="9"></line>
      </svg>
    `,
    personCard: `
      <svg class="landing-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        <circle cx="12" cy="10" r="3"></circle>
        <path d="M7 17a5 5 0 0 1 10 0"></path>
      </svg>
    `,
    magnifierDoc: `
      <svg class="landing-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <circle cx="11.5" cy="14.5" r="2.5"></circle>
        <path d="M13.5 16.5L16 19"></path>
      </svg>
    `,
    progressBar: `
      <svg class="landing-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 12h5"></path>
        <path d="M11 12h2"></path>
        <path d="M16 12h5"></path>
        <circle cx="3" cy="12" r="1.5"></circle>
        <circle cx="12" cy="12" r="1.5"></circle>
        <circle cx="21" cy="12" r="1.5"></circle>
        <path d="M8 8l2.5 2.5L14 7"></path>
      </svg>
    `
  };

  const GROUPS_DATA = [
    { en: "Farmers", hi: "किसान", mr: "शेतकरी" },
    { en: "Women", hi: "महिलाएँ", mr: "महिला" },
    { en: "Older people", hi: "बुज़ुर्ग", mr: "ज्येष्ठ नागरिक" },
    { en: "Workers", hi: "श्रमिक", mr: "कामगार" },
    { en: "Persons with disability", hi: "दिव्यांगजन", mr: "दिव्यांग व्यक्ती" },
    { en: "Students", hi: "विद्यार्थी", mr: "विद्यार्थी" }
  ];

  let currentLang = localStorage.getItem("jk_lang") || "en";
  if (!["en", "hi", "mr"].includes(currentLang)) currentLang = "en";
  document.documentElement.setAttribute("lang", currentLang);

  function getStrings(lang) {
    const locales = window.LANDING_I18N || {};
    return locales[lang] || locales.en || {};
  }

  function setLandingLanguage(lang) {
    if (!["en", "hi", "mr"].includes(lang)) lang = "en";
    currentLang = lang;
    localStorage.setItem("jk_lang", lang);
    document.documentElement.setAttribute("lang", lang);

    // Synchronize with app-level language handler if present
    if (window.GovApp && typeof window.GovApp.setLanguage === "function" && window.GovApp.getState && window.GovApp.getState().lang !== lang) {
      window.GovApp.setLanguage(lang);
    }

    const hash = (window.location.hash || "").trim();
    if (!hash || hash === "#" || hash === "#/") {
      renderLandingView("landing-slot");
    }
  }

  // Individual Components

  function renderHeader(s) {
    return `
      <header class="landing-header">
        <div class="landing-container landing-header-inner">
          <a href="#/" class="landing-logo landing-focus-ring" aria-label="Jan Kalyan • जन कल्याण">
            <span class="landing-logo-serif">Jan Kalyan</span>
            <span class="landing-logo-divider" aria-hidden="true"></span>
            <span class="landing-logo-devanagari">जन कल्याण</span>
          </a>
          ${renderLanguageSwitcher()}
        </div>
      </header>
    `;
  }

  function renderLanguageSwitcher() {
    return `
      <nav class="landing-lang-nav" aria-label="Language selection">
        <button type="button" class="landing-lang-btn landing-focus-ring ${currentLang === 'en' ? 'active' : ''}" data-lang="en" aria-pressed="${currentLang === 'en'}">
          English
        </button>
        <span class="landing-lang-divider" aria-hidden="true"></span>
        <button type="button" class="landing-lang-btn devanagari landing-focus-ring ${currentLang === 'hi' ? 'active' : ''}" data-lang="hi" lang="hi" aria-pressed="${currentLang === 'hi'}">
          हिंदी
        </button>
        <span class="landing-lang-divider" aria-hidden="true"></span>
        <button type="button" class="landing-lang-btn devanagari landing-focus-ring ${currentLang === 'mr' ? 'active' : ''}" data-lang="mr" lang="mr" aria-pressed="${currentLang === 'mr'}">
          मराठी
        </button>
      </nav>
    `;
  }

  function renderHero(s) {
    return `
      <section class="landing-hero-section landing-section-wrapper">
        <div class="landing-container">
          <div class="landing-hero-grid">
            <div class="landing-hero-left">
              <div class="landing-hero-eyebrow">
                <span>JAN KALYAN</span>
                <span class="eyebrow-dot">•</span>
                <span class="eyebrow-devanagari">जन कल्याण</span>
              </div>
              <h1 class="landing-hero-h1">Jan Kalyan</h1>
              <p class="landing-hero-subheading">${s.heroSubtitle}</p>
              <p class="landing-hero-supporting">${s.heroSupporting}</p>
              
              <div class="landing-hero-actions">
                <a href="#/helper" class="landing-btn-cta landing-btn-primary landing-focus-ring" id="hero-btn-helper">
                  ${ICONS.twoPeople}
                  <div class="btn-content">
                    <span class="btn-title">${s.imHelper}</span>
                    <span class="btn-sub">${s.imHelperSub}</span>
                  </div>
                </a>
                <a href="#/quick" class="landing-btn-cta landing-btn-secondary landing-focus-ring" id="hero-btn-quick">
                  ${ICONS.checkmark}
                  <div class="btn-content">
                    <span class="btn-title">${s.quickCheck}</span>
                    <span class="btn-sub">${s.quickCheckSub}</span>
                  </div>
                </a>
              </div>

              <div class="landing-privacy-note">
                ${ICONS.shield}
                <span>${s.privacyNote}</span>
              </div>
            </div>

            <div class="landing-hero-right">
              <div class="landing-photo-frame">
                <img src="public/images/hero-community-worker.png" alt="A community health worker shows a phone to an elderly woman and a young family." width="512" height="382" />
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderMissionBand(s) {
    return `
      <section class="landing-mission-band landing-section-wrapper">
        <div class="landing-container">
          <div class="landing-mission-content">
            <h2 class="landing-mission-h2">${s.missionHeading}</h2>
            <p class="landing-mission-p">${s.missionBody}</p>
          </div>
        </div>
      </section>
    `;
  }

  function renderHowItWorks(s) {
    return `
      <section class="landing-how-section landing-section-wrapper">
        <div class="landing-container">
          <h2 class="landing-section-h2">${s.howItWorksHeading}</h2>

          <div class="landing-how-grid">
            <!-- Column 1: Check on your own -->
            <div class="landing-how-col">
              <div class="landing-col-accent-1" aria-hidden="true"></div>
              <div class="landing-col-header">
                <h3 class="landing-col-title">${s.col1Title}</h3>
                <span class="landing-col-sub">${s.col1Sub}</span>
              </div>
              <div class="landing-how-list">
                <div class="landing-how-row">
                  <span class="landing-step-num">1</span>
                  <span class="landing-step-text">${s.col1Step1}</span>
                  <div class="landing-step-icon">${ICONS.clipboard}</div>
                </div>
                <div class="landing-how-row">
                  <span class="landing-step-num">2</span>
                  <span class="landing-step-text">${s.col1Step2}</span>
                  <div class="landing-step-icon">${ICONS.checklist}</div>
                </div>
                <div class="landing-how-row">
                  <span class="landing-step-num">3</span>
                  <span class="landing-step-text">${s.col1Step3}</span>
                  <div class="landing-step-icon">${ICONS.document}</div>
                </div>
              </div>
            </div>

            <!-- Column 2: Get help from a helper -->
            <div class="landing-how-col">
              <div class="landing-col-accent-2" aria-hidden="true"></div>
              <div class="landing-col-header">
                <h3 class="landing-col-title">${s.col2Title}</h3>
                <span class="landing-col-sub">${s.col2Sub}</span>
              </div>
              <div class="landing-how-list">
                <div class="landing-how-row">
                  <span class="landing-step-num">1</span>
                  <span class="landing-step-text">${s.col2Step1}</span>
                  <div class="landing-step-icon">${ICONS.personCard}</div>
                </div>
                <div class="landing-how-row">
                  <span class="landing-step-num">2</span>
                  <span class="landing-step-text">${s.col2Step2}</span>
                  <div class="landing-step-icon">${ICONS.magnifierDoc}</div>
                </div>
                <div class="landing-how-row">
                  <span class="landing-step-num">3</span>
                  <span class="landing-step-text">${s.col2Step3}</span>
                  <div class="landing-step-icon">${ICONS.progressBar}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderGroupItem(item) {
    const line1 = item[currentLang] || item.en;
    // Line 2 = the Hindi label, except when Hindi is selected (then show only line 1)
    const showLine2 = currentLang !== "hi";
    const line2 = showLine2 ? item.hi : "";
    return `
      <div class="landing-family-item">
        <div class="landing-family-item-primary">${line1}</div>
        ${line2 ? `<div class="landing-family-item-secondary">${line2}</div>` : ""}
      </div>
    `;
  }

  function renderMadeForEveryFamily(s) {
    const col1 = GROUPS_DATA.slice(0, 3).map(renderGroupItem).join("");
    const col2 = GROUPS_DATA.slice(3, 6).map(renderGroupItem).join("");

    return `
      <section class="landing-family-section landing-section-wrapper">
        <div class="landing-container">
          <div class="landing-family-grid">
            <div class="landing-family-title-col">
              <h2 class="landing-family-title">${s.madeForEveryFamilyHeading}</h2>
            </div>
            <div class="landing-family-list-col">
              <div class="landing-family-items-grid">
                <div>${col1}</div>
                <div>${col2}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderPromises(s) {
    return `
      <section class="landing-promises-section landing-section-wrapper">
        <div class="landing-container">
          <div class="landing-promises-row">
            <div class="landing-promise-item">${s.promise1}</div>
            <div class="landing-promise-item">${s.promise2}</div>
            <div class="landing-promise-item">${s.promise3}</div>
            <div class="landing-promise-item">${s.promise4}</div>
          </div>
        </div>
      </section>
    `;
  }

  function renderLandingView(targetId = "landing-slot") {
    const container = document.getElementById(targetId) || document.getElementById("landing-slot");
    if (!container) return;

    const s = getStrings(currentLang);
    container.innerHTML = `
      <div id="landing-root" class="landing-page-root" data-page="landing">
        ${renderHeader(s)}
        <main>
          ${renderHero(s)}
          ${renderMissionBand(s)}
          ${renderHowItWorks(s)}
          ${renderMadeForEveryFamily(s)}
          ${renderPromises(s)}
        </main>
      </div>
    `;

    // Bind language switcher buttons
    const langBtns = container.querySelectorAll(".landing-lang-btn");
    langBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const lang = btn.getAttribute("data-lang");
        setLandingLanguage(lang);
      });
    });
  }

  function unmountLanding(targetId = "landing-slot") {
    const container = document.getElementById(targetId) || document.getElementById("landing-slot");
    if (container) {
      container.innerHTML = "";
    }
  }

  // Export globally
  window.JanKalyanLanding = {
    render: renderLandingView,
    unmount: unmountLanding,
    setLanguage: setLandingLanguage,
    getLanguage: () => currentLang
  };

})();
