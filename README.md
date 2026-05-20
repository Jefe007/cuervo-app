# Cuervo – App de Eventos con Notificaciones Push

Stack 100% gratuito: **Expo (React Native)** → **Railway (Node/Express)** → **Neon.tech (PostgreSQL)** + **Firebase Cloud Messaging**

---

## Arquitectura

```
[App Expo]  ──→  [Backend Railway]  ──→  [Neon PostgreSQL]
                       │
                       └──→  [Firebase FCM]  ──→  [Dispositivos]
```

**Flujo:**
1. El organizador crea un evento y genera un QR con el `event_id`
2. El asistente escanea el QR con la app → queda suscrito
3. El organizador llama a `POST /api/events/:id/notify` → FCM entrega el push a todos

---

## Requisitos previos

- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli`
- Cuenta gratuita en [Neon.tech](https://neon.tech)
- Cuenta gratuita en [Railway](https://railway.app)
- Cuenta gratuita en [Firebase](https://firebase.google.com)
- Cuenta gratuita en [Expo](https://expo.dev)

---

## Paso 1 – Configurar PostgreSQL en Neon.tech

1. Ve a [neon.tech](https://neon.tech) y crea una cuenta
2. Haz clic en **"Create Project"** → dale un nombre (ej: `cuervo`)
3. Copia el **Connection string** (empieza con `postgresql://...`)
4. Ve a la pestaña **SQL Editor** y pega el contenido de `backend/db/schema.sql`, luego ejecútalo
5. Verifica que las tablas `users`, `events`, `event_subscriptions` y `notifications` se crearon

> **Tip:** Guarda el connection string, lo necesitarás en Railway.

---

## Paso 2 – Configurar Firebase

### 2.1 Crear proyecto Firebase
1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Haz clic en **"Agregar proyecto"** → nombre: `cuervo`
3. Desactiva Google Analytics (no es necesario) → **Crear proyecto**

### 2.2 Obtener Service Account (para el backend)
1. En el panel izquierdo: **Configuración del proyecto** (ícono ⚙️) → **Cuentas de servicio**
2. Haz clic en **"Generar nueva clave privada"** → se descarga un archivo JSON
3. Abre ese JSON, copia todo su contenido y **conviértelo a una sola línea**:
   ```bash
   # En macOS/Linux:
   cat tu-archivo-firebase.json | tr -d '\n'
   ```
4. Ese resultado (una línea larga) es tu `FIREBASE_SERVICE_ACCOUNT`

### 2.3 Configurar Firebase para Android (app)
1. En Firebase Console: **Configuración del proyecto** → **General** → pestaña **Tus apps**
2. Haz clic en el ícono Android → bundle ID: `com.yourname.cuervo` (igual que en `app.json`)
3. Descarga el archivo `google-services.json`
4. Colócalo en `frontend/google-services.json`

---

## Paso 3 – Configurar el Backend en Railway

