"""
test_dashboard_data.py
----------------------
Unit test runner for frontend/js/dashboard-data.js using headless Edge CDP.
Verifies:
1. Threshold boundaries (6/7, 14/15, 29/30)
2. Ordering: Ready to apply -> Documents pending -> Rejected -> Applied; longest waiting first
3. Invalid and future dates count as 0, never NaN
4. Missing scheme ID fallback to 'Scheme no longer in the list'
5. Multi-application profiles: application counts and most urgent status
6. Profile filtering by status and query
7. Empty data handling
"""

import asyncio
import json
import os
import shutil
import subprocess
import time
import urllib.request
import websockets

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not os.path.exists(EDGE_PATH):
    EDGE_PATH = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"

USER_DATA_DIR = r"C:\gov scheme\temp_edge_dash_data_test"
DEBUG_PORT = 9279

async def eval_js(ws, expr, req_id):
    await ws.send(json.dumps({
        "id": req_id,
        "method": "Runtime.evaluate",
        "params": {
            "expression": expr,
            "awaitPromise": True,
            "returnByValue": True
        }
    }))
    while True:
        msg = json.loads(await ws.recv())
        if msg.get("id") == req_id:
            res = msg.get("result", {}).get("result", {})
            if "exceptionDetails" in msg.get("result", {}):
                raise Exception("JS Exception: " + json.dumps(msg["result"]["exceptionDetails"]))
            return res.get("value")

