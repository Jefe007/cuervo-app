require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());

// ─── PostgreSQL ───────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('connect', () => console.log('[DB] Conectado a PostgreSQL'));
pool.on('error', (err) => console.error('[DB] Error inesperado:', err.message));

// ─── Firebase Admin ───────────────────────────────────────────────────────────

let firebaseReady = false;

try {
  admin.initializeApp({
    credential: admin.credential.cert(require('./firebase-service-account.json')),
  });
  firebaseReady = true;
  console.log('[Firebase] Admin SDK inicializado');
} catch (err) {
  console.warn('[Firebase] No configurado:', err.message);
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta más tarde.' },
});

app.use('/api', limiter);

// ─── Middleware de validación ─────────────────────────────────────────────────

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Rutas ────────────────────────────────────────────────────────────────────

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      db: 'connected',
      firebase: firebaseReady,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// Registrar o actualizar usuario con su token FCM
app.post('/api/auth/register', async (req, res) => {
  const { email, firebase_token } = req.body;

  if (!email || !firebase_token) {
    return res.status(400).json({ error: 'email y firebase_token son requeridos' });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Formato de email inválido' });
  }
  if (typeof firebase_token !== 'string' || firebase_token.length < 10) {
    return res.status(400).json({ error: 'firebase_token inválido' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO users (email, firebase_token)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE
         SET firebase_token = EXCLUDED.firebase_token,
             updated_at     = NOW()
       RETURNING id, email, created_at`,
      [email.toLowerCase().trim(), firebase_token]
    );

    console.log(`[Register] Usuario: ${email}`);
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('[Register] Error:', err.message);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Crear evento (usado por organizadores)
app.post('/api/events', async (req, res) => {
  const { id, name, description, date } = req.body;

  if (!id || !name) {
    return res.status(400).json({ error: 'id y name son requeridos' });
  }
  if (typeof id !== 'string' || id.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: 'El id solo puede contener letras, números, guiones y guiones bajos (máx 100 chars)' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO events (id, name, description, date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             description = EXCLUDED.description,
             date = EXCLUDED.date
       RETURNING *`,
      [id, name.trim(), description?.trim() || null, date || null]
    );

    console.log(`[Events] Evento creado: ${id}`);
    res.json({ event: result.rows[0] });
  } catch (err) {
    console.error('[Events] Error al crear:', err.message);
    res.status(500).json({ error: 'Error al crear evento' });
  }
});

// Obtener evento por ID
app.get('/api/events/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }
    res.json({ event: result.rows[0] });
  } catch (err) {
    console.error('[Events] Error al obtener:', err.message);
    res.status(500).json({ error: 'Error al obtener evento' });
  }
});

// Suscribir usuario a un evento (se llama después de escanear el QR)
app.post('/api/events/:id/subscribe', async (req, res) => {
  const { id: event_id } = req.params;
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'email es requerido' });
  }

  try {
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado. Regístrate primero.' });
    }

    const eventResult = await pool.query('SELECT id FROM events WHERE id = $1', [event_id]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    await pool.query(
      `INSERT INTO event_subscriptions (event_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [event_id, userResult.rows[0].id]
    );

    console.log(`[Subscribe] ${email} → evento ${event_id}`);
    res.json({ message: 'Suscripción exitosa', event_id });
  } catch (err) {
    console.error('[Subscribe] Error:', err.message);
    res.status(500).json({ error: 'Error al suscribir' });
  }
});

// Enviar notificación push a todos los suscriptores de un evento
app.post('/api/events/:id/notify', async (req, res) => {
  if (!firebaseReady) {
    return res.status(503).json({ error: 'Firebase no está configurado en el servidor' });
  }

  const { id: event_id } = req.params;
  const { title, body } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'title y body son requeridos' });
  }
  if (title.length > 200 || body.length > 1000) {
    return res.status(400).json({ error: 'title máx 200 chars, body máx 1000 chars' });
  }

  try {
    const usersResult = await pool.query(
      `SELECT u.id, u.firebase_token
       FROM users u
       JOIN event_subscriptions es ON es.user_id = u.id
       WHERE es.event_id = $1 AND u.firebase_token IS NOT NULL`,
      [event_id]
    );

    if (usersResult.rows.length === 0) {
      return res.json({ message: 'Sin suscriptores para este evento', sent: 0, failed: 0 });
    }

    const tokens = usersResult.rows.map((r) => r.firebase_token);

    const fcmResponse = await admin.messaging().sendEachForMulticast({
      notification: { title, body },
      data: { event_id },
      tokens,
    });

    // Registrar resultado de cada notificación
    const inserts = usersResult.rows.map((row, i) => {
      const success = fcmResponse.responses[i].success;
      const errorCode = fcmResponse.responses[i].error?.code || null;
      return pool.query(
        `INSERT INTO notifications (event_id, firebase_token, title, body, status, error_code)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [event_id, row.firebase_token, title, body, success ? 'sent' : 'failed', errorCode]
      );
    });

    await Promise.allSettled(inserts);

    console.log(
      `[Notify] Evento ${event_id}: ${fcmResponse.successCount} enviados, ${fcmResponse.failureCount} fallidos`
    );

    res.json({
      sent: fcmResponse.successCount,
      failed: fcmResponse.failureCount,
      total: tokens.length,
    });
  } catch (err) {
    console.error('[Notify] Error:', err.message);
    res.status(500).json({ error: 'Error al enviar notificaciones' });
  }
});

// ─── Arranque ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Server] Cuervo backend corriendo en puerto ${PORT}`);
});
