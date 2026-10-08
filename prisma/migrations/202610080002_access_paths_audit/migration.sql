-- Proposed non-unique TRD access paths; these are implementation additions, not V2 uniqueness claims.
CREATE INDEX users_email_lookup ON users (lower(email));
CREATE INDEX user_sessions_owner_state ON user_sessions (user_id, is_revoked, expires_at);
CREATE INDEX tutor_discovery_state ON tutor_profiles (is_active, account_status, hourly_rate);
CREATE INDEX tutor_location_meters ON tutor_profiles USING gist ((location::geography));
CREATE INDEX tutor_subject_lookup ON tutor_subjects (subject_id, tutor_id) WHERE is_active;
CREATE INDEX tutor_available_lookup ON tutor_availability (tutor_id, day_of_week, specific_date) WHERE is_active;
CREATE INDEX job_feed ON student_jobs (status, created_at DESC, id DESC) WHERE is_active;
CREATE INDEX application_lookup ON job_applications (job_id, tutor_id);
CREATE INDEX booking_job_lookup ON bookings (originating_job_id, student_id, tutor_id);
CREATE INDEX published_tutor_reviews ON reviews (tutor_id, review_type) WHERE is_active AND is_published;
CREATE INDEX profile_request_lookup ON profile_change_requests (tutor_id, request_type, status) WHERE is_active;
CREATE INDEX audit_lookup ON entity_audit_logs (table_name, record_id, created_at);

CREATE FUNCTION tewsday_audit_snapshot(data jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT data - ARRAY['password_hash', 'refresh_token_hash', 'metadata'];
$$;

CREATE FUNCTION tewsday_capture_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  old_snapshot jsonb;
  new_snapshot jsonb;
  actor varchar(36);
  record_key varchar(36);
  changes jsonb;
BEGIN
  actor := NULLIF(current_setting('app.actor_id', true), '');
  IF TG_OP <> 'INSERT' THEN old_snapshot := tewsday_audit_snapshot(to_jsonb(OLD)); END IF;
  IF TG_OP <> 'DELETE' THEN new_snapshot := tewsday_audit_snapshot(to_jsonb(NEW)); END IF;
  record_key := COALESCE(new_snapshot->>'id', old_snapshot->>'id', new_snapshot->>'tutor_id', old_snapshot->>'tutor_id');
  SELECT COALESCE(jsonb_agg(key ORDER BY key), '[]'::jsonb) INTO changes
    FROM jsonb_object_keys(COALESCE(new_snapshot, old_snapshot)) AS key
    WHERE old_snapshot->key IS DISTINCT FROM new_snapshot->key;
  INSERT INTO entity_audit_logs(id, table_name, record_id, action, old_data, new_data, changed_fields, changed_by)
    VALUES ('eal_' || replace(gen_random_uuid()::text, '-', ''), TG_TABLE_NAME, record_key,
      TG_OP::entity_audit_logs_action_enum, old_snapshot, new_snapshot, changes, actor);
  RETURN NULL;
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'user_auth_providers', 'user_sessions', 'tutor_profiles', 'student_profiles',
    'subjects', 'tutor_subjects', 'tutor_education', 'tutor_availability', 'profile_change_requests',
    'storage_files', 'student_jobs', 'job_applications', 'bookings', 'class_sessions', 'invoices',
    'conversations', 'messages', 'reviews', 'notifications', 'student_questions', 'question_answers'
  ] LOOP
    EXECUTE format('CREATE TRIGGER capture_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION tewsday_capture_audit()', table_name);
  END LOOP;
END;
$$;

CREATE FUNCTION tewsday_deny_log_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit and activity history is append-only' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER immutable_entity_audit BEFORE UPDATE OR DELETE ON entity_audit_logs
  FOR EACH ROW EXECUTE FUNCTION tewsday_deny_log_mutation();
CREATE TRIGGER immutable_user_activity BEFORE UPDATE OR DELETE ON user_activity_logs
  FOR EACH ROW EXECUTE FUNCTION tewsday_deny_log_mutation();
