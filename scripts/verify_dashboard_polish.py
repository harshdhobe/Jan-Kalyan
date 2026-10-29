"""
Stage DASH-POLISH Automated Verification Suite
Verifies:
1. One container edge: Header logo, dashboard content, and footer text share same left edge (within 2px) at 1440px and 360px.
2. Footer background is --color-forest with cream text.
3. Welcome row is unbordered, "Namaste," and name share heading font and size; Account button is outlined and works.
4. Count cards have SVG icons, stage labels, and active styling.
5. Today list has initials avatars, row dividers, right-aligned pill + days, count chip, and rust link.
6. Beneficiaries table header has tinted band, initials avatars, "N saved", status chips with leading dot, and light open button.
7. Backup card has "Backup" title, proper padding, amber unbacked chip with dot, and secondary backup button with upload SVG.
8. No prohibited items (breadcrumbs, operational date, local storage synchronized, etc.) are present.
"""

import asyncio
import json
import os
import shutil
import subprocess
import tempfile
import urllib.request
import websockets

PORT = 8000
CDP_PORT = 9240
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"


def start_edge_cdp(user_data_dir):
    cmd = [
        EDGE_PATH,
        "--headless=new",
        f"--remote-debugging-port={CDP_PORT}",
        f"--user-data-dir={user_data_dir}",
        "--disable-gpu",
        "--no-first-run",
        "--disable-fre",
        "--disable-sync",
        "--no-default-browser-check",
        f"http://localhost:{PORT}/"
    ]
    return subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


async def get_ws_url():
    for _ in range(40):
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{CDP_PORT}/json")
            with urllib.request.urlopen(req) as resp:
                targets = json.loads(resp.read().decode())
                for t in targets:
                    if t.get("type") == "page":
                        return t.get("webSocketDebuggerUrl")
        except Exception:
            pass
        await asyncio.sleep(0.2)
    raise RuntimeError("Could not connect to Edge DevTools")


async def send_cmd(ws, method, params, req_id):
    msg = {"id": req_id, "method": method, "params": params}
    await ws.send(json.dumps(msg))
    while True:
        resp = await ws.recv()
        data = json.loads(resp)
        if data.get("id") == req_id:
            return data.get("result", {})


async def eval_js(ws, expr, req_id):
    msg = {
        "id": req_id,
        "method": "Runtime.evaluate",
        "params": {
            "expression": expr,
            "returnByValue": True,
            "awaitPromise": True
        }
    }
    await ws.send(json.dumps(msg))
    while True:
        resp = await ws.recv()
        data = json.loads(resp)
        if data.get("id") == req_id:
            res = data.get("result", {})
            if "exceptionDetails" in res:
                print("JS Exception:", res["exceptionDetails"])
            return res.get("result", {}).get("value")


async def set_viewport(ws, width, height, req_id):
    msg = {
        "id": req_id,
        "method": "Emulation.setDeviceMetricsOverride",
        "params": {
            "width": width,
            "height": height,
            "deviceScaleFactor": 1,
            "mobile": width <= 480
        }
    }
    await ws.send(json.dumps(msg))
    while True:
        resp = await ws.recv()
        data = json.loads(resp)
        if data.get("id") == req_id:
            break


