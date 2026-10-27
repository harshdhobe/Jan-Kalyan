import subprocess
import json
import time
import urllib.request
import sys
import websocket

sys.stdout.reconfigure(encoding='utf-8')

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
proc = subprocess.Popen([
    chrome_path,
    "--headless=new",
    "--remote-debugging-port=9226",
    "--remote-allow-origins=*",
    "--disable-extensions",
    "about:blank"
])

time.sleep(1.5)

try:
    with urllib.request.urlopen("http://localhost:9226/json") as r:
        raw_targets = json.loads(r.read().decode('utf-8'))
        targets = [t for t in raw_targets if t.get('type') == 'page']
        ws_url = targets[0]["webSocketDebuggerUrl"]

    ws = websocket.create_connection(ws_url)

    msg_id = 0
    console_errors = []

    def call(m, p=None):
        global msg_id
        msg_id += 1
        ws.send(json.dumps({"id": msg_id, "method": m, "params": p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get("method") == "Runtime.consoleAPICalled":
                args = r.get("params", {}).get("args", [])
                t = r.get("params", {}).get("type")
                text = " ".join([str(a.get("value", a.get("description", ""))) for a in args])
                if t in ["error", "warning"]:
                    console_errors.append(f"[{t}] {text}")
            elif r.get("method") == "Runtime.exceptionThrown":
                desc = r.get("params", {}).get("exceptionDetails", {}).get("text", "")
                console_errors.append(f"[exception] {desc}")
            if r.get("id") == msg_id:
                return r.get("result", {})

    call("Page.enable")
    call("Runtime.enable")

    def eval_js(expr):
        res = call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
        return res.get("result", {}).get("value")

    def nav(url, wait_sec=0.8):
        call("Page.navigate", {"url": url})
        time.sleep(wait_sec)

    def get_stats():
        return {
            "hash": eval_js("window.location.hash"),
            "data_page": eval_js("document.body.querySelector('[data-page]') ? document.body.querySelector('[data-page]').getAttribute('data-page') : ''"),
            "landing_count": eval_js("document.querySelectorAll('[data-page=\"landing\"]').length"),
            "headers": eval_js("document.querySelectorAll('header').length"),
            "footers": eval_js("document.querySelectorAll('footer').length"),
            "h1_count": eval_js("document.querySelectorAll('h1').length"),
            "h1_text": eval_js("(document.querySelector('h1') || {}).textContent || ''").strip()
        }

    # Reset localStorage to default English
    nav("http://localhost:8000/#/")
    eval_js("localStorage.removeItem('jk_lang'); localStorage.removeItem('supabase.auth.token');")

    print("\n--- TEST DIRECT ROUTE LOADS ---")
    direct_routes = [
        ("Empty hash", "http://localhost:8000/"),
        ("#/ (Landing)", "http://localhost:8000/#/"),
        ("Helper login (#/login)", "http://localhost:8000/#/login"),
        ("Dashboard unauth (#/dashboard)", "http://localhost:8000/#/dashboard"),
        ("Quick check (#/quick)", "http://localhost:8000/#/quick"),
        ("Unknown route (#/zzz)", "http://localhost:8000/#/zzz")
    ]

    direct_results = []
    for name, url in direct_routes:
        nav(url, wait_sec=1.0)
        st = get_stats()
        direct_results.append((name, st))
        print(f"[{name}] Hash: '{st['hash']}' | data-page: '{st['data_page']}' | Landing: {st['landing_count']} | Header: {st['headers']} | Footer: {st['footers']} | H1: {st['h1_count']} ('{st['h1_text']}')")

    print("\n--- TEST CLICK-THROUGH FROM LANDING PAGE ---")
    click_routes = []

    # 1. Click-through: Quick check
    nav("http://localhost:8000/#/")
    time.sleep(0.5)
    eval_js("document.getElementById('hero-btn-quick').click()")
    time.sleep(0.6)
    click_routes.append(("Click: Quick check", get_stats()))

    # 2. Click-through: Helper (no session)
    nav("http://localhost:8000/#/")
    time.sleep(0.5)
    eval_js("document.getElementById('hero-btn-helper').click()")
    time.sleep(0.6)
    click_routes.append(("Click: Helper (no session)", get_stats()))

    for name, st in click_routes:
        print(f"[{name}] Hash: '{st['hash']}' | data-page: '{st['data_page']}' | Landing: {st['landing_count']} | Header: {st['headers']} | Footer: {st['footers']} | H1: {st['h1_count']} ('{st['h1_text']}')")

    print("\n--- TEST FLOW 1: Quick check -> Back -> Landing ---")
    nav("http://localhost:8000/#/")
    time.sleep(0.5)
    eval_js("document.getElementById('hero-btn-quick').click()")
    time.sleep(0.5)
    st_qc = get_stats()
    print("In Quick Check:", st_qc)
    eval_js("window.history.back()")
    time.sleep(0.6)
    st_back = get_stats()
    print("After Browser Back:", st_back)

    print("\n--- TEST FLOW 2 & 3: Helper with session -> Dashboard ---")
    # Simulate a logged in helper account in GovDB, GovCloud, and GovApp state
    eval_js("""
    (async () => {
        if (window.GovCloud) {
            window.GovCloud.isConfigured = () => true;
            window.GovCloud.getSession = async () => ({
                data: { session: { user: { id: "test-user-123", email: "helper@example.com" } } },
                error: null
            });
        }
        if (window.GovDB) {
            await window.GovDB.setMeta('helper_account', {
                name: 'Sunita Patil',
                helper_type: 'ASHA',
                district: 'Pune',
                language: 'en'
            });
        }
        window.GovApp.getState().helperAccount = {
            name: 'Sunita Patil',
            helper_type: 'ASHA',
            district: 'Pune',
            language: 'en'
        };
    })()
    """)
    # Navigate to #/dashboard directly now that session exists
    eval_js("window.location.hash = '#/dashboard'")
    time.sleep(0.8)
    st_dash = get_stats()
    has_helper_pill_on_dash = eval_js("document.getElementById('header-helper-pill') ? document.getElementById('header-helper-pill').style.display !== 'none' : false")
    print(f"Dashboard: Hash: '{st_dash['hash']}' | data-page: '{st_dash['data_page']}' | Landing: {st_dash['landing_count']} | Header: {st_dash['headers']} | Footer: {st_dash['footers']} | H1: {st_dash['h1_count']} ('{st_dash['h1_text']}') | Helper pill visible: {has_helper_pill_on_dash}")

    # Now click logo to return to landing
    print("\n--- TEST FLOW 4: Dashboard -> Click Logo -> Landing ---")
    eval_js("document.getElementById('brand-logo').click()")
    time.sleep(0.6)
    st_logo = get_stats()
    has_helper_pill_on_landing = eval_js("document.getElementById('header-helper-pill') !== null")
    print(f"Landing after Logo click: Hash: '{st_logo['hash']}' | Landing: {st_logo['landing_count']} | Header: {st_logo['headers']} | Footer: {st_logo['footers']} | H1: {st_logo['h1_count']} ('{st_logo['h1_text']}') | Helper pill in DOM: {has_helper_pill_on_landing}")

    # Click "I'm a Helper" with session -> should go to #/dashboard
    eval_js("document.getElementById('hero-btn-helper').click()")
    time.sleep(0.8)
    st_helper_session = get_stats()
    print(f"Click Helper with session: Hash: '{st_helper_session['hash']}' | data-page: '{st_helper_session['data_page']}' | Landing: {st_helper_session['landing_count']} | Header: {st_helper_session['headers']} | Footer: {st_helper_session['footers']} | H1: {st_helper_session['h1_count']} ('{st_helper_session['h1_text']}')")

    print("\n--- TEST FLOW 5: Language Switching ---")
    nav("http://localhost:8000/#/")
    time.sleep(0.6)
    # Switch to Hindi on landing
    eval_js("document.querySelector('.landing-lang-btn[data-lang=\"hi\"]').click()")
    time.sleep(0.3)
    lang_landing = eval_js("document.documentElement.getAttribute('lang')")
    hero_h1 = eval_js("document.querySelector('h1').textContent.trim()")
    print("Landing switched to Hindi:", lang_landing, "| H1:", hero_h1)

    # Click Quick check
    eval_js("document.getElementById('hero-btn-quick').click()")
    time.sleep(0.6)
    lang_qc = eval_js("document.documentElement.getAttribute('lang')")
    app_header_hi_active = eval_js("document.getElementById('lang-hi').classList.contains('active')")
    print("In Quick check, lang:", lang_qc, "| #lang-hi active in header:", app_header_hi_active)

    # Reload page
    call("Page.reload")
    time.sleep(1.0)
    lang_after_reload = eval_js("document.documentElement.getAttribute('lang')")
    storage_lang = eval_js("localStorage.getItem('jk_lang')")
    print("After reload, html lang:", lang_after_reload, "| storage lang:", storage_lang)

    print("\n--- TEST FLOW 6: Keyboard Tab & Enter Navigation ---")
    nav("http://localhost:8000/#/")
    time.sleep(0.6)
    # Focus helper button and trigger key Enter
    focused_btn = eval_js("""
    (() => {
        const btn = document.getElementById('hero-btn-helper');
        btn.focus();
        return document.activeElement === btn;
    })()
    """)
    print("Keyboard focus on #hero-btn-helper:", focused_btn)
    # Dispatch Enter key event (native behavior on focused <a> link)
    eval_js("""
    (() => {
        if (document.activeElement && document.activeElement.tagName === 'A') {
            document.activeElement.click();
        }
    })()
    """)
    time.sleep(0.6)
    print("After Enter on #hero-btn-helper, hash is:", eval_js("window.location.hash"))

    print("\n--- CONSOLE ERRORS & WARNINGS ---")
    print(f"Total console errors/warnings: {len(console_errors)}")
    for err in console_errors:
        print(" ", err)

    ws.close()

finally:
    proc.terminate()
