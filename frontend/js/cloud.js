/**
 * cloud.js
 * --------
 * JanKalyan Cloud Backup & Auth client for Supabase.
 * ONLY module in the entire application allowed to interact with the Supabase client.
 *
 * Privacy & Security Constraints:
 * - Never log passwords, tokens, emails, or personal data to the console.
 * - Never expose raw Supabase error messages to the user.
 * - Treat network failures as "offline", NOT as sign-out.
 * - Only definitive auth failure (invalid or expired refresh token, 401) forces re-login.
 */

(function (window) {
  "use strict";

  let supabaseClient = null;
  let testClient = null;
  let isInitialized = false;

  function getClient() {
    return testClient || supabaseClient;
  }

  function __setClientForTesting(client) {
    testClient = client;
    if (client) {
      isInitialized = true;
    }
  }

  /**
   * Initializes the Supabase client if JanKalyanConfig has cloudEnabled = true.
   * Returns true if initialized, false otherwise.
   */
  function init() {
    if (testClient) return true;
    if (isInitialized && supabaseClient) return true;

    const config = window.JanKalyanConfig;
    if (!config || !config.cloudEnabled || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
      supabaseClient = null;
      isInitialized = false;
      return false;
    }

    if (typeof window.supabase === "undefined" || typeof window.supabase.createClient !== "function") {
      console.warn("Supabase library not loaded in window.");
      supabaseClient = null;
      isInitialized = false;
      return false;
    }

    try {
      supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      });
      isInitialized = true;
      return true;
    } catch (err) {
      console.warn("Failed to initialize Supabase client.");
      supabaseClient = null;
      isInitialized = false;
      return false;
    }
  }

  function isConfigured() {
    if (testClient) return true;
    if (!isInitialized) init();
    return !!getClient();
  }

  function isOnline() {
    return typeof navigator !== "undefined" && navigator.onLine !== false;
  }

  /**
   * Translates Supabase auth errors to safe, friendly internal error codes.
   */
  function mapAuthError(err) {
    if (!err) return null;
    const msg = String(err.message || "").toLowerCase();
    const status = err.status || 0;

    if (!isOnline() || msg.includes("failed to fetch") || msg.includes("network") || status === 0) {
      return "offline";
    }
    if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already registered")) {
      return "account_exists";
    }
    if (msg.includes("invalid login credentials") || msg.includes("invalid credentials") || status === 400 && msg.includes("credential")) {
      return "invalid_credentials";
    }
    if (msg.includes("password should be at least") || msg.includes("weak password") || err.code === "weak_password") {
      return "weak_password";
    }
    if (status === 429 || msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("over_email_send_rate_limit")) {
      return "too_many_attempts";
    }
    return "generic_error";
  }

  /**
   * Helper Sign Up
   */
  async function signUp({ email, password }) {
    if (!isConfigured()) {
      return { data: null, error: new Error("Cloud service is not configured."), friendlyCode: "not_configured" };
    }
    if (!isOnline()) {
      return { data: null, error: new Error("No network connection."), friendlyCode: "offline" };
    }

    try {
      const { data, error } = await getClient().auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (error) {
        return {
          data: null,
          error,
          friendlyCode: mapAuthError(error),
          requiresEmailConfirmation: false,
        };
      }

      // Check if email confirmation is required (user exists but no active session)
      const requiresEmailConfirmation = !!(data && data.user && !data.session);

      return {
        data,
        error: null,
        friendlyCode: null,
        requiresEmailConfirmation,
        session: data ? data.session : null,
        user: data ? data.user : null,
      };
    } catch (err) {
      return {
        data: null,
        error: err,
        friendlyCode: mapAuthError(err),
        requiresEmailConfirmation: false,
      };
    }
  }

  /**
   * Helper Sign In
   */
  async function signIn({ email, password }) {
    if (!isConfigured()) {
      return { data: null, error: new Error("Cloud service is not configured."), friendlyCode: "not_configured" };
    }
    if (!isOnline()) {
      return { data: null, error: new Error("No network connection."), friendlyCode: "offline" };
    }

    try {
      const { data, error } = await getClient().auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        return {
          data: null,
          error,
          friendlyCode: mapAuthError(error),
        };
      }

      return {
        data,
        error: null,
        friendlyCode: null,
        session: data ? data.session : null,
        user: data ? data.user : null,
      };
    } catch (err) {
      return {
        data: null,
        error: err,
        friendlyCode: mapAuthError(err),
      };
    }
  }

  /**
   * Helper Sign Out
   */
  async function signOut() {
    if (!isConfigured()) return { error: null };
    try {
      const client = getClient();
      if (!client || !client.auth) return { error: null };
      const { error } = await client.auth.signOut();
      return { error };
    } catch (err) {
      return { error: err };
    }
  }

  /**
   * Get Active Session
   * Offline resilient: if offline, returns locally persisted session.
   * Only definitive token expiration/revocation returns null.
   */
  async function getSession() {
    if (!isConfigured()) return { data: { session: null }, error: null };

    try {
      const client = getClient();
      if (!client || !client.auth) return { data: { session: null }, error: null };
      const { data, error } = await client.auth.getSession();
      if (error) {
        // Network errors do not clear session
        if (!isOnline() || String(error.message || "").toLowerCase().includes("fetch")) {
          // Attempt to read cached session from client settings
          const session = client.auth.session ? client.auth.session() : null;
          return { data: { session }, error: null };
        }
        return { data: { session: null }, error };
      }
      return { data, error: null };
    } catch (err) {
      if (!isOnline()) {
        return { data: { session: null }, error: null };
      }
      return { data: { session: null }, error: err };
    }
  }

  /**
   * Get current User
   */
  async function getUser() {
    const { data } = await getSession();
    return data && data.session ? data.session.user : null;
  }

  /**
   * Listen for Auth State Changes
   */
  function onAuthChange(callback) {
    if (!isConfigured()) {
      return { data: { subscription: { unsubscribe: function () {} } } };
    }
    const client = getClient();
    if (!client || !client.auth) {
      return { data: { subscription: { unsubscribe: function () {} } } };
    }
    return client.auth.onAuthStateChange(callback);
  }

  /**
   * Cloud Helper Record APIs
   */
  async function getCloudHelper(userId) {
    if (!isConfigured() || !userId) return { data: null, error: null };
    if (!isOnline()) return { data: null, error: new Error("Offline"), isOffline: true };

    try {
      const { data, error } = await getClient()
        .from("helpers")
        .select("id, name, helper_type, district, language, created_at, updated_at")
        .eq("id", userId)
        .maybeSingle();

      if (error) return { data: null, error };
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err, isOffline: !isOnline() };
    }
  }

  async function saveCloudHelper(helperRecord) {
    if (!isConfigured() || !helperRecord || !helperRecord.id) {
      return { data: null, error: new Error("Invalid helper record or unconfigured cloud.") };
    }
    if (!isOnline()) {
      return { data: null, error: new Error("Offline"), isOffline: true };
    }

    try {
      const row = {
        id: helperRecord.id,
        name: helperRecord.name,
        helper_type: helperRecord.helper_type,
        district: helperRecord.district || "",
        language: helperRecord.language || "en",
        updated_at: new Date().toISOString(),
      };
      if (helperRecord.created_at) {
        row.created_at = helperRecord.created_at;
      }

      const { data, error } = await getClient()
        .from("helpers")
        .upsert(row, { onConflict: "id" })
        .select()
        .single();

      if (error) return { data: null, error };
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err, isOffline: !isOnline() };
    }
  }

  /**
   * -------------------------------------------------------------
   * FIELD MAPPING, DEDUPLICATION & PRIVACY HELPERS (STAGE 8a PART 2)
   * -------------------------------------------------------------
   */

  /**
   * Strips any key whose name looks like aadhaar, aadhar, uidai, or an ID number before upload.
   * Preserves benign booleans like has_aadhaar, has_aadhaar_linked_bank_account.
   */
  function cleanFactsForCloud(facts) {
    if (!facts || typeof facts !== "object" || Array.isArray(facts)) return {};
    const cleaned = {};
    const allowedBooleans = new Set(["has_aadhaar", "has_aadhaar_linked_bank_account"]);

    for (const [key, val] of Object.entries(facts)) {
      const lower = key.toLowerCase();
      // Prohibit any key containing aadhaar, aadhar, uidai (except allowed possession booleans)
      if (/aadhaar|aadhar|uidai/i.test(lower) && !allowedBooleans.has(key)) {
        continue;
      }
      // Prohibit any key naming an ID number (e.g. voter_id, pan_number, ration_card_number, id_number)
      if (/id_?num|id_?card|gov_?id|voter_?id|pan_?num|ration_?card_?num|identity_?num/i.test(lower)) {
        continue;
      }
      // If value is a 12-digit number / aadhaar string, skip it
      if (typeof val === "string" && /^\d{4}[\s-]?\d{4}[\s-]?\d{4}$/.test(val.trim())) {
        continue;
      }

      if (val && typeof val === "object" && !Array.isArray(val)) {
        cleaned[key] = cleanFactsForCloud(val);
      } else {
        cleaned[key] = val;
      }
    }
    return cleaned;
  }

  /**
   * Computes latest ISO timestamp between two dates with fallback.
   */
  function getLatestTimestamp(ts1, ts2, fallback) {
    const t1 = ts1 ? new Date(ts1).getTime() : 0;
    const t2 = ts2 ? new Date(ts2).getTime() : 0;
    if (isNaN(t1) && isNaN(t2)) return fallback || new Date().toISOString();
    if (isNaN(t1)) return ts2;
    if (isNaN(t2)) return ts1;
    return t1 >= t2 ? ts1 : ts2;
  }

  /**
   * Profile Local -> Cloud mapping:
   * id, name, facts (cleaned), consent (true), createdAt -> created_at, updatedAt -> updated_at, owner_id
   */
  function toCloudProfile(localProfile, userId) {
    if (!localProfile) return null;
    const now = new Date().toISOString();
    return {
      id: localProfile.id,
      name: (localProfile.name || "").trim(),
      facts: cleanFactsForCloud(localProfile.facts || {}),
      consent: localProfile.consent === true,
      created_at: localProfile.createdAt || now,
      updated_at: localProfile.updatedAt || localProfile.createdAt || now,
      owner_id: userId,
    };
  }

  /**
   * Profile Cloud -> Local mapping (reverse):
   * id, name, facts, consent, created_at -> createdAt, updated_at -> updatedAt
   */
  function fromCloudProfile(cloudProfile) {
    if (!cloudProfile) return null;
    const now = new Date().toISOString();
    return {
      id: cloudProfile.id,
      name: cloudProfile.name || "",
      facts: cloudProfile.facts || {},
      consent: cloudProfile.consent !== false,
      createdAt: cloudProfile.created_at || now,
      updatedAt: cloudProfile.updated_at || cloudProfile.created_at || now,
    };
  }

  /**
   * Application Local -> Cloud mapping:
   * id, profileId -> profile_id, schemeId -> scheme_id, status, statusUpdatedAt -> status_updated_at,
   * docsDone -> docs_done, note, createdAt -> created_at, owner_id.
   * Cloud required updated_at (not null): local updatedAt if present, otherwise max(statusUpdatedAt, createdAt).
   */
  function toCloudApplication(localApp, userId) {
    if (!localApp) return null;
    const now = new Date().toISOString();
    const effectiveUpdatedAt = localApp.updatedAt || getLatestTimestamp(localApp.statusUpdatedAt, localApp.createdAt, now);

    return {
      id: localApp.id,
      profile_id: localApp.profileId,
      scheme_id: localApp.schemeId,
      status: localApp.status || "Saved",
      status_updated_at: localApp.statusUpdatedAt || effectiveUpdatedAt,
      docs_done: Array.isArray(localApp.docsDone)
        ? localApp.docsDone.map((n) => Number(n)).filter((n) => !isNaN(n))
        : [],
      note: typeof localApp.note === "string" ? localApp.note : "",
      created_at: localApp.createdAt || effectiveUpdatedAt,
      updated_at: effectiveUpdatedAt,
      owner_id: userId,
    };
  }

  /**
   * Application Cloud -> Local mapping (reverse):
   * id, profile_id -> profileId, scheme_id -> schemeId, status, status_updated_at -> statusUpdatedAt,
   * docs_done -> docsDone, note, created_at -> createdAt, updated_at -> updatedAt
   */
  function fromCloudApplication(cloudApp) {
    if (!cloudApp) return null;
    const now = new Date().toISOString();
    return {
      id: cloudApp.id,
      profileId: cloudApp.profile_id,
      schemeId: cloudApp.scheme_id,
      status: cloudApp.status || "Saved",
      statusUpdatedAt: cloudApp.status_updated_at || cloudApp.updated_at || now,
      docsDone: Array.isArray(cloudApp.docs_done)
        ? cloudApp.docs_done.map((n) => Number(n)).filter((n) => !isNaN(n))
        : [],
      note: cloudApp.note || "",
      createdAt: cloudApp.created_at || now,
      updatedAt: cloudApp.updated_at || cloudApp.status_updated_at || now,
    };
  }

  /**
   * Deduplicates applications locally by (profileId, schemeId),
   * keeping the one with the latest updated time.
   */
  function dedupeApplicationsForCloud(applications) {
    if (!Array.isArray(applications)) return [];
    const map = new Map();

    for (const app of applications) {
      if (!app || !app.profileId || !app.schemeId) continue;
      const key = `${app.profileId}::${app.schemeId}`;
      const appTime = new Date(app.updatedAt || app.statusUpdatedAt || app.createdAt || 0).getTime();

      if (!map.has(key)) {
        map.set(key, app);
      } else {
        const existing = map.get(key);
        const existingTime = new Date(existing.updatedAt || existing.statusUpdatedAt || existing.createdAt || 0).getTime();
        if (appTime > existingTime) {
          map.set(key, app);
        }
      }
    }

    return Array.from(map.values());
  }

  /**
   * Deletes a profile in the cloud (cascade removes associated applications in PostgreSQL).
   */
  async function deleteProfileCloud(profileId) {
    const client = getClient();
    if (!client || !profileId) return { error: null };
    if (!isOnline()) return { error: new Error("Offline"), isOffline: true };

    try {
      const { error } = await client
        .from("profiles")
        .delete()
        .eq("id", profileId);
      if (error) return { error };
      return { error: null };
    } catch (err) {
      return { error: err, isOffline: !isOnline() };
    }
  }

  /**
   * Flushes queued profile deletes to the cloud in batches of 100.
   */
  async function flushPendingDeletes(pendingIds) {
    const client = getClient();
    if (!pendingIds || pendingIds.length === 0) {
      return { deleted: [], failed: [] };
    }
    if (!client || !isOnline()) {
      return { deleted: [], failed: [...pendingIds], isOffline: true };
    }

    const deleted = [];
    const failed = [];
    for (let i = 0; i < pendingIds.length; i += 100) {
      const batch = pendingIds.slice(i, i + 100);
      try {
        const { error } = await client
          .from("profiles")
          .delete()
          .in("id", batch);
        if (error) {
          failed.push(...batch);
        } else {
          deleted.push(...batch);
        }
      } catch (err) {
        failed.push(...batch);
      }
    }
    return { deleted, failed };
  }

  /**
   * Back up profiles and applications to the cloud:
   * 1. Flushes pending_cloud_deletes first.
   * 2. Upserts profiles in batches of 100.
   * 3. Dedupes applications by (profileId, schemeId) keeping latest.
   * 4. Upserts applications in batches of 100.
   * Reports honest counts and errors.
   */
  async function backupToCloud({ profiles, applications, userId, pendingDeletes }) {
    const client = getClient();
    if (!client) {
      return { success: false, friendlyCode: "not_configured", error: new Error("Cloud not configured.") };
    }
    if (!isOnline()) {
      return { success: false, friendlyCode: "offline", isOffline: true, error: new Error("Offline") };
    }
    if (!userId) {
      return { success: false, friendlyCode: "no_user", error: new Error("User ID is required for backup.") };
    }

    // 1. Flush pending deletes first
    let flushedDeletes = [];
    let deleteFailures = [];
    if (pendingDeletes && pendingDeletes.length > 0) {
      const flushRes = await flushPendingDeletes(pendingDeletes);
      flushedDeletes = flushRes.deleted;
      deleteFailures = flushRes.failed;
    }

    // 2. Prepare profiles and batch in 100s
    const cloudProfiles = (profiles || []).map((p) => toCloudProfile(p, userId)).filter(Boolean);
    let profilesBackedUp = 0;
    let profilesFailed = 0;
    const errors = [];

    for (let i = 0; i < cloudProfiles.length; i += 100) {
      const batch = cloudProfiles.slice(i, i + 100);
      try {
        const { error } = await client
          .from("profiles")
          .upsert(batch, { onConflict: "id" });
        if (error) {
          profilesFailed += batch.length;
          errors.push(error);
        } else {
          profilesBackedUp += batch.length;
        }
      } catch (err) {
        profilesFailed += batch.length;
        errors.push(err);
      }
    }

    // 3. Prepare applications: dedupe locally by (profileId, schemeId) first, then batch in 100s
    const dedupedApps = dedupeApplicationsForCloud(applications || []);
    const cloudApps = dedupedApps.map((a) => toCloudApplication(a, userId)).filter(Boolean);
    let appsBackedUp = 0;
    let appsFailed = 0;

    for (let i = 0; i < cloudApps.length; i += 100) {
      const batch = cloudApps.slice(i, i + 100);
      try {
        const { error } = await client
          .from("applications")
          .upsert(batch, { onConflict: "id" });
        if (error) {
          appsFailed += batch.length;
          errors.push(error);
        } else {
          appsBackedUp += batch.length;
        }
      } catch (err) {
        appsFailed += batch.length;
        errors.push(err);
      }
    }

    const success = profilesFailed === 0 && appsFailed === 0 && deleteFailures.length === 0;
    return {
      success,
      profilesBackedUp,
      profilesFailed,
      appsBackedUp,
      appsFailed,
      flushedDeletes,
      deleteFailures,
      errors,
    };
  }

  /**
   * Restores from cloud: selects only this Helper's cloud rows.
   */
  async function restoreFromCloud(userId) {
    const client = getClient();
    if (!client) {
      return { data: null, error: new Error("Cloud not configured."), friendlyCode: "not_configured" };
    }
    if (!isOnline()) {
      return { data: null, error: new Error("Offline"), isOffline: true, friendlyCode: "offline" };
    }
    if (!userId) {
      return { data: null, error: new Error("User ID is required."), friendlyCode: "no_user" };
    }

    try {
      // 1. Fetch profiles
      const { data: profiles, error: pErr } = await client
        .from("profiles")
        .select("id, name, facts, consent, created_at, updated_at")
        .eq("owner_id", userId);

      if (pErr) return { data: null, error: pErr, friendlyCode: "fetch_error" };

      // 2. Fetch applications
      const { data: applications, error: aErr } = await client
        .from("applications")
        .select("id, profile_id, scheme_id, status, status_updated_at, docs_done, note, created_at, updated_at")
        .eq("owner_id", userId);

      if (aErr) return { data: null, error: aErr, friendlyCode: "fetch_error" };

      return {
        data: {
          profiles: profiles || [],
          applications: applications || [],
        },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err,
        isOffline: !isOnline(),
        friendlyCode: !isOnline() ? "offline" : "generic_error",
      };
    }
  }

  /**
   * Deterministic Restore Merge Algorithm:
   * - Profiles: rows missing locally are added; existing profiles keep later updated_at.
   * - Applications: matched by id first, then by (profileId, schemeId).
   *   If same pair exists under different id, keep later-updated and rewrite local record to use cloud id.
   * - Never deletes local rows.
   * - Never re-adds any id listed in pending_cloud_deletes.
   */
  function mergeRestoreData({ cloudProfiles, cloudApps, localProfiles, localApps, pendingDeletes }) {
    const pendingSet = new Set(pendingDeletes || []);
    const localProfMap = new Map((localProfiles || []).map((p) => [p.id, p]));

    const profilesToAdd = [];
    const profilesToUpdate = [];
    let profilesKept = 0;
    const handledLocalProfIds = new Set();

    for (const cp of cloudProfiles || []) {
      if (pendingSet.has(cp.id)) {
        continue;
      }
      const converted = fromCloudProfile(cp);
      const local = localProfMap.get(cp.id);

      if (!local) {
        profilesToAdd.push(converted);
      } else {
        handledLocalProfIds.add(local.id);
        const cloudTime = new Date(converted.updatedAt || converted.createdAt || 0).getTime();
        const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime();
        if (cloudTime > localTime) {
          profilesToUpdate.push(converted);
        } else {
          profilesKept++;
        }
      }
    }

    // Local profiles not touched by cloud are kept as is
    for (const lp of localProfiles || []) {
      if (!handledLocalProfIds.has(lp.id)) {
        profilesKept++;
      }
    }

    // Applications merge
    const localAppIdMap = new Map((localApps || []).map((a) => [a.id, a]));
    const localAppPairMap = new Map((localApps || []).map((a) => [`${a.profileId}::${a.schemeId}`, a]));

    const appsToAdd = [];
    const appsToUpdate = [];
    const appsToDelete = [];
    let appsKept = 0;
    const handledLocalAppIds = new Set();

    for (const ca of cloudApps || []) {
      if (pendingSet.has(ca.profile_id)) {
        continue;
      }

      const conv = fromCloudApplication(ca);
      const pairKey = `${conv.profileId}::${conv.schemeId}`;

      let match = localAppIdMap.get(conv.id) || null;
      if (!match) {
        match = localAppPairMap.get(pairKey) || null;
      }

      if (!match) {
        appsToAdd.push(conv);
      } else {
        handledLocalAppIds.add(match.id);
        const cloudTime = new Date(conv.updatedAt || conv.statusUpdatedAt || conv.createdAt || 0).getTime();
        const localTime = new Date(match.updatedAt || match.statusUpdatedAt || match.createdAt || 0).getTime();

        if (match.id !== conv.id) {
          appsToDelete.push(match.id);
          if (cloudTime > localTime) {
            appsToUpdate.push(conv);
          } else {
            const aligned = Object.assign({}, match, { id: conv.id });
            appsToUpdate.push(aligned);
          }
        } else {
          if (cloudTime > localTime) {
            appsToUpdate.push(conv);
          } else {
            appsKept++;
          }
        }
      }
    }

    for (const la of localApps || []) {
      if (!handledLocalAppIds.has(la.id)) {
        appsKept++;
      }
    }

    return {
      profilesToAdd,
      profilesToUpdate,
      profilesKept,
      profilesAdded: profilesToAdd.length,
      profilesUpdated: profilesToUpdate.length,
      appsToAdd,
      appsToUpdate,
      appsToDelete,
      appsKept,
      appsAdded: appsToAdd.length,
      appsUpdated: appsToUpdate.length,
    };
  }

  /**
   * Counts how many local profiles have not been backed up (newer than last_backup_at).
   */
  function getUnbackedUpProfilesCount({ profiles, applications, lastBackupAt }) {
    if (!profiles || profiles.length === 0) return 0;
    if (!lastBackupAt) return profiles.length;

    const backupTime = new Date(lastBackupAt).getTime();
    if (isNaN(backupTime)) return profiles.length;

    const appMaxMap = new Map();
    for (const a of applications || []) {
      const aTime = new Date(a.updatedAt || a.statusUpdatedAt || a.createdAt || 0).getTime();
      const cur = appMaxMap.get(a.profileId) || 0;
      if (aTime > cur) appMaxMap.set(a.profileId, aTime);
    }

    let unbacked = 0;
    for (const p of profiles) {
      const pTime = new Date(p.updatedAt || p.createdAt || 0).getTime();
      const aTime = appMaxMap.get(p.id) || 0;
      if (pTime > backupTime || aTime > backupTime) {
        unbacked++;
      }
    }

    return unbacked;
  }

  /**
   * Expose public GovCloud API on window
   */
  window.GovCloud = {
    init,
    isConfigured,
    isOnline,
    mapAuthError,
    signUp,
    signIn,
    signOut,
    getSession,
    getUser,
    onAuthChange,
    getCloudHelper,
    saveCloudHelper,
    // Stage 8a Part 2 APIs
    toCloudProfile,
    fromCloudProfile,
    toCloudApplication,
    fromCloudApplication,
    cleanFactsForCloud,
    dedupeApplicationsForCloud,
    deleteProfileCloud,
    flushPendingDeletes,
    backupToCloud,
    restoreFromCloud,
    mergeRestoreData,
    getUnbackedUpProfilesCount,
    __setClientForTesting,
  };

  // Auto-init on script evaluation
  init();
})(window);

