-- Cafecito IA — tablas del boletín.
-- Correr una vez:  psql "$DATABASE_URL" -f drizzle/cafecito.sql
-- (o `npx drizzle-kit push`, que las deduce del esquema)

CREATE TABLE IF NOT EXISTS cafecito_ediciones (
  id             serial PRIMARY KEY,
  slug           varchar(10)  NOT NULL,
  titulo         varchar(300) NOT NULL,
  bajada         varchar(400),
  contenido      text         NOT NULL,
  lectura        varchar(20),
  publicada      boolean      NOT NULL DEFAULT true,
  publicada_en   timestamp    NOT NULL DEFAULT now(),
  actualizada_en timestamp    NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cafecito_ediciones_slug_idx
  ON cafecito_ediciones (slug);
CREATE INDEX IF NOT EXISTS cafecito_ediciones_publicada_idx
  ON cafecito_ediciones (publicada, publicada_en);

CREATE TABLE IF NOT EXISTS cafecito_suscriptores (
  id         serial PRIMARY KEY,
  email      varchar(254) NOT NULL,
  nombre     varchar(160),
  perfil     varchar(20)  NOT NULL,
  origen     varchar(30)  NOT NULL DEFAULT 'web',
  token      varchar(40)  NOT NULL,
  baja_en    timestamp,
  created_at timestamp    NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cafecito_suscriptores_email_idx
  ON cafecito_suscriptores (email);
CREATE UNIQUE INDEX IF NOT EXISTS cafecito_suscriptores_token_idx
  ON cafecito_suscriptores (token);
CREATE INDEX IF NOT EXISTS cafecito_suscriptores_perfil_idx
  ON cafecito_suscriptores (perfil, baja_en);
