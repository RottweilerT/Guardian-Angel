-- Guardian Angel — schéma CIBLE PostgreSQL 16 + PostGIS (migration initiale de référence).
-- ⚠ NON EXÉCUTÉ dans la version actuelle, qui repose sur Firestore (voir DATA_MODEL.md).
-- Données privées isolées dans le schéma "priv" (accès par propriétaire, RLS) ; données publiques dans "pub".
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE SCHEMA pub; CREATE SCHEMA priv;

CREATE TYPE rights_status AS ENUM ('PUBLIC_DOMAIN','OPEN_LICENSE_VERIFIED','PERMISSION_GRANTED','PERMISSION_REQUIRED','LEGAL_REVIEW_REQUIRED','PROHIBITED');
CREATE TYPE rite AS ENUM ('romain_actuel','missel_1962');
CREATE TYPE reliability AS ENUM ('verifie_paroisse','source_officielle','contributif_non_verifie','inconnu');

-- Sources et droits
CREATE TABLE pub.data_sources (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, url text, licence text, retrieved_at timestamptz, notes text);
CREATE TABLE pub.content_rights (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, reference text, holder text, content_type text NOT NULL,
  licence text NOT NULL, verified_on date NOT NULL, conditions text, attribution text, commercial_use boolean, status rights_status NOT NULL, proof text, ask_to text);

-- Comptes
CREATE TABLE priv.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email citext UNIQUE, display_name text, created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz);
CREATE TABLE priv.user_preferences (user_id uuid PRIMARY KEY REFERENCES priv.users ON DELETE CASCADE, rite rite NOT NULL DEFAULT 'romain_actuel',
  missal_language text NOT NULL DEFAULT 'bi', favourite_churches uuid[] NOT NULL DEFAULT '{}', consent_spiritual_at timestamptz, consent_version int);

-- Églises et paroisses
CREATE TABLE pub.parishes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, diocese text, website text, verified boolean NOT NULL DEFAULT false);
CREATE TABLE pub.churches (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), osm_ref text UNIQUE, name text, geom geography(Point,4326) NOT NULL, address text, district smallint,
  parish_id uuid REFERENCES pub.parishes ON DELETE SET NULL, website text, wheelchair text, history text, history_rights uuid REFERENCES pub.content_rights,
  source_id uuid REFERENCES pub.data_sources, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX churches_geom_idx ON pub.churches USING gist (geom);
CREATE INDEX churches_name_idx ON pub.churches USING gin (to_tsvector('french', coalesce(name,'')));
CREATE TABLE priv.parish_administrators (parish_id uuid REFERENCES pub.parishes ON DELETE CASCADE, user_id uuid REFERENCES priv.users ON DELETE CASCADE,
  verified_at timestamptz, verified_by uuid REFERENCES priv.users, PRIMARY KEY (parish_id, user_id));

-- Horaires : toujours une source, une date de vérification, une fiabilité
CREATE TABLE pub.mass_schedules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), church_id uuid NOT NULL REFERENCES pub.churches ON DELETE CASCADE, rite rite, language text,
  rrule text NOT NULL, start_time time NOT NULL, exceptions jsonb NOT NULL DEFAULT '[]', source_id uuid NOT NULL REFERENCES pub.data_sources, verified_on date NOT NULL, reliability reliability NOT NULL);
CREATE TABLE pub.mass_occurrences (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), schedule_id uuid REFERENCES pub.mass_schedules ON DELETE CASCADE, church_id uuid NOT NULL REFERENCES pub.churches ON DELETE CASCADE,
  starts_at timestamptz NOT NULL, cancelled boolean NOT NULL DEFAULT false);
CREATE INDEX mass_occ_time_idx ON pub.mass_occurrences (starts_at);
CREATE TABLE pub.confession_schedules (LIKE pub.mass_schedules INCLUDING ALL);
CREATE TABLE pub.adoration_schedules (LIKE pub.mass_schedules INCLUDING ALL);
CREATE TABLE pub.parish_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parish_id uuid NOT NULL REFERENCES pub.parishes ON DELETE CASCADE, church_id uuid REFERENCES pub.churches,
  title text NOT NULL, description text, starts_at timestamptz NOT NULL, ends_at timestamptz, published boolean NOT NULL DEFAULT false);

-- Liturgie : les deux formes sont modélisées séparément par la colonne rite
CREATE TABLE pub.liturgical_calendars (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rite rite NOT NULL, scope text NOT NULL DEFAULT 'general', UNIQUE (rite, scope));
CREATE TABLE pub.liturgical_celebrations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), calendar_id uuid NOT NULL REFERENCES pub.liturgical_calendars ON DELETE CASCADE,
  key text NOT NULL, title text NOT NULL, rank text NOT NULL, colour text NOT NULL, rule jsonb NOT NULL, UNIQUE (calendar_id, key));
