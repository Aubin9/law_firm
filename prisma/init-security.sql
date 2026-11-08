-- =============================================================================
-- Migration: Extensions and Security Hardening
-- =============================================================================

-- 1. Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- 2. Trigram index on Party.displayName for fast duplicate detection & conflict search
CREATE INDEX IF NOT EXISTS "Party_displayName_trgm_idx"
  ON "Party" USING gin ("displayName" gin_trgm_ops);

-- 3. Append-only enforcement: Revoke UPDATE and DELETE on AuditLog and StatusChange
DO $$
BEGIN
  -- Revoke for PUBLIC
  EXECUTE 'REVOKE UPDATE, DELETE ON TABLE "AuditLog" FROM PUBLIC';
  EXECUTE 'REVOKE UPDATE, DELETE ON TABLE "StatusChange" FROM PUBLIC';
  
  -- Revoke specifically for lawfirm role if present
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'lawfirm') THEN
    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE "AuditLog" FROM lawfirm';
    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE "StatusChange" FROM lawfirm';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- If tables are not yet created, this will run after table migration
    NULL;
END
$$;

