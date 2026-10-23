-- Stage 8a: Helper login and cloud backup (Supabase)
-- Apply in the Supabase SQL editor. Idempotent: safe to re-run.
-- RLS: authenticated Helpers only. The anon role has no table grants.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.helpers (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  helper_type text NOT NULL CHECK (
    helper_type IN ('ASHA', 'Anganwadi', 'Panchayat staff', 'CSC operator', 'Other')
  ),
  district text NOT NULL,
  language text NOT NULL CHECK (language IN ('en', 'hi', 'mr')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent boolean NOT NULL CHECK (consent = true),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  scheme_id text NOT NULL,
  status text NOT NULL CHECK (
    status IN (
      'Saved',
      'Documents pending',
      'Ready to apply',
      'Applied',
      'Approved',
      'Rejected',
      'Benefit received'
    )
  ),
  status_updated_at timestamptz NOT NULL,
  docs_done jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (profile_id, scheme_id)
);

CREATE INDEX IF NOT EXISTS profiles_owner_id_idx ON public.profiles (owner_id);
CREATE INDEX IF NOT EXISTS applications_owner_id_idx ON public.applications (owner_id);
CREATE INDEX IF NOT EXISTS applications_profile_id_idx ON public.applications (profile_id);

-- ---------------------------------------------------------------------------
-- Grants: authenticated only (anon reads and writes nothing)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.helpers FROM PUBLIC;
REVOKE ALL ON TABLE public.helpers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.helpers TO authenticated;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.profiles FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;

REVOKE ALL ON TABLE public.applications FROM PUBLIC;
REVOKE ALL ON TABLE public.applications FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.applications TO authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.helpers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- helpers: id = auth.uid()
DROP POLICY IF EXISTS helpers_select_own ON public.helpers;
CREATE POLICY helpers_select_own
  ON public.helpers
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS helpers_insert_own ON public.helpers;
CREATE POLICY helpers_insert_own
  ON public.helpers
  FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS helpers_update_own ON public.helpers;
CREATE POLICY helpers_update_own
  ON public.helpers
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS helpers_delete_own ON public.helpers;
CREATE POLICY helpers_delete_own
  ON public.helpers
  FOR DELETE
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- profiles: owner_id = auth.uid()
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS profiles_delete_own ON public.profiles;
CREATE POLICY profiles_delete_own
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- applications: owner_id = auth.uid(), and the profile must belong to the same owner
DROP POLICY IF EXISTS applications_select_own ON public.applications;
CREATE POLICY applications_select_own
  ON public.applications
  FOR SELECT
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS applications_insert_own ON public.applications;
CREATE POLICY applications_insert_own
  ON public.applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = profile_id
        AND p.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS applications_update_own ON public.applications;
CREATE POLICY applications_update_own
  ON public.applications
  FOR UPDATE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = profile_id
        AND p.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS applications_delete_own ON public.applications;
CREATE POLICY applications_delete_own
  ON public.applications
  FOR DELETE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));
