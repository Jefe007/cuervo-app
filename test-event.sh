#!/bin/bash
curl -sSL -w "\nHTTP %{http_code}\n" \
  -X POST "https://cuervo-backend-production.up.railway.app/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-event-01",
    "name": "Evento de Prueba",
    "description": "Para testear la app"
  }'
