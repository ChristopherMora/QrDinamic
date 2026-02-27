# QR Dinámico (Local)

Sistema backend para QR dinámico con:
- Redirección pública por slug: `/qr/{slug}`
- Destino editable sin reimprimir el QR
- Activar/desactivar QR
- Alta y edición de QR
- Listado y búsqueda
- Validaciones de slug y URL
- Métricas mínimas por slug

## Requisitos

- Node.js 20+
- npm 10+

## Ejecutar en local

```bash
npm install
npm start
```

Servidor por defecto: `http://localhost:3000`

Panel web local: `http://localhost:3000/admin`

## Variables de entorno

- `PORT` (opcional): puerto del servidor (default: `3000`)
- `DATA_FILE_PATH` (opcional): ruta del archivo JSON de persistencia (default: `./data/qrs.json`)
- `FALLBACK_URL` (opcional): fallback para slugs inválidos/inactivos (default: `/qr/not-found`)
- `PUBLIC_BASE_URL` (opcional): URL pública base para codificar en el QR (ej: `https://dofer.mx`); si no se define, se infiere desde el request

## Despliegue en Dockploy

El proyecto ya incluye:
- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`
- `.env.example`

### Opción recomendada (Docker Compose en Dockploy)

1. En Dockploy crea un servicio con este repositorio.
2. Selecciona `docker-compose.yml` como archivo de despliegue.
3. Crea un volumen persistente montado en `/app/data` (o usa el volumen `qrdinamic_data` del compose).
4. Configura estas variables de entorno en Dockploy:

```env
APP_PORT=3000
PUBLIC_BASE_URL=https://qr.tudominio.com
FALLBACK_URL=/qr/not-found
```

Notas:
- `APP_PORT` es el puerto externo publicado por Docker Compose.
- Dentro del contenedor la app corre en `PORT=3000`.
- `DATA_FILE_PATH` ya queda configurado en el compose como `/app/data/qrs.json`.

### Opción Dockerfile (sin compose)

Si en Dockploy despliegas solo por `Dockerfile`, pon estas variables:

```env
PORT=3000
DATA_FILE_PATH=/app/data/qrs.json
PUBLIC_BASE_URL=https://qr.tudominio.com
FALLBACK_URL=/qr/not-found
NODE_ENV=production
```

Y monta un volumen en `/app/data` para no perder los QRs al reiniciar/redeploy.

## Rutas públicas

- `GET /qr/{slug}`
  - Si existe y está activo: redirige a `destination_url`
  - Si no existe o está inactivo: redirige a fallback
- `GET /qr/not-found`
  - Responde: `QR no válido`

## API de gestión (sin UI)

### Crear QR

`POST /api/qrs`

Body:

```json
{
  "slug": "doflins-mv-2026",
  "destination_url": "https://dofer.mx/landing",
  "name": "Campaña MV 2026"
}
```

### Listar / buscar

`GET /api/qrs`

`GET /api/qrs?search=mv-2026`

### Obtener detalle

`GET /api/qrs/:slug`

### Generar imagen QR (PNG/SVG)

`GET /api/qrs/:slug/qr`

Query params opcionales:
- `format`: `png` (default) o `svg`
- `size`: entero entre `64` y `2048` (default: `300`)

El QR codifica la URL pública de redirección: `https://tu-dominio/qr/{slug}`.

### Editar destino/nombre/estado

`PATCH /api/qrs/:slug`

Body ejemplo:

```json
{
  "destination_url": "https://dofer.mx/nuevo-destino",
  "name": "Nuevo nombre interno",
  "is_active": true
}
```

### Activar / desactivar

- `POST /api/qrs/:slug/activate`
- `POST /api/qrs/:slug/deactivate`

## Validaciones

- `slug`
  - único
  - sin espacios
  - solo letras/números/guiones (`^[a-zA-Z0-9-]+$`)
- `destination_url`
  - URL válida
  - solo `http://` o `https://`

## Métricas mínimas

Cada slug guarda:
- `total_clicks`
- `last_click_at`

Si falla el guardado de métricas, la redirección sigue funcionando.

## Pruebas

```bash
npm test
```

Incluyen:
- creación + redirección + tracking
- validación de slug
- slug duplicado
- fallback por inactivo
- fallback por destino mal formado
- tolerancia a fallo de tracking

## Ejemplos rápidos con curl

Crear:

```bash
curl -X POST http://localhost:3000/api/qrs \
  -H "Content-Type: application/json" \
  -d '{"slug":"promo-2026","destination_url":"https://dofer.mx/promo","name":"Promo 2026"}'
```

Editar destino:

```bash
curl -X PATCH http://localhost:3000/api/qrs/promo-2026 \
  -H "Content-Type: application/json" \
  -d '{"destination_url":"https://dofer.mx/promo-v2"}'
```

Desactivar:

```bash
curl -X POST http://localhost:3000/api/qrs/promo-2026/deactivate
```

Generar QR en SVG:

```bash
curl "http://localhost:3000/api/qrs/promo-2026/qr?format=svg"
```

Para producción con `Dofer.mx`, después puedes apuntar el dominio al servidor y exponer `https://dofer.mx/qr/{slug}` con proxy (Nginx/Caddy) o despliegue cloud.
