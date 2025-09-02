# Warehouse Labeler

Local dev with Docker Compose.

## Run

```bash
docker-compose up --build
```

- Backend: http://localhost:3000
- Frontend: http://localhost:3001

Set `VITE_API_URL` to point frontend to backend if not default.

## API
- POST `/imports` { batch_tag }
- POST `/imports/:id/devices/upload` (form-data: file)
- GET `/imports`
- GET `/imports/:id/devices`
- PUT `/devices/:id` { user_info, items_number, address }
- GET `/imports/:id/reports/{label-carton|device-label|asset-import}?format=xlsx|csv`