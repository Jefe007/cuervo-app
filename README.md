# Cuervo – App de Eventos con Notificaciones Push

Escaneas un QR en un evento → recibes notificaciones push cuando el organizador las manda.

Stack gratuito: **Expo (React Native)** + **Node/Express en Railway** + **PostgreSQL en Neon** + **Firebase Cloud Messaging**

---

## URLs de producción

| Servicio | URL |
|---|---|
| Backend (Railway) | `https://cuervo-backend-production.up.railway.app` |
| Health check | `https://cuervo-backend-production.up.railway.app/health` |
| Base de datos | Neon.tech — proyecto `cuervo` |

---

## Cómo funciona

```
[App Expo]  ──→  [Backend Railway]  ──→  [Neon PostgreSQL]
                       │
                       └──→  [Firebase FCM]  ──→  [Tu teléfono]
```

1. El organizador crea un evento → genera un QR con el ID del evento
2. El asistente abre la app, escribe su email y escanea el QR → queda suscrito
3. El organizador manda un `curl` o usa un panel → llega una notificación push a todos los suscritos

---

## Estructura del proyecto

```
Proyecto Cuervo/
│
├── backend/                        El servidor (Node.js + Express)
│   ├── server.js                   Todos los endpoints de la API
│   ├── package.json                Dependencias del servidor
│   ├── railway.json                Configuración de deploy en Railway
│   ├── firebase-service-account.json  Credenciales Firebase (NO subir a git)
│   ├── .env                        Variables locales (NO subir a git)
│   ├── .env.example                Plantilla de variables — sí se sube a git
│   └── db/
│       └── schema.sql              Tablas de la base de datos
│
├── frontend/                       La app móvil (React Native + Expo)
│   ├── App.js                      Navegación y configuración de push
│   ├── app.json                    Configuración de Expo (nombre, permisos)
│   ├── .env                        URL del backend (NO subir a git)
│   ├── .env.example                Plantilla — sí se sube a git
│   └── screens/
│       ├── RegisterScreen.js       Pantalla: email + escáner QR
│       └── NotificationsScreen.js  Pantalla: historial de notificaciones
│
├── test-event.sh                   Script para crear el evento de prueba
├── test-notification.sh            Script para enviar notificación de prueba
└── README.md
```

---

## Correr el frontend localmente

**Requisitos:** Node.js 18+, la app Expo Go instalada en tu teléfono.

```bash
# 1. Entra a la carpeta del frontend
cd frontend

# 2. Instala dependencias (solo la primera vez)
npm install

# 3. Levanta el servidor de desarrollo
npx expo start
```

Aparecerá un QR en la terminal. Escanéalo con la cámara de tu teléfono (iOS) o con la app Expo Go (Android). La app se cargará en tu dispositivo.

> Las notificaciones push **solo funcionan en dispositivo físico**, no en simulador.

---

## Probar el flujo completo

### Paso 1 — Crear el evento de prueba

Corre el script incluido en el proyecto:

```bash
./test-event.sh
```

O manualmente con curl:

```bash
curl -X POST https://cuervo-backend-production.up.railway.app/api/events \
  -H "Content-Type: application/json" \
  -d '{"id":"test-event-01","name":"Evento de Prueba","description":"Para testear la app"}'
```

Respuesta esperada:
```json
{"event":{"id":"test-event-01","name":"Evento de Prueba",...}}
```

### Paso 2 — Generar el QR

El QR debe contener únicamente el texto `test-event-01` (sin comillas, sin espacios).

Genera el QR aquí: **https://www.qr-code-generator.com**

1. Pega `test-event-01` en el campo de texto
2. Descarga o muestra el QR en pantalla

### Paso 3 — Suscribirte desde la app

1. Abre la app en tu teléfono
2. Escribe tu email
3. Toca **"Escanear QR del Evento"**
4. Apunta la cámara al QR de `test-event-01`
5. La app te confirma que quedaste suscrito

### Paso 4 — Enviar una notificación push

```bash
./test-notification.sh
```

O manualmente:

```bash
curl -X POST https://cuervo-backend-production.up.railway.app/api/events/test-event-01/notify \
  -H "Content-Type: application/json" \
  -d '{"title":"¡Hola desde Cuervo!","body":"La notificación llegó correctamente."}'
```

Respuesta esperada:
```json
{"sent":1,"failed":0,"total":1}
```

La notificación debe aparecer en tu teléfono en segundos.

---

## Variables de entorno

Ningún valor real va en el código ni en git. Cada entorno tiene su propio archivo `.env`.

### Backend — `backend/.env`

```bash
# Connection string de Neon.tech
DATABASE_URL=postgresql://usuario:password@host/neondb?sslmode=require

# JSON del service account de Firebase (en una sola línea)
# En Railway se configura como variable de entorno en el dashboard
# En local se usa el archivo firebase-service-account.json como fallback
FIREBASE_SERVICE_ACCOUNT=
```

### Frontend — `frontend/.env`

```bash
# URL del backend desplegado
EXPO_PUBLIC_API_URL=https://cuervo-backend-production.up.railway.app

# Para desarrollo local apuntando a tu máquina:
# EXPO_PUBLIC_API_URL=http://192.168.1.X:3000
```

---

## API — Referencia rápida

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/health` | Verifica que el servidor y la BD están vivos |
| `POST` | `/api/auth/register` | Registra un usuario con su token de notificaciones |
| `POST` | `/api/events` | Crea un nuevo evento |
| `GET` | `/api/events/:id` | Obtiene los datos de un evento |
| `POST` | `/api/events/:id/subscribe` | Suscribe un usuario a un evento |
| `POST` | `/api/events/:id/notify` | Manda push a todos los suscritos del evento |

---

## Comandos útiles

### Desarrollo

```bash
# Correr el backend localmente
cd backend && node server.js

# Correr el frontend
cd frontend && npx expo start

# Ver logs del backend en Railway (tiempo real)
cd backend && railway logs --follow

# Verificar que el backend de producción está vivo
curl https://cuervo-backend-production.up.railway.app/health
```

### Deploy

```bash
# Subir cambios del backend a Railway
cd backend
git add . && git commit -m "descripción del cambio"
railway up

# Ver variables de entorno en Railway (solo claves, sin valores)
railway variables | cut -d= -f1
```

### Base de datos

```bash
# Crear las tablas (solo la primera vez, desde Neon SQL Editor)
# Copia y pega el contenido de backend/db/schema.sql

# Crear evento desde la terminal
./test-event.sh

# Enviar notificación de prueba
./test-notification.sh
```

---

## Límites del plan gratuito

| Servicio | Límite |
|---|---|
| Neon.tech | 500 MB de almacenamiento, 1 proyecto |
| Railway | ~$5 USD de crédito/mes incluido |
| Firebase FCM | Gratuito, sin límite de mensajes |
| Expo Go | Gratuito para desarrollo |
