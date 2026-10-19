import re

def verify_ui():
    with open("frontend/index.html", "r", encoding="utf-8") as f:
        html = f.read()

    required_ids = [
        "category-rail",
        "cat-rail-title",
        "btn-clear-categories",
        "category-list-container",
        "level-rail-section",
        "level-rail-title",
        "level-list-container",
        "rail-level-divider",
        "filters-bottom-sheet",
        "sheet-title-text",
        "btn-sheet-clear",
        "btn-sheet-close",
        "btn-sheet-apply",
        "sheet-level-section",
        "sheet-level-list",
        "sheet-level-divider",
        "sheet-cat-section",
        "sheet-cat-list",
        "category-chips",
        "results-summary",
    ]

    for rid in required_ids:
        assert f'id="{rid}"' in html, f"Missing id: {rid} in index.html"
    print("All required HTML IDs present!")

    # Check CSS
    with open("frontend/css/style.css", "r", encoding="utf-8") as f:
        css = f.read()

    assert "clamp(300px, 22vw, 360px) minmax(0, 1fr) clamp(300px, 21vw, 380px)" in css, "Missing requested grid-template-columns in style.css"
    assert "column-gap: clamp(24px, 2.5vw, 48px)" in css, "Missing column-gap in style.css"
    assert "max-width: 1040px" in css, "Missing results-column max-width in style.css"
    assert "scrollbar-width: none" in css, "Missing scrollbar-width in style.css"
    assert "overflow-y: hidden" in css, "Missing overflow-y: hidden in style.css"
    assert "is-sticky" in css, "Missing is-sticky class in style.css"
    print("All CSS assertions passed!")

if __name__ == "__main__":
    verify_ui()
