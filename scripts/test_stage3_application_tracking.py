"""
test_stage3_application_tracking.py
-----------------------------------
Automated regression & contract test suite for Stage 3: Application Status Tracking.
"""

import os
import re

def test_stage3():
    print("==================================================")
    print("RUNNING STAGE 3 APPLICATION TRACKING VERIFICATION")
    print("==================================================")

    # 1. Verify status.js
    status_path = os.path.join("frontend", "js", "status.js")
    assert os.path.exists(status_path), "frontend/js/status.js does not exist!"
    with open(status_path, "r", encoding="utf-8") as f:
        status_js = f.read()

    expected_statuses = [
        "Saved",
        "Documents pending",
        "Ready to apply",
        "Applied",
        "Approved",
        "Rejected",
        "Benefit received",
    ]

    for st in expected_statuses:
        assert f'"{st}"' in status_js, f"Status '{st}' missing from status.js!"
    print("  [PASS] status.js defines all 7 canonical statuses in AGENTS.md Section 6.")

    # 2. Verify db.js
    db_path = os.path.join("frontend", "js", "db.js")
    with open(db_path, "r", encoding="utf-8") as f:
        db_js = f.read()

    assert "DB_VERSION = 2" in db_js, "DB_VERSION must be bumped to 2 in db.js!"
    assert 'db.createObjectStore("applications"' in db_js, "applications object store missing in db.js!"
    assert 'appStore.createIndex("profileId"' in db_js, "profileId index missing in db.js!"
    assert 'appStore.createIndex("schemeId"' in db_js, "schemeId index missing in db.js!"
    assert 'appStore.createIndex("status"' in db_js, "status index missing in db.js!"
    assert "!db.objectStoreNames.contains(\"profiles\")" in db_js, "profiles migration must preserve existing store!"
    assert "getAllApplications" in db_js, "getAllApplications missing in GovDB export!"
    assert "getApplicationsByProfile" in db_js, "getApplicationsByProfile missing in GovDB export!"
    assert "saveApplication" in db_js, "saveApplication missing in GovDB export!"
    assert "deleteApplication" in db_js, "deleteApplication missing in GovDB export!"
    print("  [PASS] db.js bumped to DB_VERSION 2 with applications object store and safe migration.")

    # 3. Verify index.html
    html_path = os.path.join("frontend", "index.html")
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()

    assert '<script src="js/status.js"></script>' in html, "status.js script tag missing in index.html!"
    assert 'id="tab-saved"' in html, "tab-saved button missing in index.html!"
    assert 'id="count-saved"' in html, "count-saved counter missing in index.html!"
    assert 'id="dash-filter-active-bar"' in html, "dash-filter-active-bar missing in index.html!"
    assert 'id="card-count-ready"' in html, "card-count-ready missing in index.html!"
    assert 'id="card-count-applied"' in html, "card-count-applied missing in index.html!"
    print("  [PASS] index.html includes status.js, Schemes tab, dashboard filter bar, and interactive count cards.")

    # 4. Verify app.js
    app_path = os.path.join("frontend", "js", "app.js")
    with open(app_path, "r", encoding="utf-8") as f:
        app_js = f.read()

    assert "dashboardStatusFilter" in app_js, "dashboardStatusFilter missing in state!"
    assert "profileApplications" in app_js, "profileApplications missing in state!"
    assert "btn-save-scheme" in app_js, "btn-save-scheme missing in scheme card rendering!"
    assert "handleSaveScheme" in app_js, "handleSaveScheme function missing in app.js!"
    assert "renderSavedSchemes" in app_js, "renderSavedSchemes function missing in app.js!"
    assert "schemeNotInList" in app_js, "schemeNotInList i18n key missing in app.js!"
    assert "Scheme no longer in the list" in app_js, "Fallback text for missing schemeId missing in app.js!"
    assert "data-action=\"change-status\"" in app_js, "change-status action missing in saved schemes dropdown!"
    assert "docsDone" in app_js, "docsDone property missing in app.js!"
    assert "statusUpdatedAt" in app_js, "statusUpdatedAt missing in app.js!"
    print("  [PASS] app.js handles Save scheme button, chip, Schemes tab, fallback, and status dropdown.")

    # 5. Verify CSS
    css_path = os.path.join("frontend", "css", "style.css")
    with open(css_path, "r", encoding="utf-8") as f:
        css = f.read()

    assert ".status-chip" in css, "status-chip class missing in style.css!"
    assert ".chip-saved" in css, "chip-saved missing in style.css!"
    assert ".chip-ready-apply" in css, "chip-ready-apply missing in style.css!"
    assert ".chip-applied" in css, "chip-applied missing in style.css!"
    assert ".btn-save-scheme" in css, "btn-save-scheme class missing in style.css!"
    assert ".saved-scheme-card" in css, "saved-scheme-card class missing in style.css!"
    assert ".app-status-select" in css, "app-status-select class missing in style.css!"
    assert ".saved-doc-row" in css, "saved-doc-row class missing in style.css!"
    assert ".saved-note-textarea" in css, "saved-note-textarea class missing in style.css!"
    assert ".dashboard-filter-bar" in css, "dashboard-filter-bar class missing in style.css!"
    print("  [PASS] style.css includes all required styles for chips, cards, inputs, and filters.")

    print("\n==================================================")
    print("ALL STAGE 3 VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    test_stage3()