CREATE TABLE pub.liturgical_texts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), celebration_id uuid REFERENCES pub.liturgical_celebrations ON DELETE CASCADE, rite rite NOT NULL,
  part text NOT NULL, language text NOT NULL, variant text, body text, rights_id uuid NOT NULL REFERENCES pub.content_rights,
  CONSTRAINT no_text_without_rights CHECK (body IS NULL OR rights_id IS NOT NULL));
-- Un texte n'est servi que si ses droits sont établis
CREATE VIEW pub.publishable_texts AS SELECT t.* FROM pub.liturgical_texts t JOIN pub.content_rights r ON r.id = t.rights_id
  WHERE r.status IN ('PUBLIC_DOMAIN','OPEN_LICENSE_VERIFIED','PERMISSION_GRANTED');

-- Journal spirituel (catégorie particulière de données : privé par défaut)
CREATE TABLE priv.personal_mass_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES priv.users ON DELETE CASCADE, church_id uuid REFERENCES pub.churches ON DELETE SET NULL,
  place text, attended_on date NOT NULL, category text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE priv.spiritual_notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES priv.users ON DELETE CASCADE, entry_id uuid REFERENCES priv.personal_mass_entries ON DELETE CASCADE,
  notes text, passages text, reflections text, intentions text, tags text[] NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE priv.homily_recordings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES priv.users ON DELETE CASCADE, entry_id uuid REFERENCES priv.personal_mass_entries ON DELETE CASCADE,
  storage_key text NOT NULL, preacher_consent boolean NOT NULL, consent_proof text, private_use_only boolean NOT NULL DEFAULT true, delete_after date NOT NULL,
  CONSTRAINT consent_required CHECK (preacher_consent));
CREATE TABLE priv.homily_transcripts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recording_id uuid NOT NULL REFERENCES priv.homily_recordings ON DELETE CASCADE, body text NOT NULL, engine text NOT NULL, automatic boolean NOT NULL DEFAULT true);
CREATE TABLE priv.homily_summaries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), transcript_id uuid NOT NULL REFERENCES priv.homily_transcripts ON DELETE CASCADE, body text NOT NULL, ai_generated boolean NOT NULL DEFAULT true, reviewed_by_user boolean NOT NULL DEFAULT false);

-- Paroisses : projets et bénévolat
CREATE TABLE pub.parish_projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parish_id uuid NOT NULL REFERENCES pub.parishes ON DELETE CASCADE, title text NOT NULL, description text, donations_enabled boolean NOT NULL DEFAULT false, published boolean NOT NULL DEFAULT false);
CREATE TABLE pub.volunteer_missions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parish_id uuid NOT NULL REFERENCES pub.parishes ON DELETE CASCADE, project_id uuid REFERENCES pub.parish_projects ON DELETE SET NULL,
  title text NOT NULL, domain text NOT NULL, description text, status text NOT NULL DEFAULT 'draft', created_by uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE priv.volunteer_applications (mission_id uuid NOT NULL REFERENCES pub.volunteer_missions ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES priv.users ON DELETE CASCADE,
  message text, skills text, availability text, status text NOT NULL DEFAULT 'envoyée', created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (mission_id, user_id));

-- Passeport et parcours
CREATE TABLE priv.church_visits (user_id uuid NOT NULL REFERENCES priv.users ON DELETE CASCADE, church_id uuid NOT NULL REFERENCES pub.churches ON DELETE CASCADE, visited_on date NOT NULL, note text, PRIMARY KEY (user_id, church_id));
CREATE TABLE pub.spiritual_routes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, title text NOT NULL, summary text, rights_id uuid REFERENCES pub.content_rights);
CREATE TABLE pub.route_stops (route_id uuid NOT NULL REFERENCES pub.spiritual_routes ON DELETE CASCADE, position smallint NOT NULL, church_id uuid REFERENCES pub.churches ON DELETE SET NULL, title text NOT NULL, body text, PRIMARY KEY (route_id, position));

-- Traçabilité (sans contenu spirituel)
CREATE TABLE priv.audit_logs (id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), actor uuid, action text NOT NULL, target text, meta jsonb);

-- Sécurité au niveau des lignes : chacun ne voit que ses données
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['user_preferences','personal_mass_entries','spiritual_notes','homily_recordings','church_visits','volunteer_applications'] LOOP
    EXECUTE format('ALTER TABLE priv.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY owner ON priv.%I USING (user_id = current_setting(''app.user_id'')::uuid) WITH CHECK (user_id = current_setting(''app.user_id'')::uuid)', t);
  END LOOP; END $$;