async def run_tests():
    if os.path.exists(USER_DATA_DIR):
        shutil.rmtree(USER_DATA_DIR, ignore_errors=True)

    cmd = [
        EDGE_PATH,
        "--headless=new",
        f"--remote-debugging-port={DEBUG_PORT}",
        f"--user-data-dir={USER_DATA_DIR}",
        "--no-first-run",
        "--no-default-browser-check",
        "about:blank"
    ]

    proc = subprocess.Popen(cmd)
    try:
        # Wait for CDP
        ws_url = None
        for _ in range(30):
            try:
                req = urllib.request.urlopen(f"http://127.0.0.1:{DEBUG_PORT}/json")
                targets = json.loads(req.read().decode())
                if targets:
                    ws_url = targets[0]["webSocketDebuggerUrl"]
                    break
            except Exception:
                await asyncio.sleep(0.2)

        if not ws_url:
            raise RuntimeError("Could not connect to Edge DevTools")

        async with websockets.connect(ws_url, max_size=10*1024*1024) as ws:
            with open("frontend/js/dashboard-data.js", "r", encoding="utf-8") as f:
                dash_code = f.read()

            # Inject dashboard-data.js
            await eval_js(ws, dash_code, 1)

            test_script = """
            (function() {
                const results = [];
                const GovData = window.GovDashboardData;
                if (!GovData) throw new Error("GovDashboardData not found on window");

                const NOW = 1761480000000;
                const DAY_MS = 86400000;
                const daysAgo = (d) => new Date(NOW - d * DAY_MS).toISOString();

                // 1. calculateDaysElapsed
                if (GovData.calculateDaysElapsed(NOW - 5 * DAY_MS, NOW) !== 5) throw new Error("Days 5 failed");
                if (GovData.calculateDaysElapsed(daysAgo(10), NOW) !== 10) throw new Error("Days 10 failed");
                if (GovData.calculateDaysElapsed(NOW + 2 * DAY_MS, NOW) !== 0) throw new Error("Future date failed");
                if (GovData.calculateDaysElapsed("invalid-date", NOW) !== 0) throw new Error("Invalid date string failed");
                if (GovData.calculateDaysElapsed(null, NOW) !== 0) throw new Error("null failed");
                results.push("[PASS] Date & days calculations");

                // 2. Threshold Boundaries
                const mockLookup = (id) => (id === "v1" ? "Valid Scheme 1" : null);
                const profiles = [
                    { id: "p1", name: "Ramesh Pawar", updatedAt: daysAgo(2) },
                    { id: "p2", name: "Sunita Shinde", updatedAt: daysAgo(5) }
                ];
                const boundaryApps = [
                    { id: "app-doc-6", profileId: "p1", schemeId: "v1", status: "Documents pending", statusUpdatedAt: daysAgo(6) },
                    { id: "app-doc-7", profileId: "p1", schemeId: "v1", status: "Documents pending", statusUpdatedAt: daysAgo(7) },
                    { id: "app-rej-14", profileId: "p1", schemeId: "v1", status: "Rejected", statusUpdatedAt: daysAgo(14) },
                    { id: "app-rej-15", profileId: "p1", schemeId: "v1", status: "Rejected", statusUpdatedAt: daysAgo(15) },
                    { id: "app-app-29", profileId: "p2", schemeId: "v1", status: "Applied", statusUpdatedAt: daysAgo(29) },
                    { id: "app-app-30", profileId: "p2", schemeId: "v1", status: "Applied", statusUpdatedAt: daysAgo(30) },
                    { id: "app-ready-0", profileId: "p2", schemeId: "v1", status: "Ready to apply", statusUpdatedAt: daysAgo(0) }
                ];
                const resB = GovData.computeDashboardData(profiles, boundaryApps, mockLookup, NOW);
                const actionIds = resB.actionRows.map(r => r.applicationId);

                if (actionIds.includes("app-doc-6")) throw new Error("Docs pending at 6 days must not be listed");
                if (!actionIds.includes("app-doc-7")) throw new Error("Docs pending at 7 days must be listed");
                if (!actionIds.includes("app-rej-14")) throw new Error("Rejected at 14 days must be listed");
                if (actionIds.includes("app-rej-15")) throw new Error("Rejected at 15 days must not be listed");
                if (actionIds.includes("app-app-29")) throw new Error("Applied at 29 days must not be listed");
                if (!actionIds.includes("app-app-30")) throw new Error("Applied at 30 days must be listed");
                if (!actionIds.includes("app-ready-0")) throw new Error("Ready to apply at 0 days must be listed");
                results.push("[PASS] Threshold boundaries (6/7, 14/15, 29/30)");

                // 3. Ordering: Ready to apply -> Docs pending -> Rejected -> Applied; longest waiting first
                const orderingApps = [
                    { id: "app-app-35", profileId: "p1", schemeId: "v1", status: "Applied", statusUpdatedAt: daysAgo(35) },
                    { id: "app-app-50", profileId: "p1", schemeId: "v1", status: "Applied", statusUpdatedAt: daysAgo(50) },
                    { id: "app-rej-5", profileId: "p1", schemeId: "v1", status: "Rejected", statusUpdatedAt: daysAgo(5) },
                    { id: "app-rej-10", profileId: "p1", schemeId: "v1", status: "Rejected", statusUpdatedAt: daysAgo(10) },
                    { id: "app-doc-8", profileId: "p1", schemeId: "v1", status: "Documents pending", statusUpdatedAt: daysAgo(8) },
                    { id: "app-doc-20", profileId: "p1", schemeId: "v1", status: "Documents pending", statusUpdatedAt: daysAgo(20) },
                    { id: "app-ready-2", profileId: "p1", schemeId: "v1", status: "Ready to apply", statusUpdatedAt: daysAgo(2) },
                    { id: "app-ready-10", profileId: "p1", schemeId: "v1", status: "Ready to apply", statusUpdatedAt: daysAgo(10) }
                ];
                const resO = GovData.computeDashboardData(profiles, orderingApps, mockLookup, NOW);
                const orderSummary = resO.actionRows.map(r => `${r.actionKey}:${r.days}`).join(", ");
                const expected = "apply_now:10, apply_now:2, collect_documents:20, collect_documents:8, rejected_review:10, rejected_review:5, check_status:50, check_status:35";
                if (orderSummary !== expected) {
                    throw new Error("Ordering mismatch: " + orderSummary + " vs " + expected);
                }
                results.push("[PASS] Group ordering and longest waiting first");

                // 4. Missing scheme lookup
                const missingApps = [
                    { id: "m1", profileId: "p1", schemeId: "nonexistent", status: "Ready to apply", statusUpdatedAt: daysAgo(1) },
                    { id: "m2", profileId: "p1", schemeId: null, status: "Ready to apply", statusUpdatedAt: daysAgo(1) }
                ];
                const resM = GovData.computeDashboardData(profiles, missingApps, mockLookup, NOW);
                if (resM.actionRows[0].schemeName !== "Scheme no longer in the list" || !resM.actionRows[0].isSchemeMissing) {
                    throw new Error("Missing scheme name fallback failed for m1");
                }
                if (resM.actionRows[1].schemeName !== "Scheme no longer in the list" || !resM.actionRows[1].isSchemeMissing) {
                    throw new Error("Missing scheme name fallback failed for m2");
                }
                results.push("[PASS] Missing scheme ID graceful fallback");

                // 5. Counts per application & Profile urgency
                const multiApps = [
                    { id: "a1", profileId: "p1", schemeId: "v1", status: "Documents pending", statusUpdatedAt: daysAgo(1) },
                    { id: "a2", profileId: "p1", schemeId: "v1", status: "Ready to apply", statusUpdatedAt: daysAgo(2) },
                    { id: "a3", profileId: "p1", schemeId: "v1", status: "Applied", statusUpdatedAt: daysAgo(3) },
                    { id: "a4", profileId: "p2", schemeId: "v1", status: "Benefit received", statusUpdatedAt: daysAgo(4) },
                    { id: "a5", profileId: "p2", schemeId: "v1", status: "Benefit received", statusUpdatedAt: daysAgo(5) },
                    { id: "a6", profileId: "p2", schemeId: "v1", status: "Saved", statusUpdatedAt: daysAgo(6) }
                ];
                const resMulti = GovData.computeDashboardData(profiles, multiApps, mockLookup, NOW);
                if (resMulti.counts.docsPending !== 1) throw new Error("docsPending count mismatch");
                if (resMulti.counts.readyToApply !== 1) throw new Error("readyToApply count mismatch");
                if (resMulti.counts.waitingDecision !== 1) throw new Error("waitingDecision count mismatch");
                if (resMulti.counts.benefitsReceived !== 2) throw new Error("benefitsReceived count mismatch");
                if (resMulti.counts.totalApplications !== 6) throw new Error("totalApplications mismatch");

                const p1Enriched = resMulti.profiles.find(p => p.id === "p1");
                const p2Enriched = resMulti.profiles.find(p => p.id === "p2");
                if (p1Enriched.savedCount !== 3 || p1Enriched.mostUrgentStatus !== "Ready to apply") {
                    throw new Error("Profile 1 urgency resolution failed: " + JSON.stringify(p1Enriched));
                }
                if (p2Enriched.savedCount !== 3 || p2Enriched.mostUrgentStatus !== "Benefit received") {
                    throw new Error("Profile 2 urgency resolution failed: " + JSON.stringify(p2Enriched));
                }
                results.push("[PASS] Counts per application and profile urgency");

                // 6. Filtering
                const fBenefit = GovData.filterDashboardProfiles(resMulti.profiles, { statusFilter: "Benefit received" });
                if (fBenefit.length !== 1 || fBenefit[0].id !== "p2") throw new Error("Filter by Benefit received failed");

                const fReady = GovData.filterDashboardProfiles(resMulti.profiles, { statusFilter: "Ready to apply" });
                if (fReady.length !== 1 || fReady[0].id !== "p1") throw new Error("Filter by Ready to apply failed");

                const fSearch = GovData.filterDashboardProfiles(resMulti.profiles, { searchQuery: "sunita" });
                if (fSearch.length !== 1 || fSearch[0].id !== "p2") throw new Error("Filter by search failed");

                const fNone = GovData.filterDashboardProfiles(resMulti.profiles, { statusFilter: "Ready to apply", searchQuery: "sunita" });
                if (fNone.length !== 0) throw new Error("Filter combined none failed");
                results.push("[PASS] Profile filtering by status and query");

                // 7. Empty data
                const resEmpty = GovData.computeDashboardData([], [], mockLookup, NOW);
                if (resEmpty.actionRows.length !== 0 || resEmpty.profiles.length !== 0) throw new Error("Empty data failed");
                results.push("[PASS] Empty data handling");

                return { success: true, results };
            })()
            """
            res = await eval_js(ws, test_script, 2)
            for r in res["results"]:
                print(r)
            print("\nALL GOVDASHBOARDDATA UNIT TESTS PASSED!")

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2.0)
        except Exception:
            proc.kill()
        if os.path.exists(USER_DATA_DIR):
            shutil.rmtree(USER_DATA_DIR, ignore_errors=True)

if __name__ == "__main__":
    asyncio.run(run_tests())
