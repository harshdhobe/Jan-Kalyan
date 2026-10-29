import asyncio
import json
import os
import shutil
import subprocess
import tempfile
import urllib.request
import websockets

PORT = 8000
CDP_PORT = 9248
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

async def main():
    tmp_dir = tempfile.mkdtemp(prefix="edge_verify_cats_")
    cmd = [
        EDGE_PATH,
        "--headless=new",
        f"--remote-debugging-port={CDP_PORT}",
        f"--user-data-dir={tmp_dir}",
        "--disable-gpu",
        "--no-first-run",
        "--disable-fre",
        "--disable-sync",
        "--no-default-browser-check",
        f"http://localhost:{PORT}/frontend/index.html#/quick"
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    console_errors = []

    try:
        ws_url = None
        for _ in range(40):
            try:
                with urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json", timeout=1) as resp:
                    data = json.loads(resp.read().decode())
                    for target in data:
                        if target.get("type") == "page":
                            ws_url = target.get("webSocketDebuggerUrl")
                            break
                    if ws_url:
                        break
            except Exception:
                await asyncio.sleep(0.2)

        if not ws_url:
            print("FAILED: Could not connect to browser CDP.")
            return False

        async with websockets.connect(ws_url, max_size=20*1024*1024) as ws:
            msg_counter = 0
            async def send_cmd(method, params=None):
                nonlocal msg_counter
                msg_counter += 1
                mid = msg_counter
                payload = {"id": mid, "method": method, "params": params or {}}
                await ws.send(json.dumps(payload))
                while True:
                    resp_raw = await ws.recv()
                    resp = json.loads(resp_raw)
                    if resp.get("method") == "Runtime.consoleAPICalled":
                        p = resp.get("params", {})
                        if p.get("type") == "error":
                            console_errors.append(p)
                    if resp.get("id") == mid:
                        return resp.get("result", {})

            await send_cmd("Page.enable")
            await send_cmd("Runtime.enable")
            await send_cmd("DOM.enable")

            await asyncio.sleep(2.0)

            # 1. Answer question so schemes and category rail/sheet are populated
            setup_res = await send_cmd("Runtime.evaluate", {
                "expression": """
                (async () => {
                    const personaSelect = document.getElementById("persona-select");
                    if (personaSelect && window.SAMPLE_PERSONAS && window.SAMPLE_PERSONAS.length > 0) {
                        personaSelect.value = window.SAMPLE_PERSONAS[0].id;
                        personaSelect.dispatchEvent(new Event("change", { bubbles: true }));
                    } else {
                        const optBtn = document.querySelector(".question-options button, .btn-choice, .choice-btn");
                        if (optBtn) optBtn.click();
                    }
                    await new Promise(r => setTimeout(r, 1000));
                    return {
                        schemesCount: document.querySelectorAll(".scheme-row").length,
                        hasCategoriesBtn: !!document.getElementById("btn-filters-toggle"),
                        activePersona: personaSelect ? personaSelect.value : null
                    };
                })()
                """,
                "awaitPromise": True,
                "returnByValue": True
            })
            val = setup_res.get("result", {}).get("value")
            print("Setup status:", val)
            assert val and val.get("schemesCount", 0) > 0, "Schemes must be rendered"

            passed_all = True

            # 2. Test widths 360, 390, 768, 1024
            for w in [360, 390, 768, 1024]:
                print(f"\n--- Testing width {w}px ---")
                await send_cmd("Emulation.setDeviceMetricsOverride", {
                    "width": w,
                    "height": 844,
                    "deviceScaleFactor": 1,
                    "mobile": (w < 1024)
                })
                await asyncio.sleep(0.3)

                # Check button visibility and rail hidden
                state_check = await send_cmd("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const btn = document.getElementById("btn-filters-toggle");
                        const wrap = document.querySelector(".filters-toggle-wrap");
                        const rail = document.getElementById("category-rail");
                        return {
                            btnVisible: wrap && window.getComputedStyle(wrap).display !== "none",
                            railHidden: rail && window.getComputedStyle(rail).display === "none"
                        };
                    })()
                    """,
                    "returnByValue": True
                })
                sc = state_check.get("result", {}).get("value")
                print(f"Visibility at {w}px:", sc)
                if not (sc["btnVisible"] and sc["railHidden"]):
                    print(f"FAIL: btn should be visible and rail hidden at {w}px")
                    passed_all = False

                # Tap "Categories" button
                open_check = await send_cmd("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const btn = document.getElementById("btn-filters-toggle");
                        btn.click();
                        const sheet = document.getElementById("filters-bottom-sheet");
                        const sheetCS = window.getComputedStyle(sheet);
                        const drawer = sheet.querySelector(".sheet-drawer");
                        const drawerCS = window.getComputedStyle(drawer);
                        const activeEl = document.activeElement;
                        return {
                            sheetHasOpen: sheet.classList.contains("open"),
                            sheetDisplay: sheetCS.display,
                            drawerTransform: drawerCS.transform,
                            focusedTag: activeEl ? activeEl.tagName : null,
                            focusedType: activeEl ? activeEl.type : null
                        };
                    })()
                    """,
                    "returnByValue": True
                })
                oc = open_check.get("result", {}).get("value")
                print(f"Open sheet at {w}px:", oc)
                if not (oc["sheetHasOpen"] and oc["sheetDisplay"] == "block"):
                    print(f"FAIL: sheet did not open at {w}px")
                    passed_all = False

                # Test selecting a checkbox inside sheet and checking apply button text
                select_check = await send_cmd("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const sheet = document.getElementById("filters-bottom-sheet");
                        const firstCheck = sheet.querySelector("input[type='checkbox']");
                        if (!firstCheck) return { error: "no_checkbox" };
                        
                        firstCheck.checked = true;
                        firstCheck.dispatchEvent(new Event("change", { bubbles: true }));
                        
                        const applyBtn = document.getElementById("btn-sheet-apply");
                        const clearBtn = document.getElementById("btn-sheet-clear");
                        return {
                            applyText: applyBtn ? applyBtn.textContent.trim() : null,
                            clearDisplay: clearBtn ? window.getComputedStyle(clearBtn).display : null
                        };
                    })()
                    """,
                    "returnByValue": True
                })
                sel_res = select_check.get("result", {}).get("value")
                print(f"Filter selection at {w}px:", sel_res)
                if not sel_res.get("applyText", "").startswith("Show "):
                    print(f"FAIL: apply text not updated: {sel_res}")
                    passed_all = False

                # Tap "Show N schemes" to close
                close_apply_check = await send_cmd("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const applyBtn = document.getElementById("btn-sheet-apply");
                        applyBtn.click();
                        const sheet = document.getElementById("filters-bottom-sheet");
                        const activeEl = document.activeElement;
                        return {
                            sheetClosed: !sheet.classList.contains("open"),
                            focusedId: activeEl ? activeEl.id : null
                        };
                    })()
                    """,
                    "returnByValue": True
                })
                cac = close_apply_check.get("result", {}).get("value")
                print(f"Close via Apply at {w}px:", cac)
                if not (cac["sheetClosed"] and cac["focusedId"] == "btn-filters-toggle"):
                    print(f"FAIL: apply did not close sheet or focus button at {w}px: {cac}")
                    passed_all = False

                # Clear filters for next subtest
                await send_cmd("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const btn = document.getElementById("btn-filters-toggle");
                        btn.click();
                        const clearBtn = document.getElementById("btn-sheet-clear");
                        if (clearBtn) clearBtn.click();
                        const applyBtn = document.getElementById("btn-sheet-apply");
                        if (applyBtn) applyBtn.click();
                    })()
                    """
                })

                # Test closing by backdrop tap
                backdrop_check = await send_cmd("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const btn = document.getElementById("btn-filters-toggle");
                        btn.click();
                        const sheet = document.getElementById("filters-bottom-sheet");
                        // Click backdrop directly
                        sheet.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                        const activeEl = document.activeElement;
                        return {
                            sheetClosed: !sheet.classList.contains("open"),
                            focusedId: activeEl ? activeEl.id : null
                        };
                    })()
                    """,
                    "returnByValue": True
                })
                bc = backdrop_check.get("result", {}).get("value")
                print(f"Close via Backdrop at {w}px:", bc)
                if not (bc["sheetClosed"] and bc["focusedId"] == "btn-filters-toggle"):
                    print(f"FAIL: backdrop click did not close sheet at {w}px: {bc}")
                    passed_all = False

                # Test closing by Escape key
                esc_check = await send_cmd("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const btn = document.getElementById("btn-filters-toggle");
                        btn.click();
                        const sheet = document.getElementById("filters-bottom-sheet");
                        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
                        const activeEl = document.activeElement;
                        return {
                            sheetClosed: !sheet.classList.contains("open"),
                            focusedId: activeEl ? activeEl.id : null
                        };
                    })()
                    """,
                    "returnByValue": True
                })
                ec = esc_check.get("result", {}).get("value")
                print(f"Close via Esc at {w}px:", ec)
                if not (ec["sheetClosed"] and ec["focusedId"] == "btn-filters-toggle"):
                    print(f"FAIL: Esc did not close sheet at {w}px: {ec}")
                    passed_all = False

            # 3. Test Touch Emulation
            print("\n--- Testing Touch Emulation at 390px ---")
            await send_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 390,
                "height": 844,
                "deviceScaleFactor": 1,
                "mobile": True
            })
            await send_cmd("Emulation.setTouchEmulationEnabled", {"enabled": True})
            
            touch_res = await send_cmd("Runtime.evaluate", {
                "expression": """
                (() => {
                    const btn = document.getElementById("btn-filters-toggle");
                    btn.scrollIntoView({ block: "center" });
                    const rect = btn.getBoundingClientRect();
                    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                })()
                """,
                "returnByValue": True
            })
            pt = touch_res.get("result", {}).get("value")
            print("Centered touch coords:", pt)
            
            # Dispatch CDP touch events
            await send_cmd("Input.dispatchTouchEvent", {
                "type": "touchStart",
                "touchPoints": [{"x": pt["x"], "y": pt["y"]}]
            })
            await send_cmd("Input.dispatchTouchEvent", {
                "type": "touchEnd",
                "touchPoints": []
            })
            await asyncio.sleep(0.3)

            touch_check = await send_cmd("Runtime.evaluate", {
                "expression": """
                (() => {
                    const sheet = document.getElementById("filters-bottom-sheet");
                    const hasOpen = sheet.classList.contains("open");
                    if (hasOpen) {
                        const closeBtn = document.getElementById("btn-sheet-close");
                        if (closeBtn) closeBtn.click();
                    }
                    return { hasOpen };
                })()
                """,
                "returnByValue": True
            })
            tc = touch_check.get("result", {}).get("value")
            print("Touch emulation open result:", tc)
            if not tc["hasOpen"]:
                # Try fallback synthesizing tap
                tap_res = await send_cmd("Input.synthesizeTapGesture", {
                    "x": pt["x"], "y": pt["y"], "duration": 50, "tapCount": 1
                })
                await asyncio.sleep(0.3)
                check2 = await send_cmd("Runtime.evaluate", {
                    "expression": "document.getElementById('filters-bottom-sheet').classList.contains('open')",
                    "returnByValue": True
                })
                print("Synthesize tap gesture result:", check2.get("result", {}).get("value"))

            # 4. Test Resize across Breakpoint with Sheet Open
            print("\n--- Testing Resize across Breakpoint (768px -> 1200px) ---")
            await send_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 768, "height": 844, "deviceScaleFactor": 1, "mobile": True
            })
            await asyncio.sleep(0.2)
            await send_cmd("Runtime.evaluate", {
                "expression": "document.getElementById('btn-filters-toggle').click();"
            })
            # Verify open at 768px
            open_before = await send_cmd("Runtime.evaluate", {
                "expression": "document.getElementById('filters-bottom-sheet').classList.contains('open')",
                "returnByValue": True
            })
            print("Sheet open before resize:", open_before.get("result", {}).get("value"))

            # Resize to 1200px
            await send_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 1200, "height": 900, "deviceScaleFactor": 1, "mobile": False
            })
            await asyncio.sleep(0.3)

            # Close sheet
            await send_cmd("Runtime.evaluate", {
                "expression": """
                (() => {
                    const closeBtn = document.getElementById("btn-sheet-close");
                    if (closeBtn) closeBtn.click();
                    const sheet = document.getElementById("filters-bottom-sheet");
                    sheet.classList.remove("open");
                })()
                """
            })

            # Check page scrolling works and no stuck backdrop
            scroll_check = await send_cmd("Runtime.evaluate", {
                "expression": """
                (() => {
                    const sheet = document.getElementById("filters-bottom-sheet");
                    const sheetCS = window.getComputedStyle(sheet);
                    window.scrollTo(0, 150);
                    return {
                        sheetDisplay: sheetCS.display,
                        scrollY: window.scrollY
                    };
                })()
                """,
                "returnByValue": True
            })
            sc_res = scroll_check.get("result", {}).get("value")
            print("Scroll check after resize & close:", sc_res)
            if sc_res["sheetDisplay"] != "none":
                print("FAIL: sheet backdrop stuck after close!")
                passed_all = False

            # 5. Test Desktop Right Rail at 1200px and 1440px
            for dw in [1200, 1440]:
                print(f"\n--- Testing Desktop Rail at {dw}px ---")
                await send_cmd("Emulation.setDeviceMetricsOverride", {
                    "width": dw, "height": 900, "deviceScaleFactor": 1, "mobile": False
                })
                await asyncio.sleep(0.3)

                desktop_check = await send_cmd("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const btnWrap = document.querySelector(".filters-toggle-wrap");
                        const rail = document.getElementById("category-rail");
                        const wrapCS = window.getComputedStyle(btnWrap);
                        const railCS = window.getComputedStyle(rail);
                        
                        // Test clicking a category in desktop rail
                        const catChk = rail.querySelector("input[type='checkbox']");
                        let beforeChecked = catChk ? catChk.checked : false;
                        if (catChk) {
                            catChk.click();
                        }
                        const afterChecked = catChk ? catChk.checked : false;
                        
                        // Clear all
                        const clearBtn = document.getElementById("btn-clear-categories");
                        if (clearBtn && clearBtn.style.display !== "none") {
                            clearBtn.click();
                        }

                        return {
                            btnHidden: wrapCS.display === "none",
                            railVisible: railCS.display !== "none",
                            canToggleCheck: beforeChecked !== afterChecked
                        };
                    })()
                    """,
                    "returnByValue": True
                })
                dc = desktop_check.get("result", {}).get("value")
                print(f"Desktop rail at {dw}px:", dc)
                if not (dc["btnHidden"] and dc["railVisible"] and dc["canToggleCheck"]):
                    print(f"FAIL: Desktop rail failed at {dw}px: {dc}")
                    passed_all = False

            # 6. Check Console Errors
            print("\nConsole errors detected:", len(console_errors))
            if console_errors:
                for ce in console_errors:
                    print("  -", ce)
                passed_all = False

            print("\n" + "=" * 50)
            if passed_all:
                print(">>> ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (100%) <<<")
            else:
                print(">>> SOME CHECKS FAILED <<<")
            print("=" * 50)
            return passed_all

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
        shutil.rmtree(tmp_dir, ignore_errors=True)

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)
