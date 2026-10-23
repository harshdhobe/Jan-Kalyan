/**
 * config.example.js
 * -----------------
 * Copy these placeholder values into config.js after creating the Supabase project.
 *
 * Use the anon / publishable key only. That key is public by design and is safe
 * only because Row Level Security on helpers, profiles, and applications denies
 * every request that is not the signed-in Helper's own rows.
 *
 * Never put a service_role key or a key that starts with sb_secret_ in this file.
 * Phone OTP, Google sign-in, and forgot-password are deferred (Stage 8a known gaps).
 */
(function (window) {
  "use strict";

  window.SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
  window.SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
})(window);
