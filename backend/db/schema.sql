-- Cuervo – Schema de base de datos
-- Ejecutar en Neon.tech SQL Editor

CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  email          VARCHAR(255) UNIQUE NOT NULL,
  firebase_token TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id          VARCHAR(100) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  date        TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_subscriptions (
  id            SERIAL PRIMARY KEY,
  event_id      VARCHAR(100) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id       INTEGER      NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id             SERIAL PRIMARY KEY,
  event_id       VARCHAR(100) REFERENCES events(id) ON DELETE SET NULL,
  firebase_token TEXT NOT NULL,
  title          VARCHAR(255) NOT NULL,
  body           TEXT NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending', -- sent | failed | pending
  error_code     VARCHAR(100),
  sent_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_subscriptions_event_id  ON event_subscriptions(event_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id   ON event_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_event_id  ON notifications(event_id);
CREATE INDEX IF NOT EXISTS idx_users_firebase_token    ON users(firebase_token);

-- Datos de prueba (opcional, borrar en producción)
-- INSERT INTO events (id, name, description) VALUES ('test-event-01', 'Evento de Prueba', 'Descripción del evento de prueba');
