# Personal Finance

A personal finance dashboard with Google login, Plaid account linking, transaction categorization, income tracking, historical balances, and real estate equity tracking.

## Project Structure

- `frontend/` - React and Vite dashboard.
- `node/` - Express API, Plaid integration, auth, migrations, and data services.
- `scripts/` - Local setup and deployment helper scripts.

## Setup

Use Node `v26.7.0` or newer. Both `node/.nvmrc` and `frontend/.nvmrc` pin the
version used during local development.

Copy the example environment files and fill in local values:

```bash
cp .env.example .env
cp node/.env.example node/.env
cp frontend/.env.example frontend/.env
```

Install dependencies:

```bash
./scripts/install-backend.sh
./scripts/install-frontend.sh
```

Start local Postgres:

```bash
docker compose up -d db
```

Run database migrations:

```bash
cd node
npm run db:migrate
```

Run the app locally:

```bash
./node/start.sh
```

```bash
cd frontend
npm start
```

The backend runs on `http://localhost:8001` by default (`APP_PORT`). The frontend dev server runs on `http://localhost:3000` and proxies `/api` to the backend.

## Health Checks

- `GET /health` — liveness. Returns `200 {"status":"ok"}` whenever the process is serving. No auth, no rate limit, no I/O.
- `GET /health/ready` — readiness. Returns `200 {"status":"ready"}` when the database is reachable, `503 {"status":"unavailable"}` otherwise. Point your load balancer / orchestrator health check here.

## Plaid Sandbox

Plaid sandbox is setup to mimic the production connection for demo users. Demo data is loaded during the migrations and the sandbox data is not used.

## Token Encryption

Plaid access tokens can be encrypted at rest with AWS KMS. Add the KMS configuration to `node/.env`:

```bash
AWS_REGION=us-east-1
AWS_KMS_KEY_ID=your-kms-key-id-or-arn
```

Use a symmetric KMS key. In AWS, prefer an EC2/task role with `kms:Encrypt` and `kms:Decrypt` permissions for that key. For local development, use your normal AWS CLI/profile credentials rather than committing access keys.

After setting the key, encrypt any existing plaintext Plaid tokens:

```bash
cd node
npm run plaid:encrypt-existing-tokens
```

## Deployment

The backend (`node/`) only serves `/api` and `/health` — it does **not** serve the
frontend. Build the frontend (`cd frontend && npm run build`) and serve the
static `frontend/build/` directory from your web server, CDN, or object store.

The session cookie is `HttpOnly; SameSite=Lax; Secure`. `SameSite=Lax` means the
browser will not attach it to cross-**site** API calls, so the frontend and the
API must be served from the same site:

- same origin (e.g. `app.example.com` serves the SPA and reverse-proxies `/api`
  to the backend), or
- sibling subdomains of one registrable domain (e.g. `app.example.com` +
  `api.example.com`).

A frontend and API on unrelated domains will not stay logged in. List every
frontend origin you deploy in `CORS_ORIGINS` (exact scheme + host + port).

There is no backend Dockerfile; `docker-compose.yml` only provisions Postgres for
local development. Run the backend with `./node/start.sh production` (runs
migrations then starts the server) or your own process manager.

### Cloudflare Pages Frontend

When Cloudflare Pages serves the frontend, `/api/*` is proxied by the Pages
Function. If the Pages project root is `frontend`, Cloudflare uses
`frontend/functions/api/[[path]].js`. If the Pages project root is the repository
root, Cloudflare uses `functions/api/[[path]].js`. Both entries, and the Workers
`worker.js`, share one implementation in `frontend/functions/_proxy-backend.js`.

Response headers (a `Content-Security-Policy` that allows Google Identity
Services, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and
long-cache for `/assets/*`) are served from `frontend/public/_headers`, which
Vite copies into `build/`.

Cloudflare Workers static-assets configuration:

```bash
Build command: npm run build
Deploy command: npx wrangler deploy
Root directory: frontend
```

This uses `frontend/wrangler.jsonc` and `frontend/worker.js`. The Worker serves
the Vite build from `frontend/build` and proxies `/api/*` to `BACKEND_ORIGIN`.
For local `wrangler dev`, copy `frontend/.dev.vars.example` to `frontend/.dev.vars`
and set `BACKEND_ORIGIN` there (gitignored).

Cloudflare Pages Functions configuration:

```bash
Build command: npm run build
Build output directory: build
Root directory: frontend
```

With Pages Functions, Cloudflare uses `frontend/functions/api/[[path]].js`.

Set `BACKEND_ORIGIN` as a Cloudflare dashboard variable for both production and
preview environments (Workers: Settings → Variables; Pages: Settings →
Environment variables). It is deliberately not committed to `wrangler.jsonc`.

```bash
BACKEND_ORIGIN=https://api.example.com
```

`BACKEND_ORIGIN` must include `http://` or `https://`, include the port when
the backend is exposed directly on `APP_PORT`, and must not include `/api`. Use a
real backend domain with a valid TLS certificate — a plaintext `http://` origin
sends session cookies and Plaid data in the clear.

On the backend EC2 instance, set `CORS_ORIGINS` to the exact Cloudflare frontend
origins users visit, not to the backend origin:

```bash
CORS_ORIGINS=https://your-cloudflare-pages-domain.pages.dev,https://app.example.com
```

## Production Notes

- `node/index.js` loads `node/.env` if present, but real environment variables
  always take precedence. For a single-host deploy a `node/.env` file is fine;
  on a platform with a secret manager, set the variables there and skip the file.
- Set `SESSION_SECRET` to a random string of at least 32 characters and tune
  `SESSION_MAX_AGE_SECONDS` for your session lifetime. The server refuses to
  start in production if `SESSION_SECRET` is unset, a placeholder, or too short.
- Set `DB_SSL=true` for hosted Postgres. Leave `DB_SSL_REJECT_UNAUTHORIZED=true` and provide `DB_SSL_CA_PATH` or `DB_SSL_CA` when your provider requires a custom CA.
- Set `MAPBOX_ACCESS_TOKEN` to enable real estate address autocomplete, and
  `RENTCAST_API_KEY` to enable automated property valuations. Both APIs are
  proxied through the backend so the frontend is not coupled to their response
  shapes. If a key is unset, that feature returns a 400 when used; the rest of
  the app is unaffected.
- Configure `CORS_ORIGINS` to the exact frontend origins you deploy.
- Configure Google OAuth redirect origins in Google Cloud.
- Configure Plaid redirect and webhook URLs in the Plaid Dashboard when deploying.
- Use the EventBridge setup script for scheduled monthly syncs if deploying on AWS.
