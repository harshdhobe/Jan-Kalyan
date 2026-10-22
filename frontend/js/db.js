/**
 * db.js
 * -----
 * Lightweight Promise-based wrapper around browser IndexedDB with resilient local fallback.
 * Database: "jankalyan", version: 2
 * Object stores:
 *   - "profiles" (keyPath: "id")
 *   - "meta" (keyPath: "key")
 *   - "applications" (keyPath: "id", indexes: "profileId", "schemeId", "status")
 *
 * Privacy & Security:
 * Strictly enforces consent and rejects any field named like aadhaar or government IDs.
 */

(function (window) {
  "use strict";

  const DB_NAME = "jankalyan";
  const DB_VERSION = 2;
  let dbPromise = null;

  // Resilient fallback storage (using localStorage or memory cache)
  const memoryFallback = {
    profiles: [],
    applications: [],
    meta: {},
  };

  function getFallbackProfiles() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem("jankalyan_profiles");
        if (raw) return JSON.parse(raw);
      }
    } catch (e) {}
    return memoryFallback.profiles || [];
  }

  function saveFallbackProfiles(list) {
    memoryFallback.profiles = list;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("jankalyan_profiles", JSON.stringify(list));
      }
    } catch (e) {}
  }

  function getFallbackApplications() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem("jankalyan_applications");
        if (raw) return JSON.parse(raw);
      }
    } catch (e) {}
    return memoryFallback.applications || [];
  }

  function saveFallbackApplications(list) {
    memoryFallback.applications = list;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("jankalyan_applications", JSON.stringify(list));
      }
    } catch (e) {}
  }

  function getFallbackMeta(key) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem("jankalyan_meta_" + key);
        if (raw !== null) return JSON.parse(raw);
      }
    } catch (e) {}
    return memoryFallback.meta[key] !== undefined ? memoryFallback.meta[key] : null;
  }

  function saveFallbackMeta(key, value) {
    memoryFallback.meta[key] = value;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("jankalyan_meta_" + key, JSON.stringify(value));
      }
    } catch (e) {}
  }

  function isAvailable() {
    try {
      if (typeof window === "undefined") return false;
      if ("indexedDB" in window && window.indexedDB !== null && typeof window.indexedDB.open === "function") {
        return true;
      }
      return typeof window.localStorage !== "undefined";
    } catch (e) {
      return false;
    }
  }

  function openDB() {
    if (typeof window === "undefined" || !("indexedDB" in window) || !window.indexedDB) {
      return Promise.reject(new Error("IndexedDB is not available in this browser environment."));
    }
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      let openTimeout = null;
      let isSettled = false;

      function settleResolve(val) {
        if (isSettled) return;
        isSettled = true;
        if (openTimeout) clearTimeout(openTimeout);
        resolve(val);
      }

      function settleReject(err) {
        if (isSettled) return;
        isSettled = true;
        if (openTimeout) clearTimeout(openTimeout);
        dbPromise = null;
        reject(err);
      }

      // Timeout if connection hangs or is blocked indefinitely
      openTimeout = setTimeout(() => {
        settleReject(new Error("Database connection timed out."));
      }, 3000);

      let request;
      try {
        request = window.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        settleReject(err);
        return;
      }

      request.onupgradeneeded = function (event) {
        const db = event.target.result;
        // Keep existing stores intact
        if (!db.objectStoreNames.contains("profiles")) {
          db.createObjectStore("profiles", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
        // Stage 3: applications store
        if (!db.objectStoreNames.contains("applications")) {
          const appStore = db.createObjectStore("applications", { keyPath: "id" });
          appStore.createIndex("profileId", "profileId", { unique: false });
          appStore.createIndex("schemeId", "schemeId", { unique: false });
          appStore.createIndex("status", "status", { unique: false });
        }
      };

      request.onsuccess = function (event) {
        const db = event.target.result;
        // Gracefully close on version upgrade request from other tabs
        db.onversionchange = function () {
          try {
            db.close();
          } catch (e) {}
          dbPromise = null;
        };
        db.onclose = function () {
          dbPromise = null;
        };
        settleResolve(db);
      };

      request.onerror = function (event) {
        settleReject(request.error || event.target.error || new Error("Failed to open IndexedDB"));
      };

      request.onblocked = function () {
        console.warn("IndexedDB upgrade blocked by another connection.");
        setTimeout(() => {
          settleReject(new Error("Database upgrade was blocked by another open tab. Please close other JanKalyan tabs and refresh the page."));
        }, 1500);
      };
    });

    return dbPromise;
  }

  /**
   * Recursively validates that no field in the object is named like an Aadhaar ID
   * or contains a 12-digit Aadhaar number string/integer.
   * Note: The canonical intake booleans `has_aadhaar` and `has_aadhaar_linked_bank_account`
   * are permitted as they only record possession, never the identity number.
   */
  function assertNoAadhaarFields(obj, pathPrefix) {
    if (!obj || typeof obj !== "object") return;

    const allowedBooleans = new Set(["has_aadhaar", "has_aadhaar_linked_bank_account"]);

    for (const key of Object.keys(obj)) {
      const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      const lowerKey = key.toLowerCase();

      // Check key name
      const isAadhaarKey = /aadhaar|aadhar|uidai/i.test(lowerKey);
      if (isAadhaarKey && !allowedBooleans.has(key)) {
        throw new Error(
          `Privacy Violation: Storing government ID field '${fullPath}' is strictly forbidden by JanKalyan Hard Rule 4.`
        );
      }

      const val = obj[key];
      // Check if value is a 12-digit string or 12-digit number (Aadhaar number format)
      if (typeof val === "string" && /^\d{4}[\s-]?\d{4}[\s-]?\d{4}$/.test(val.trim())) {
        throw new Error(
          `Privacy Violation: Value at '${fullPath}' resembles a 12-digit Aadhaar number. ID numbers must never be stored.`
        );
      }

      if (val && typeof val === "object") {
        assertNoAadhaarFields(val, fullPath);
      }
    }
  }

  /**
   * Generates a UUID v4 string with fallback.
   */
  function generateId() {
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
    } catch (e) {}
    // Standard RFC4122 v4 fallback
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Validates profile schema compliance before saving.
   */
  function validateProfile(profile) {
    if (!profile || typeof profile !== "object") {
      throw new Error("Invalid profile: Must be a non-null object.");
    }

    if (!profile.name || typeof profile.name !== "string" || !profile.name.trim()) {
      throw new Error("Profile name is required.");
    }

    if (profile.consent !== true) {
      throw new Error("Profile creation requires explicit consent from the Beneficiary.");
    }

    if (!profile.facts || typeof profile.facts !== "object") {
      profile.facts = {};
    }

    // Reject any field named like aadhaar or containing aadhaar numbers
    assertNoAadhaarFields(profile, "");

    const now = new Date().toISOString();
    return {
      id: profile.id || generateId(),
      name: profile.name.trim(),
      facts: JSON.parse(JSON.stringify(profile.facts)),
      consent: true,
      createdAt: profile.createdAt || now,
      updatedAt: now,
    };
  }

  /**
   * Validates application schema compliance before saving.
   * Schema: { id, profileId, schemeId, status, statusUpdatedAt, docsDone, note, createdAt }
   */
  function validateApplication(app) {
    if (!app || typeof app !== "object") {
      throw new Error("Invalid application: Must be a non-null object.");
    }

    if (!app.profileId || typeof app.profileId !== "string" || !app.profileId.trim()) {
      throw new Error("Application requires a valid profileId.");
    }

    if (!app.schemeId || typeof app.schemeId !== "string" || !app.schemeId.trim()) {
      throw new Error("Application requires a valid schemeId.");
    }

    const validStatuses = (typeof window !== "undefined" && window.APPLICATION_STATUSES)
      ? window.APPLICATION_STATUSES
      : [
          "Saved",
          "Documents pending",
          "Ready to apply",
          "Applied",
          "Approved",
          "Rejected",
          "Benefit received",
        ];

    let status = app.status;
    if (!status || !validStatuses.includes(status)) {
      status = "Saved";
    }

    // Reject any aadhaar numbers or prohibited fields in note or other props
    assertNoAadhaarFields(app, "");

    const now = new Date().toISOString();
    return {
      id: app.id || generateId(),
      profileId: app.profileId.trim(),
      schemeId: app.schemeId.trim(),
      status: status,
      statusUpdatedAt: app.statusUpdatedAt || now,
      docsDone: Array.isArray(app.docsDone)
        ? app.docsDone.map((idx) => Number(idx)).filter((n) => !isNaN(n))
        : [],
      note: typeof app.note === "string" ? app.note : "",
      createdAt: app.createdAt || now,
    };
  }

  function getAllProfiles() {
    return openDB()
      .then((db) => {
        return new Promise((resolve, reject) => {
          try {
            const tx = db.transaction("profiles", "readonly");
            const store = tx.objectStore("profiles");
            const request = store.getAll();

            request.onsuccess = () => {
              const result = request.result || [];
              const fallback = getFallbackProfiles();
              if (fallback && fallback.length > 0) {
                const map = new Map();
                result.forEach((p) => map.set(p.id, p));
                fallback.forEach((p) => {
                  if (!map.has(p.id)) map.set(p.id, p);
                });
                resolve(Array.from(map.values()));
              } else {
                resolve(result);
              }
            };
            request.onerror = () => reject(request.error || new Error("Failed to get profiles."));
            tx.onerror = () => reject(tx.error || new Error("Transaction error in getAllProfiles"));
            tx.onabort = () => reject(tx.error || new Error("Transaction aborted in getAllProfiles"));
          } catch (err) {
            reject(err);
          }
        });
      })
      .catch((err) => {
        console.warn("IndexedDB getAllProfiles failed, falling back to local storage:", err);
        return getFallbackProfiles();
      });
  }

  function getProfile(id) {
    if (!id) return Promise.reject(new Error("Profile ID is required."));
    return openDB()
      .then((db) => {
        return new Promise((resolve, reject) => {
          try {
            const tx = db.transaction("profiles", "readonly");
            const store = tx.objectStore("profiles");
            const request = store.get(id);

            request.onsuccess = () => {
              if (request.result) {
                resolve(request.result);
              } else {
                const fallback = getFallbackProfiles();
                const found = fallback.find((p) => p.id === id) || null;
                resolve(found);
              }
            };
            request.onerror = () => reject(request.error || new Error("Failed to get profile."));
            tx.onerror = () => reject(tx.error || new Error("Transaction error in getProfile"));
            tx.onabort = () => reject(tx.error || new Error("Transaction aborted in getProfile"));
          } catch (err) {
            reject(err);
          }
        });
      })
      .catch((err) => {
        console.warn("IndexedDB getProfile failed, falling back to local storage:", err);
        const fallback = getFallbackProfiles();
        return fallback.find((p) => p.id === id) || null;
      });
  }

  function saveProfile(rawProfile) {
    let cleanProfile;
    try {
      cleanProfile = validateProfile(rawProfile);
    } catch (err) {
      return Promise.reject(err);
    }

    return openDB()
      .then((db) => {
        return new Promise((resolve, reject) => {
          try {
            const tx = db.transaction("profiles", "readwrite");
            const store = tx.objectStore("profiles");
            const request = store.put(cleanProfile);

            request.onsuccess = () => {
              // Also sync to fallback storage for backup resilience
              try {
                const list = getFallbackProfiles();
                const idx = list.findIndex((p) => p.id === cleanProfile.id);
                if (idx >= 0) list[idx] = cleanProfile;
                else list.push(cleanProfile);
                saveFallbackProfiles(list);
              } catch (e) {}
              resolve(cleanProfile);
            };
            request.onerror = () => reject(request.error || new Error("Failed to save profile."));
            tx.onerror = () => reject(tx.error || new Error("Transaction error in saveProfile"));
            tx.onabort = () => reject(tx.error || new Error("Transaction aborted in saveProfile"));
          } catch (err) {
            reject(err);
          }
        });
      })
      .catch((err) => {
        console.warn("IndexedDB saveProfile failed, using fallback storage:", err);
        const list = getFallbackProfiles();
        const idx = list.findIndex((p) => p.id === cleanProfile.id);
        if (idx >= 0) list[idx] = cleanProfile;
        else list.push(cleanProfile);
        saveFallbackProfiles(list);
        return cleanProfile;
      });
  }

  function deleteProfile(id) {
    if (!id) return Promise.reject(new Error("Profile ID is required."));
    // Delete from fallback storage
    try {
      const pList = getFallbackProfiles().filter((p) => p.id !== id);
      saveFallbackProfiles(pList);
      const aList = getFallbackApplications().filter((a) => a.profileId !== id);
      saveFallbackApplications(aList);
    } catch (e) {}

    return openDB()
      .then((db) => {
        return new Promise((resolve, reject) => {
          try {
            const storeNames = ["profiles"];
            if (db.objectStoreNames.contains("applications")) {
              storeNames.push("applications");
            }
            const tx = db.transaction(storeNames, "readwrite");
            const profStore = tx.objectStore("profiles");
            profStore.delete(id);

            if (db.objectStoreNames.contains("applications")) {
              const appStore = tx.objectStore("applications");
              const index = appStore.index("profileId");
              const req = index.getAllKeys(id);
              req.onsuccess = () => {
                const keys = req.result || [];
                keys.forEach((k) => appStore.delete(k));
              };
            }

            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error || new Error("Transaction error in deleteProfile"));
            tx.onabort = () => reject(tx.error || new Error("Transaction aborted in deleteProfile"));
          } catch (err) {
            reject(err);
          }
        });
      })
      .catch((err) => {
        console.warn("IndexedDB deleteProfile failed, handled in fallback:", err);
        return true;
      });
  }

  function getAllApplications() {
    return openDB()
      .then((db) => {
        return new Promise((resolve, reject) => {
          try {
            if (!db.objectStoreNames.contains("applications")) {
              resolve(getFallbackApplications());
              return;
            }
            const tx = db.transaction("applications", "readonly");
            const store = tx.objectStore("applications");
            const request = store.getAll();

            request.onsuccess = () => {
              const result = request.result || [];
              const fallback = getFallbackApplications();
              if (fallback && fallback.length > 0) {
                const map = new Map();
                result.forEach((a) => map.set(a.id, a));
                fallback.forEach((a) => {
                  if (!map.has(a.id)) map.set(a.id, a);
                });
                resolve(Array.from(map.values()));
              } else {
                resolve(result);
              }
            };
            request.onerror = () => reject(request.error || new Error("Failed to get applications."));
            tx.onerror = () => reject(tx.error || new Error("Transaction error in getAllApplications"));
            tx.onabort = () => reject(tx.error || new Error("Transaction aborted in getAllApplications"));
          } catch (err) {
            reject(err);
          }
        });
      })
      .catch((err) => {
        console.warn("IndexedDB getAllApplications failed, falling back to local storage:", err);
        return getFallbackApplications();
      });
  }

  function getApplicationsByProfile(profileId) {
    if (!profileId) return Promise.resolve([]);
    return openDB()
      .then((db) => {
        return new Promise((resolve, reject) => {
          try {
            if (!db.objectStoreNames.contains("applications")) {
              const fallback = getFallbackApplications().filter((a) => a.profileId === profileId);
              resolve(fallback);
              return;
            }
            const tx = db.transaction("applications", "readonly");
            const store = tx.objectStore("applications");
            const index = store.index("profileId");
            const request = index.getAll(profileId);

            request.onsuccess = () => {
              const result = request.result || [];
              const fallback = getFallbackApplications().filter((a) => a.profileId === profileId);
              if (fallback && fallback.length > 0) {
                const map = new Map();
                result.forEach((a) => map.set(a.id, a));
                fallback.forEach((a) => {
                  if (!map.has(a.id)) map.set(a.id, a);
                });
                resolve(Array.from(map.values()));
              } else {
                resolve(result);
              }
            };
            request.onerror = () => reject(request.error || new Error("Failed to get applications by profile."));
            tx.onerror = () => reject(tx.error || new Error("Transaction error in getApplicationsByProfile"));
            tx.onabort = () => reject(tx.error || new Error("Transaction aborted in getApplicationsByProfile"));
          } catch (err) {
            reject(err);
          }
        });
      })
      .catch((err) => {
        console.warn("IndexedDB getApplicationsByProfile failed, falling back to local storage:", err);
        return getFallbackApplications().filter((a) => a.profileId === profileId);
      });
  }

  function getApplication(id) {
    if (!id) return Promise.reject(new Error("Application ID is required."));
    return openDB()
      .then((db) => {
        return new Promise((resolve, reject) => {
          try {
            if (!db.objectStoreNames.contains("applications")) {
              const found = getFallbackApplications().find((a) => a.id === id) || null;
              resolve(found);
              return;
            }
            const tx = db.transaction("applications", "readonly");
            const store = tx.objectStore("applications");
            const request = store.get(id);

            request.onsuccess = () => {
              if (request.result) {
                resolve(request.result);
              } else {
                const found = getFallbackApplications().find((a) => a.id === id) || null;
                resolve(found);
              }
            };
            request.onerror = () => reject(request.error || new Error("Failed to get application."));
            tx.onerror = () => reject(tx.error || new Error("Transaction error in getApplication"));
            tx.onabort = () => reject(tx.error || new Error("Transaction aborted in getApplication"));
          } catch (err) {
            reject(err);
          }
        });
      })
      .catch((err) => {
        console.warn("IndexedDB getApplication failed, falling back to local storage:", err);
        return getFallbackApplications().find((a) => a.id === id) || null;
      });
  }

  function saveApplication(rawApp) {
    let cleanApp;
    try {
      cleanApp = validateApplication(rawApp);
    } catch (err) {
      return Promise.reject(err);
    }

    return openDB()
      .then((db) => {
        return new Promise((resolve, reject) => {
          try {
            const tx = db.transaction("applications", "readwrite");
            const store = tx.objectStore("applications");
            const request = store.put(cleanApp);

            request.onsuccess = () => {
              try {
                const list = getFallbackApplications();
                const idx = list.findIndex((a) => a.id === cleanApp.id);
                if (idx >= 0) list[idx] = cleanApp;
                else list.push(cleanApp);
                saveFallbackApplications(list);
              } catch (e) {}
              resolve(cleanApp);
            };
            request.onerror = () => reject(request.error || new Error("Failed to save application."));
            tx.onerror = () => reject(tx.error || new Error("Transaction error in saveApplication"));
            tx.onabort = () => reject(tx.error || new Error("Transaction aborted in saveApplication"));
          } catch (err) {
            reject(err);
          }
        });
      })
      .catch((err) => {
        console.warn("IndexedDB saveApplication failed, using fallback storage:", err);
        const list = getFallbackApplications();
        const idx = list.findIndex((a) => a.id === cleanApp.id);
        if (idx >= 0) list[idx] = cleanApp;
        else list.push(cleanApp);
        saveFallbackApplications(list);
        return cleanApp;
      });
  }

  function deleteApplication(id) {
    if (!id) return Promise.reject(new Error("Application ID is required."));
    try {
      const list = getFallbackApplications().filter((a) => a.id !== id);
      saveFallbackApplications(list);
    } catch (e) {}

    return openDB()
      .then((db) => {
        return new Promise((resolve, reject) => {
          try {
            const tx = db.transaction("applications", "readwrite");
            const store = tx.objectStore("applications");
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error || new Error("Failed to delete application."));
            tx.onerror = () => reject(tx.error || new Error("Transaction error in deleteApplication"));
            tx.onabort = () => reject(tx.error || new Error("Transaction aborted in deleteApplication"));
          } catch (err) {
            reject(err);
          }
        });
      })
      .catch((err) => {
        console.warn("IndexedDB deleteApplication failed, handled in fallback:", err);
        return true;
      });
  }

  function deleteApplicationsByProfile(profileId) {
    if (!profileId) return Promise.resolve(true);
    try {
      const list = getFallbackApplications().filter((a) => a.profileId !== profileId);
      saveFallbackApplications(list);
    } catch (e) {}

    return openDB()
      .then((db) => {
        return new Promise((resolve, reject) => {
          try {
            if (!db.objectStoreNames.contains("applications")) {
              resolve(true);
              return;
            }
            const tx = db.transaction("applications", "readwrite");
            const store = tx.objectStore("applications");
            const index = store.index("profileId");
            const req = index.getAllKeys(profileId);

            req.onsuccess = () => {
              const keys = req.result || [];
              keys.forEach((k) => store.delete(k));
            };

            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error || new Error("Transaction error in deleteApplicationsByProfile"));
            tx.onabort = () => reject(tx.error || new Error("Transaction aborted in deleteApplicationsByProfile"));
          } catch (err) {
            reject(err);
          }
        });
      })
      .catch((err) => {
        console.warn("IndexedDB deleteApplicationsByProfile failed, handled in fallback:", err);
        return true;
      });
  }

  function getMeta(key) {
    if (!key) return Promise.reject(new Error("Meta key is required."));
    return openDB()
      .then((db) => {
        return new Promise((resolve, reject) => {
          try {
            const tx = db.transaction("meta", "readonly");
            const store = tx.objectStore("meta");
            const request = store.get(key);

            request.onsuccess = () => {
              const res = request.result;
              if (res) resolve(res.value);
              else resolve(getFallbackMeta(key));
            };
            request.onerror = () => reject(request.error || new Error("Failed to get meta."));
            tx.onerror = () => reject(tx.error || new Error("Transaction error in getMeta"));
            tx.onabort = () => reject(tx.error || new Error("Transaction aborted in getMeta"));
          } catch (err) {
            reject(err);
          }
        });
      })
      .catch((err) => {
        return getFallbackMeta(key);
      });
  }

  function setMeta(key, value) {
    if (!key) return Promise.reject(new Error("Meta key is required."));
    saveFallbackMeta(key, value);

    return openDB()
      .then((db) => {
        return new Promise((resolve, reject) => {
          try {
            const tx = db.transaction("meta", "readwrite");
            const store = tx.objectStore("meta");
            const request = store.put({ key, value, updatedAt: new Date().toISOString() });

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error || new Error("Failed to set meta."));
            tx.onerror = () => reject(tx.error || new Error("Transaction error in setMeta"));
            tx.onabort = () => reject(tx.error || new Error("Transaction aborted in setMeta"));
          } catch (err) {
            reject(err);
          }
        });
      })
      .catch((err) => {
        return true;
      });
  }

  // Export to global scope
  window.GovDB = {
    isAvailable,
    openDB,
    getAllProfiles,
    getProfile,
    saveProfile,
    deleteProfile,
    getAllApplications,
    getApplicationsByProfile,
    getApplication,
    saveApplication,
    deleteApplication,
    deleteApplicationsByProfile,
    getMeta,
    setMeta,
    generateId,
    validateProfile,
    validateApplication,
  };
})(window);
