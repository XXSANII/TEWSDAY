-- Local development ONLY. Run as the schema owner after all migrations.
-- Production credentials and grants must be provisioned through your secret manager.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tewsday_app') THEN
    CREATE ROLE tewsday_app LOGIN PASSWORD 'local_app_only';
  END IF;
END $$;
GRANT CONNECT ON DATABASE tewsday TO tewsday_app;
GRANT USAGE ON SCHEMA public TO tewsday_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO tewsday_app;
REVOKE ALL ON entity_audit_logs, user_activity_logs, _prisma_migrations, spatial_ref_sys FROM tewsday_app;
GRANT SELECT ON spatial_ref_sys TO tewsday_app;
GRANT SELECT ON entity_audit_logs TO tewsday_app;
GRANT SELECT, INSERT ON user_activity_logs TO tewsday_app;