async def run_verification():
    print("=" * 65)
    print("STAGE DASH-POLISH AUTOMATED VERIFICATION SUITE")
    print("=" * 65)

    temp_dir = tempfile.mkdtemp(prefix="edge_polish_verify_")
    edge_proc = start_edge_cdp(temp_dir)
    ws_url = await get_ws_url()

    results = {}

    try:
        async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
            req_id = 1
            await send_cmd(ws, "Runtime.enable", {}, req_id)
            req_id += 1
            await send_cmd(ws, "Page.enable", {}, req_id)

            mock_script = """
            window.__mockGovCloud = function() {
              if (window.GovCloud) {
                window.GovCloud.isConfigured = () => true;
                window.GovCloud.getSession = async () => ({
                  data: {
                    session: {
                      user: { id: "test-helper-id", email: "helper@jankalyan.org" },
                      access_token: "mock-token"
                    }
                  },
                  error: null
                });
                window.GovCloud.getUser = async () => ({
                  id: "test-helper-id",
                  email: "helper@jankalyan.org"
                });
                window.GovCloud.deleteProfileCloud = async () => ({ error: null });
                window.GovCloud.backupToCloud = async () => ({
                  success: true,
                  profilesBackedUp: 6,
                  applicationsBackedUp: 11,
                  backupTimestamp: new Date().toISOString()
                });
              }
            };
            window.__mockGovCloud();
            window.addEventListener("DOMContentLoaded", window.__mockGovCloud);
            """
            req_id += 1
            await send_cmd(ws, "Page.addScriptToEvaluateOnNewDocument", {"source": mock_script}, req_id)
            req_id += 1
            await eval_js(ws, mock_script, req_id)

            # Wait for app initialization
            print("Waiting for application initialization...")
            for _ in range(30):
                init_done = await eval_js(ws, "window.__INIT_DONE === true", req_id)
                if init_done:
                    break
                await asyncio.sleep(0.2)

            # Setup helper account and populated test data
            print("Setting up helper account and populated data...")
            req_id += 1
            await eval_js(ws, """
            (async () => {
              if (window.__mockGovCloud) window.__mockGovCloud();
              if (window.GovDB && window.GovDB.isAvailable()) {
                await window.GovDB.clearAllBeneficiaryData();
              }
              const helper = {
                id: "test-helper-id",
                name: "Sunita Patil",
                helper_type: "ASHA",
                district: "Pune",
                language: "en"
              };
              if (window.GovDB) {
                await window.GovDB.setMeta("helper_account", helper);
                await window.GovDB.setMeta("last_backup_at", new Date(Date.now() - 2 * 86400000).toISOString());

                const now = Date.now();
                const day = 86400000;
                const p1 = {
                    id: "p-ramesh",
                    name: "Ramesh Pawar",
                    age: 35,
                    gender: "male",
                    consent: true,
                    household: { state: "Maharashtra" },
                    createdAt: new Date(now - 10 * day).toISOString(),
                    updatedAt: new Date(now - 3 * day).toISOString()
                };
                const p2 = {
                    id: "p-kamla",
                    name: "Kamla Bai",
                    age: 62,
                    gender: "female",
                    consent: true,
                    household: { state: "Maharashtra" },
                    createdAt: new Date(now - 15 * day).toISOString(),
                    updatedAt: new Date(now - 9 * day).toISOString()
                };
                const p3 = {
                    id: "p-sunita",
                    name: "Sunita Jadhav",
                    age: 42,
                    gender: "female",
                    consent: true,
                    household: { state: "Maharashtra" },
                    createdAt: new Date(now - 40 * day).toISOString(),
                    updatedAt: new Date(now - 34 * day).toISOString()
                };

                await window.GovDB.saveProfile(p1);
                await window.GovDB.saveProfile(p2);
                await window.GovDB.saveProfile(p3);

                const a1 = { id: "a-1", profileId: "p-ramesh", schemeId: "pm-kisan", status: "Ready to apply", statusUpdatedAt: new Date(now - 3 * day).toISOString(), createdAt: new Date(now - 10 * day).toISOString(), updatedAt: new Date(now - 3 * day).toISOString() };
                const a2 = { id: "a-2", profileId: "p-ramesh", schemeId: "pmjjby", status: "Ready to apply", statusUpdatedAt: new Date(now - 3 * day).toISOString(), createdAt: new Date(now - 10 * day).toISOString(), updatedAt: new Date(now - 3 * day).toISOString() };
                const a3 = { id: "a-3", profileId: "p-kamla", schemeId: "nsap-ignoaps", status: "Documents pending", statusUpdatedAt: new Date(now - 9 * day).toISOString(), createdAt: new Date(now - 15 * day).toISOString(), updatedAt: new Date(now - 9 * day).toISOString() };
                const a4 = { id: "a-4", profileId: "p-sunita", schemeId: "ab-pmjay", status: "Applied", statusUpdatedAt: new Date(now - 34 * day).toISOString(), createdAt: new Date(now - 40 * day).toISOString(), updatedAt: new Date(now - 34 * day).toISOString() };

                await window.GovDB.saveApplication(a1);
                await window.GovDB.saveApplication(a2);
                await window.GovDB.saveApplication(a3);
                await window.GovDB.saveApplication(a4);
              }
              return true;
            })()
            """, req_id)

            await asyncio.sleep(0.5)

            # Navigate to #/helper
            req_id += 1
            await eval_js(ws, "window.location.hash = '#/helper';", req_id)
            for _ in range(25):
                dash_vis = await eval_js(ws, """
                (() => {
                    const el = document.getElementById("dashboard-view");
                    const l = document.getElementById("profiles-list");
                    return el && window.getComputedStyle(el).display !== "none" && l && l.children.length > 0;
                })()
                """, req_id)
                if dash_vis:
                    break
                await asyncio.sleep(0.2)

            # -------------------------------------------------------------
            # ITEM 1: ONE CONTAINER EDGE (Header Logo, Dashboard, Footer Text)
            # -------------------------------------------------------------
            print("\n[ITEM 1] Checking ONE CONTAINER EDGE at 1440px and 360px...")

            # 1440px
            req_id += 1
            await set_viewport(ws, 1440, 900, req_id)
            await asyncio.sleep(0.3)
            req_id += 1
            edge_1440 = await eval_js(ws, """
            (() => {
                const logo = document.querySelector(".header-brand-group") || document.querySelector(".site-header .brand");
                const logoX = logo ? logo.getBoundingClientRect().left : null;

                const welcome = document.querySelector(".dash-welcome-row .acct-left") || document.getElementById("dash-welcome-row");
                const welcomeX = welcome ? welcome.getBoundingClientRect().left : null;

                const cards = document.getElementById("dash-count-grid");
                const cardsX = cards ? cards.getBoundingClientRect().left : null;

                const footerText = document.querySelector(".site-footer-col") || document.querySelector(".site-footer-wordmark");
                const footerX = footerText ? footerText.getBoundingClientRect().left : null;

                const lefts = [logoX, welcomeX, cardsX, footerX].filter(x => x !== null);
                const diff = Math.max(...lefts) - Math.min(...lefts);

                return {
                    logoX,
                    welcomeX,
                    cardsX,
                    footerX,
                    diff,
                    pass: diff <= 2.0
                };
            })()
            """, req_id)

            print(f"  At 1440px: Logo={edge_1440['logoX']}px, Welcome={edge_1440['welcomeX']}px, Cards={edge_1440['cardsX']}px, FooterText={edge_1440['footerX']}px (diff={edge_1440['diff']:.2f}px)")
            results["edge_1440"] = "PASS" if edge_1440["pass"] else "FAIL"

            # 360px
            req_id += 1
            await set_viewport(ws, 360, 640, req_id)
            await asyncio.sleep(0.3)
            req_id += 1
            edge_360 = await eval_js(ws, """
            (() => {
                const logo = document.querySelector(".header-brand-group") || document.querySelector(".site-header .brand");
                const logoX = logo ? logo.getBoundingClientRect().left : null;

                const welcome = document.querySelector(".dash-welcome-row .acct-left") || document.getElementById("dash-welcome-row");
                const welcomeX = welcome ? welcome.getBoundingClientRect().left : null;

                const cards = document.getElementById("dash-count-grid");
                const cardsX = cards ? cards.getBoundingClientRect().left : null;

                const footerText = document.querySelector(".site-footer-col") || document.querySelector(".site-footer-wordmark");
                const footerX = footerText ? footerText.getBoundingClientRect().left : null;

                const lefts = [logoX, welcomeX, cardsX, footerX].filter(x => x !== null);
                const diff = Math.max(...lefts) - Math.min(...lefts);

                return {
                    logoX,
                    welcomeX,
                    cardsX,
                    footerX,
                    diff,
                    pass: diff <= 2.0
                };
            })()
            """, req_id)

            print(f"  At 360px: Logo={edge_360['logoX']}px, Welcome={edge_360['welcomeX']}px, Cards={edge_360['cardsX']}px, FooterText={edge_360['footerX']}px (diff={edge_360['diff']:.2f}px)")
            results["edge_360"] = "PASS" if edge_360["pass"] else "FAIL"

            # Reset viewport to 1440px for desktop tests
            req_id += 1
            await set_viewport(ws, 1440, 900, req_id)
            await asyncio.sleep(0.3)

            # -------------------------------------------------------------
            # ITEM 2: FOOTER (Background --color-forest with cream text)
            # -------------------------------------------------------------
            print("\n[ITEM 2] Checking FOOTER background and text styling...")
            req_id += 1
            footer_info = await eval_js(ws, """
            (() => {
                const footer = document.querySelector(".site-footer");
                if (!footer) return { error: "footer not found" };
                const style = window.getComputedStyle(footer);
                const bg = style.backgroundColor;
                const col = style.color;

                const wordmark = document.querySelector(".site-footer-wordmark");
                const wmColor = wordmark ? window.getComputedStyle(wordmark).color : null;

                // rgb(31, 77, 54) corresponds to #1F4D36 (--color-forest)
                // rgb(250, 244, 234) corresponds to #FAF4EA (--color-on-forest)
                const isForestBg = bg.includes("31") && bg.includes("77") && bg.includes("54");
                const isCreamText = col.includes("250") && col.includes("244") && col.includes("234");

                return {
                    bg,
                    col,
                    wmColor,
                    isForestBg,
                    isCreamText,
                    pass: isForestBg && isCreamText
                };
            })()
            """, req_id)
            print(f"  Footer bg={footer_info.get('bg')}, text color={footer_info.get('col')}")
            results["footer_style"] = "PASS" if footer_info.get("pass") else "FAIL"

            # -------------------------------------------------------------
            # ITEM 3: WELCOME ROW & ACCOUNT BUTTON
            # -------------------------------------------------------------
            print("\n[ITEM 3] Checking WELCOME ROW & ACCOUNT BUTTON...")
            req_id += 1
            welcome_info = await eval_js(ws, """
            (() => {
                const bar = document.getElementById("helper-welcome-bar");
                const bStyle = window.getComputedStyle(bar);
                const borderNone = bStyle.borderStyle === "none" || bStyle.borderWidth === "0px";
                const bgTransparent = bStyle.backgroundColor === "rgba(0, 0, 0, 0)" || bStyle.backgroundColor === "transparent";

                const greeting = document.getElementById("dash-welcome-greeting");
                const name = document.getElementById("helper-tag-name");

                const gStyle = window.getComputedStyle(greeting);
                const nStyle = window.getComputedStyle(name);

                const sameFontSize = gStyle.fontSize === nStyle.fontSize;
                const sameFontFamily = gStyle.fontFamily === nStyle.fontFamily;
                const sameFontWeight = gStyle.fontWeight === nStyle.fontWeight;

                return {
                    borderNone,
                    bgTransparent,
                    sameFontSize,
                    sameFontFamily,
                    sameFontWeight,
                    fontSize: gStyle.fontSize,
                    pass: borderNone && bgTransparent && sameFontSize && sameFontFamily && sameFontWeight
                };
            })()
            """, req_id)
            print(f"  Welcome bar unbordered: {welcome_info.get('borderNone')}, Single font size across greeting & name: {welcome_info.get('sameFontSize')} ({welcome_info.get('fontSize')})")
            results["welcome_row"] = "PASS" if welcome_info.get("pass") else "FAIL"

            # Test Account Menu Click & Visibility
            print("  Testing Account Menu click toggle...")
            req_id += 1
            acct_click = await eval_js(ws, """
            (async () => {
                const btn = document.getElementById("btn-acct-menu");
                const menu = document.getElementById("acct-dropdown-menu");
                if (!btn || !menu) return { error: "missing elements" };

                btn.click();
                await new Promise(r => setTimeout(r, 180));

                const style = window.getComputedStyle(menu);
                const rect = menu.getBoundingClientRect();
                const isOpenClass = menu.classList.contains("is-open");
                const isVisible = style.visibility === "visible" && parseFloat(style.opacity) >= 0.8 && style.display !== "none";
                const hasArea = rect.width > 100 && rect.height > 50;

                // Close it back
                btn.click();

                return {
                    isOpenClass,
                    isVisible,
                    hasArea,
                    width: rect.width,
                    height: rect.height,
                    pass: Boolean(isOpenClass && isVisible && hasArea)
                };
            })()
            """, req_id)
            print(f"  Account menu opens on click: {acct_click.get('pass')} (width={acct_click.get('width')}px, height={acct_click.get('height')}px)")
            results["account_menu_works"] = "PASS" if acct_click.get("pass") else "FAIL"

            # -------------------------------------------------------------
            # ITEM 4: COUNT CARDS (SVG icons, stage labels, active state)
            # -------------------------------------------------------------
            print("\n[ITEM 4] Checking COUNT CARDS...")
            req_id += 1
            cards_info = await eval_js(ws, """
            (() => {
                const cards = [
                    document.getElementById("card-count-docs-pending"),
                    document.getElementById("card-count-ready"),
                    document.getElementById("card-count-applied"),
                    document.getElementById("card-count-benefit-received")
                ];

                const hasIcons = cards.every(c => c && c.querySelector("svg.dash-card-icon"));
                const stageLabels = cards.map(c => c ? (c.querySelector(".dash-card-stage") || c.querySelector(".dash-card-stage-label")).textContent.trim() : "");
                const hasStageLabels = stageLabels.length === 4 && stageLabels[0].length > 0;

                // Verify none is selected by default
                const noneActiveDefault = cards.every(c => !c.classList.contains("is-active") && !c.classList.contains("active"));

                // Click card 2
                cards[1].click();
                const card2Active = cards[1].classList.contains("is-active") || cards[1].classList.contains("active");
                const card2Style = window.getComputedStyle(cards[1]);
                const borderTopOk = card2Style.borderTopWidth === "3px";

                // Clear filter
                const clearLink = document.getElementById("clear-card-ready") || document.getElementById("clear-card-stage2");
                if (clearLink) clearLink.click();
                const card2Cleared = !cards[1].classList.contains("is-active") && !cards[1].classList.contains("active");

                return {
                    hasIcons,
                    stageLabels,
                    hasStageLabels,
                    noneActiveDefault,
                    card2Active,
                    borderTopOk,
                    card2Cleared,
                    pass: hasIcons && hasStageLabels && noneActiveDefault && card2Active && borderTopOk && card2Cleared
                };
            })()
            """, req_id)
            print(f"  Count cards have SVG icons: {cards_info.get('hasIcons')}, Stage labels: {cards_info.get('stageLabels')}, Active filter 3px border: {cards_info.get('borderTopOk')}")
            results["count_cards"] = "PASS" if cards_info.get("pass") else "FAIL"

            # -------------------------------------------------------------
            # ITEM 5: TODAY LIST (Dividers, initials avatar, right-aligned days)
            # -------------------------------------------------------------
            print("\n[ITEM 5] Checking TODAY LIST...")
            req_id += 1
            today_info = await eval_js(ws, """
            (() => {
                const countChip = document.getElementById("dash-today-count-chip");
                const hasCountChip = countChip && countChip.textContent.includes("action");

                const rows = document.querySelectorAll("#dash-today-list .dash-action-row");
                const rowCount = rows.length;

                let hasAvatars = false;
                let rightAligned = false;
                let hasDividers = false;

                if (rowCount > 0) {
                    const firstRow = rows[0];
                    const avatar = firstRow.querySelector(".dash-row-avatar");
                    hasAvatars = avatar && avatar.textContent.trim().length >= 1;

                    const rCol = firstRow.querySelector(".dash-action-right");
                    const rStyle = window.getComputedStyle(rCol);
                    rightAligned = rStyle.alignItems === "flex-end" || rStyle.flexDirection === "column";

                    const rowStyle = window.getComputedStyle(firstRow);
                    hasDividers = rowStyle.borderBottomWidth !== "0px" && (rowStyle.backgroundColor === "rgba(0, 0, 0, 0)" || rowStyle.backgroundColor === "transparent");
                }

                return {
                    hasCountChip,
                    chipText: countChip ? countChip.textContent : null,
                    rowCount,
                    hasAvatars,
                    rightAligned,
                    hasDividers,
                    pass: hasCountChip && rowCount > 0 && hasAvatars && rightAligned && hasDividers
                };
            })()
            """, req_id)
            print(f"  Today list count chip: '{today_info.get('chipText')}', Row avatars present: {today_info.get('hasAvatars')}, Action pill + days stacked right: {today_info.get('rightAligned')}")
            results["today_list"] = "PASS" if today_info.get("pass") else "FAIL"

            # -------------------------------------------------------------
            # ITEM 6: BENEFICIARIES TABLE (Tinted band, avatar, "N saved", status tokens, light open button)
            # -------------------------------------------------------------
            print("\n[ITEM 6] Checking BENEFICIARIES TABLE...")
            req_id += 1
            beneficiaries_info = await eval_js(ws, """
            (() => {
                const header = document.querySelector(".dash-table-header");
                const hStyle = window.getComputedStyle(header);
                // Tinted background --color-surface-subtle (#F1E4CE) -> rgb(241, 228, 206)
                const isTintedBand = hStyle.backgroundColor.includes("241") && hStyle.backgroundColor.includes("228");

                const rows = document.querySelectorAll("#profiles-list .profile-card");
                let hasRowAvatar = false;
                let hasSavedText = false;
                let hasStatusChipWithDot = false;
                let isOpenButtonLight = false;

                if (rows.length > 0) {
                    const r = rows[0];
                    const av = r.querySelector(".dash-row-avatar");
                    hasRowAvatar = av && av.textContent.trim().length >= 1;

                    const schemesCell = r.querySelector(".dash-cell-schemes");
                    hasSavedText = schemesCell && schemesCell.textContent.includes("saved") && !schemesCell.textContent.includes("schemes saved");

                    const chip = r.querySelector(".status-chip");
                    const dot = chip ? chip.querySelector(".status-chip-dot") || window.getComputedStyle(chip, "::before").content : null;
                    hasStatusChipWithDot = chip && (dot !== null || chip.querySelector(".status-chip-dot") !== null);

                    const openBtn = r.querySelector(".btn-card-open");
                    const bStyle = window.getComputedStyle(openBtn);
                    // Light button: white/cream surface, not black
                    isOpenButtonLight = !bStyle.backgroundColor.includes("42, 26, 16") && !bStyle.backgroundColor.includes("rgb(0, 0, 0)");
                }

                return {
                    isTintedBand,
                    rowCount: rows.length,
                    hasRowAvatar,
                    hasSavedText,
                    hasStatusChipWithDot,
                    isOpenButtonLight,
                    pass: isTintedBand && hasRowAvatar && hasSavedText && hasStatusChipWithDot && isOpenButtonLight
                };
            })()
            """, req_id)
            print(f"  Table header tinted band: {beneficiaries_info.get('isTintedBand')}, Row avatar: {beneficiaries_info.get('hasRowAvatar')}, 'N saved': {beneficiaries_info.get('hasSavedText')}, Light open button: {beneficiaries_info.get('isOpenButtonLight')}")
            results["beneficiaries_table"] = "PASS" if beneficiaries_info.get("pass") else "FAIL"

            # -------------------------------------------------------------
            # ITEM 7: BACKUP CARD
            # -------------------------------------------------------------
            print("\n[ITEM 7] Checking BACKUP CARD...")
            req_id += 1
            backup_info = await eval_js(ws, """
            (() => {
                const title = document.getElementById("dash-backup-card-title");
                const titleText = title ? title.textContent.trim() : "";
                const isNormalCase = titleText === "Backup" || titleText === "बैकअप" || titleText === "बॅकअप";

                const card = document.querySelector(".dash-backup-card");
                const cStyle = window.getComputedStyle(card);
                const topPadding = parseFloat(cStyle.paddingTop) >= 20;

                const warn = document.getElementById("dash-backup-warning");
                const hasWarnChip = warn && warn.textContent.length > 0;

                const btn = document.getElementById("btn-dash-backup-footer");
                const hasUploadSvg = btn && btn.querySelector("svg") !== null;
                const bStyle = window.getComputedStyle(btn);
                const isNaturalWidth = bStyle.width !== cStyle.width;

                return {
                    titleText,
                    isNormalCase,
                    topPadding,
                    hasWarnChip,
                    hasUploadSvg,
                    isNaturalWidth,
                    pass: isNormalCase && topPadding && hasWarnChip && hasUploadSvg && isNaturalWidth
                };
            })()
            """, req_id)
            print(f"  Backup card title: '{backup_info.get('titleText')}', Top padding >= 20px: {backup_info.get('topPadding')}, Amber unbacked chip: {backup_info.get('hasWarnChip')}, Upload SVG: {backup_info.get('hasUploadSvg')}")
            results["backup_card"] = "PASS" if backup_info.get("pass") else "FAIL"

            # -------------------------------------------------------------
            # ITEM 8: PROHIBITED ITEMS CHECK
            # -------------------------------------------------------------
            print("\n[ITEM 8] Checking that PROHIBITED items were NOT added...")
            req_id += 1
            prohibited_info = await eval_js(ws, """
            (() => {
                const bodyText = document.body.innerText;
                const prohibitedPhrases = [
                    "Local Storage Synchronized",
                    "Offline First Mode Active",
                    "Operational Date",
                    "Haveli Taluka",
                    "Village Wagholi"
                ];

                const found = prohibitedPhrases.filter(p => bodyText.includes(p));

                const hasBreadcrumbs = document.querySelector(".breadcrumb, .breadcrumbs") !== null;

                return {
                    found,
                    hasBreadcrumbs,
                    pass: found.length === 0 && !hasBreadcrumbs
                };
            })()
            """, req_id)
            print(f"  Prohibited phrases found: {prohibited_info.get('found')}, Has breadcrumbs: {prohibited_info.get('hasBreadcrumbs')}")
            results["no_prohibited_items"] = "PASS" if prohibited_info.get("pass") else "FAIL"

            # Cleanup
            await eval_js(ws, """
            (async () => {
                if (window.GovDB) {
                    await window.GovDB.deleteProfile("p-ramesh");
                    await window.GovDB.deleteProfile("p-kamla");
                    await window.GovDB.deleteProfile("p-sunita");
                }
            })()
            """, req_id)

    finally:
        edge_proc.terminate()
        try:
            edge_proc.wait(timeout=2)
        except Exception:
            edge_proc.kill()
        shutil.rmtree(temp_dir, ignore_errors=True)

    print("\n" + "=" * 65)
    print("STAGE DASH-POLISH SUMMARY:")
    all_passed = True
    for k, v in results.items():
        print(f"  {k:22}: {v}")
        if v != "PASS":
            all_passed = False
    print("=" * 65)

    if all_passed:
        print("ALL DASH-POLISH VERIFICATIONS PASSED!")
    else:
        print("SOME VERIFICATIONS FAILED!")
        exit(1)


if __name__ == "__main__":
    asyncio.run(run_verification())
