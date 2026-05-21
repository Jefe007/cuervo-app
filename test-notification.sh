#!/bin/bash
curl -sSL -w "\nHTTP %{http_code}\n" \
  -X POST "https://cuervo-backend-production.up.railway.app/api/events/test-event-01/notify" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "¡Bienvenido a Cuervo!",
    "body": "Esta es una notificación de prueba. El sistema está funcionando correctamente."
  }'
