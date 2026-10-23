#!/usr/bin/env python3
"""
verify_rls.py
-------------
Stage 8a Row Level Security checks against the live Supabase project.

Reads (never hardcodes, never commits) from the environment:
  TEST_EMAIL_A, TEST_PASSWORD_A, TEST_EMAIL_B, TEST_PASSWORD_B,
  SUPABASE_URL, SUPABASE_ANON_KEY

If any of those are missing, prints SKIPPED and does not claim a result.

Does not print passwords, tokens, emails, or other personal data.
"""

from __future__ import annotations

import json
import os
import ssl
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone

REQUIRED_ENV = [
    "TEST_EMAIL_A",
    "TEST_PASSWORD_A",
    "TEST_EMAIL_B",
    "TEST_PASSWORD_B",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
]


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def request(method, url, headers, body=None, timeout=30):
    data = None
    hdrs = dict(headers)
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, raw
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        return err.code, raw
    except urllib.error.URLError:
        return 0, ""


def parse_json(raw):
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def http_error_code(raw):
    """Return a non-sensitive PostgREST/GoTrue error code or status hint."""
    parsed = parse_json(raw)
    if isinstance(parsed, dict):
        return str(parsed.get("code") or parsed.get("error_code") or parsed.get("error") or "error")
    return "error"


class Checks:
    def __init__(self):
        self.failed = 0
        self.passed = 0

    def record(self, name, ok, detail=""):
        status = "PASS" if ok else "FAIL"
        extra = " " + detail if detail and not ok else ""
        print(f"{status}  {name}{extra}")
        if ok:
            self.passed += 1
        else:
            self.failed += 1
        return ok