### 3.1 Deploy
1. Ve a [railway.app](https://railway.app) y crea una cuenta (gratis)
2. Haz clic en **"New Project"** → **"Deploy from GitHub repo"**
   - O usa **"Deploy from local directory"** con la CLI:
     ```bash
     npm install -g @railway/cli
     cd backend
     railway login
     railway init
     railway up
     ```
3. Railway detectará el `railway.json` y arrancará `node server.js`

### 3.2 Variables de entorno en Railway
En el panel de tu servicio → **Variables** → agrega:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Tu connection string de Neon |
| `FIREBASE_SERVICE_ACCOUNT` | El JSON en una sola línea |

> `PORT` lo inyecta Railway automáticamente, no lo agregues.

### 3.3 Verificar
Una vez desplegado, abre `https://tu-app.railway.app/health`
Debes ver: `{"status":"ok","db":"connected","firebase":true,...}`

---

## Paso 4 – Configurar el Frontend (Expo)

### 4.1 Obtener tu Expo Project ID
1. Ve a [expo.dev](https://expo.dev) y crea una cuenta
2. Crea un nuevo proyecto → copia el **Project ID** (formato UUID)
3. Reemplaza `REEMPLAZA_CON_TU_EXPO_PROJECT_ID` en:
   - `frontend/app.json` (campo `extra.eas.projectId`)
   - `frontend/App.js` (parámetro `projectId` en `getExpoPushTokenAsync`)

### 4.2 Instalar dependencias
```bash
cd frontend
npm install
```

### 4.3 Configurar URL del backend
```bash
cp .env.example .env
```
Edita `.env` y cambia `EXPO_PUBLIC_API_URL` con la URL de Railway.

Para desarrollo local (backend corriendo en tu máquina):
```bash
EXPO_PUBLIC_API_URL=http://192.168.1.X:3000  # tu IP local, no localhost
```

### 4.4 Correr la app
```bash
npx expo start
```
Escanea el QR con la app **Expo Go** en tu teléfono.

> **Importante:** Las push notifications **no funcionan en el simulador de iOS** ni en el emulador de Android. Necesitas un dispositivo físico.

---

## Paso 5 – Probar el flujo completo

### Crear un evento (como organizador)
```bash
curl -X POST https://tu-app.railway.app/api/events \
  -H "Content-Type: application/json" \
  -d '{"id":"conf-2025","name":"Conferencia Tech 2025","description":"Evento anual de tecnología"}'
```

### Generar el QR del evento
El QR debe contener únicamente el `event_id` como texto plano (ej: `conf-2025`).
Puedes generarlo en [qr-code-generator.com](https://www.qr-code-generator.com).

### Suscribir usuario (lo hace la app automáticamente al escanear)
```bash
curl -X POST https://tu-app.railway.app/api/events/conf-2025/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"asistente@ejemplo.com"}'
```

### Enviar notificación push a todos los suscriptores
```bash
curl -X POST https://tu-app.railway.app/api/events/conf-2025/notify \
  -H "Content-Type: application/json" \
  -d '{"title":"¡El evento empieza en 10 minutos!","body":"Dirígete al salón principal. ¡Te esperamos!"}'
```

---

## API Reference

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del servidor y BD |
| `POST` | `/api/auth/register` | Registrar usuario con token FCM |
| `POST` | `/api/events` | Crear evento |
| `GET` | `/api/events/:id` | Obtener datos de un evento |
| `POST` | `/api/events/:id/subscribe` | Suscribir usuario a evento |
| `POST` | `/api/events/:id/notify` | Enviar push a todos los suscriptores |

### POST /api/auth/register
```json
{ "email": "user@example.com", "firebase_token": "ExponentPushToken[...]" }
```

### POST /api/events
```json
{ "id": "mi-evento-01", "name": "Nombre del Evento", "description": "...", "date": "2025-12-01T18:00:00Z" }
```

### POST /api/events/:id/notify
```json
{ "title": "Título de la notificación", "body": "Cuerpo del mensaje" }
```

---

## Variables de entorno

### Backend (`backend/.env`)
| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Connection string de Neon PostgreSQL |
| `FIREBASE_SERVICE_ACCOUNT` | JSON del service account de Firebase (en una línea) |
| `PORT` | Puerto (Railway lo inyecta automáticamente) |

### Frontend (`frontend/.env`)
| Variable | Descripción |
|---|---|
| `EXPO_PUBLIC_API_URL` | URL del backend en Railway |

---

## Estructura del proyecto

```
Proyecto Cuervo/
├── backend/
│   ├── server.js          ← Express + endpoints
│   ├── package.json
│   ├── railway.json       ← Configuración de deploy
│   ├── .env.example
│   └── db/
│       └── schema.sql     ← Tablas e índices
├── frontend/
│   ├── App.js             ← Navegación + push token
│   ├── app.json           ← Config de Expo
│   ├── babel.config.js
│   ├── package.json
│   ├── .env.example
│   └── screens/
│       ├── RegisterScreen.js      ← Email + QR scanner
│       └── NotificationsScreen.js ← Historial de notificaciones
└── README.md
```

---

## Notas de producción

- **Token FCM directo:** Para builds de producción con EAS, cambia `getExpoPushTokenAsync` por `getDevicePushTokenAsync()` y envía esos tokens a Firebase directamente (sin pasar por el servidor de Expo)
- **Autenticación:** Actualmente cualquiera puede llamar a `/api/events/:id/notify`. En producción agrega un header de API key o JWT para proteger este endpoint
- **Límites gratuitos:**
  - Neon: 500 MB de almacenamiento, 1 proyecto
  - Railway: $5 USD de crédito/mes (generalmente suficiente para proyectos pequeños)
  - Firebase FCM: gratuito sin límites de mensajes
  - Expo: gratuito para builds con EAS (con límites mensuales)