def rest_headers(anon_key, access_token=None, prefer=None):
    token = access_token if access_token else anon_key
    headers = {
        "apikey": anon_key,
        "Authorization": "Bearer " + token,
        "Accept": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def sign_in(base, anon_key, email, password):
    status, raw = request(
        "POST",
        base + "/auth/v1/token?grant_type=password",
        {
            "apikey": anon_key,
            "Authorization": "Bearer " + anon_key,
            "Content-Type": "application/json",
        },
        {"email": email, "password": password},
    )
    parsed = parse_json(raw)
    if status != 200 or not isinstance(parsed, dict):
        return None, None
    token = parsed.get("access_token")
    user = parsed.get("user") or {}
    uid = user.get("id")
    if not token or not uid:
        return None, None
    return token, uid


def main():
    missing = [name for name in REQUIRED_ENV if not os.environ.get(name)]
    if missing:
        print("SKIPPED")
        print("Missing environment variables: " + ", ".join(missing))
        print("No RLS result is claimed.")
        return 0

    base = os.environ["SUPABASE_URL"].rstrip("/")
    anon_key = os.environ["SUPABASE_ANON_KEY"]
    checks = Checks()

    token_a, uid_a = sign_in(base, anon_key, os.environ["TEST_EMAIL_A"], os.environ["TEST_PASSWORD_A"])
    token_b, uid_b = sign_in(base, anon_key, os.environ["TEST_EMAIL_B"], os.environ["TEST_PASSWORD_B"])

    if not checks.record("sign in Helper A", bool(token_a and uid_a)):
        print("Cannot continue without Helper A session.")
        return 1
    if not checks.record("sign in Helper B", bool(token_b and uid_b)):
        print("Cannot continue without Helper B session.")
        return 1
    if uid_a == uid_b:
        checks.record("Helper A and Helper B are different accounts", False, "same auth id")
        return 1
    checks.record("Helper A and Helper B are different accounts", True)

    hdr_a = rest_headers(anon_key, token_a, prefer="return=representation")
    hdr_b = rest_headers(anon_key, token_b, prefer="return=representation")
    hdr_anon = rest_headers(anon_key, None)

    profile_id = str(uuid.uuid4())
    now = utc_now()
    profile_row = {
        "id": profile_id,
        "name": "rls-verify-temp",
        "facts": {},
        "consent": True,
        "created_at": now,
        "updated_at": now,
    }

    created_profile = False
    created_app_ids = []

    try:
        status, raw = request("POST", base + "/rest/v1/profiles", hdr_a, profile_row)
        created = status in (201, 200)
        created_profile = created
        checks.record("A can insert own profile", created, "HTTP " + str(status))

        status, raw = request(
            "GET",
            base + "/rest/v1/profiles?id=eq." + profile_id + "&select=id,owner_id,consent",
            rest_headers(anon_key, token_a),
        )
        rows = parse_json(raw)
        own_ok = (
            status == 200
            and isinstance(rows, list)
            and len(rows) == 1
            and rows[0].get("id") == profile_id
            and rows[0].get("owner_id") == uid_a
            and rows[0].get("consent") is True
        )
        checks.record("A can read own profile", own_ok, "HTTP " + str(status))

        status, raw = request(
            "GET",
            base + "/rest/v1/profiles?id=eq." + profile_id + "&select=id",
            rest_headers(anon_key, token_b),
        )
        rows = parse_json(raw)
        b_read_blocked = status in (200, 401, 403) and (not rows)
        checks.record("B cannot read A's profile", b_read_blocked, "HTTP " + str(status))

        status, raw = request(
            "PATCH",
            base + "/rest/v1/profiles?id=eq." + profile_id,
            hdr_b,
            {"name": "rls-verify-hijack"},
        )
        patched = parse_json(raw)
        b_update_empty = status in (200, 204, 401, 403) and not patched
        status_check, raw_check = request(
            "GET",
            base + "/rest/v1/profiles?id=eq." + profile_id + "&select=name",
            rest_headers(anon_key, token_a),
        )
        still_named = parse_json(raw_check)
        name_unchanged = (
            status_check == 200
            and isinstance(still_named, list)
            and still_named
            and still_named[0].get("name") == "rls-verify-temp"
        )
        checks.record(
            "B cannot update A's profile",
            b_update_empty and name_unchanged,
            "HTTP " + str(status),
        )

        status, raw = request(
            "DELETE",
            base + "/rest/v1/profiles?id=eq." + profile_id,
            rest_headers(anon_key, token_b, prefer="return=representation"),
        )
        deleted = parse_json(raw)
        b_delete_empty = status in (200, 204, 401, 403) and not deleted
        status_check, raw_check = request(
            "GET",
            base + "/rest/v1/profiles?id=eq." + profile_id + "&select=id",
            rest_headers(anon_key, token_a),
        )
        still_there = parse_json(raw_check)
        still_exists = (
            status_check == 200
            and isinstance(still_there, list)
            and len(still_there) == 1
        )
        checks.record(
            "B cannot delete A's profile",
            b_delete_empty and still_exists,
            "HTTP " + str(status),
        )

        spoof_id = str(uuid.uuid4())
        spoof_now = utc_now()
        status, raw = request(
            "POST",
            base + "/rest/v1/profiles",
            hdr_b,
            {
                "id": spoof_id,
                "owner_id": uid_a,
                "name": "rls-verify-spoof-owner",
                "facts": {},
                "consent": True,
                "created_at": spoof_now,
                "updated_at": spoof_now,
            },
        )
        spoof_blocked = status in (401, 403, 409) or (
            status in (200, 201) and not parse_json(raw)
        )
        if status in (200, 201):
            # If the row landed, it must not belong to A. Clean it up as B.
            request(
                "DELETE",
                base + "/rest/v1/profiles?id=eq." + spoof_id,
                rest_headers(anon_key, token_b),
            )
            # Confirm A cannot see a spoofed row
            status_check, raw_check = request(
                "GET",
                base + "/rest/v1/profiles?id=eq." + spoof_id + "&select=id,owner_id",
                rest_headers(anon_key, token_a),
            )
            seen = parse_json(raw_check)
            spoof_blocked = not seen
        checks.record(
            "B cannot insert a row with owner_id = A",
            spoof_blocked,
            "HTTP " + str(status) + " " + http_error_code(raw),
        )

        bad_consent_id = str(uuid.uuid4())
        status, raw = request(
            "POST",
            base + "/rest/v1/profiles",
            hdr_a,
            {
                "id": bad_consent_id,
                "name": "rls-verify-no-consent",
                "facts": {},
                "consent": False,
                "created_at": utc_now(),
                "updated_at": utc_now(),
            },
        )
        consent_rejected = status >= 400
        if status in (200, 201):
            request(
                "DELETE",
                base + "/rest/v1/profiles?id=eq." + bad_consent_id,
                rest_headers(anon_key, token_a),
            )
            consent_rejected = False
        checks.record("insert with consent=false fails", consent_rejected, "HTTP " + str(status))

        app_id = str(uuid.uuid4())
        status, raw = request(
            "POST",
            base + "/rest/v1/applications",
            hdr_b,
            {
                "id": app_id,
                "owner_id": uid_b,
                "profile_id": profile_id,
                "scheme_id": "rls-verify-temp",
                "status": "Saved",
                "status_updated_at": utc_now(),
                "docs_done": [],
                "created_at": utc_now(),
                "updated_at": utc_now(),
            },
        )
        app_blocked = status >= 400
        if status in (200, 201):
            created_app_ids.append((app_id, token_b))
            app_blocked = False
        checks.record(
            "application cannot be attached to someone else's profile",
            app_blocked,
            "HTTP " + str(status),
        )

        status, raw = request(
            "GET",
            base + "/rest/v1/profiles?select=id",
            hdr_anon,
        )
        rows = parse_json(raw)
        unauth_empty = status in (200, 401, 403) and not rows
        checks.record("unauthenticated request reads nothing", unauth_empty, "HTTP " + str(status))

    finally:
        for app_id, token in created_app_ids:
            request(
                "DELETE",
                base + "/rest/v1/applications?id=eq." + app_id,
                rest_headers(anon_key, token),
            )
        if created_profile:
            request(
                "DELETE",
                base + "/rest/v1/profiles?id=eq." + profile_id,
                rest_headers(anon_key, token_a),
            )

    print("")
    print(f"Passed: {checks.passed}  Failed: {checks.failed}")
    if checks.failed:
        print("RESULT  FAIL")
        return 1
    print("RESULT  PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
