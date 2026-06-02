# Deployment Guide

## Phase 5.1 — Railway Backend Deployment

### Step 1: Push code to GitHub

```bash
git push origin main
```

### Step 2: Create Railway project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Select **Deploy from GitHub repo**
3. Choose `LLM-Powered-Text-to-SQL-Analytics-App`
4. Railway auto-detects the `Dockerfile` and begins the first build

### Step 3: Add PostgreSQL plugin

1. Inside your Railway project dashboard, click **+ New**
2. Select **Database → Add PostgreSQL**
3. Railway provisions a Postgres 15 instance and injects `DATABASE_URL` automatically

### Step 4: Set environment variables

In the Railway dashboard → your service → **Variables**, add:

| Variable         | Value                                                        |
|------------------|--------------------------------------------------------------|
| `OPENAI_API_KEY` | `sk-...` (your OpenAI key)                                   |
| `DATABASE_URL`   | Provided automatically by the Postgres plugin — do not set manually |
| `DB_NAME`        | `railway`                                                    |
| `DB_USER`        | `postgres`                                                   |
| `DB_PASSWORD`    | Copy from the Postgres plugin's **Connect** tab              |
| `DB_HOST`        | Copy from the Postgres plugin's **Connect** tab              |
| `DB_PORT`        | `5432`                                                       |
| `EVAL_LOG_DB`    | `/app/eval_log.db`                                           |

> `DATABASE_URL` is injected automatically via the Railway Postgres plugin reference variable.
> In the Variables tab, set it to `${{Postgres.DATABASE_URL}}` to use the reference syntax.

### Step 5: Confirm build & deploy

Railway builds the Docker image and deploys it. Watch the **Deployments** tab for the build log.
The service is live when the status shows **Active**.

### Step 6: Note your Railway public URL

Go to your service → **Settings → Networking → Generate Domain**.  
Your URL will look like: `https://<your-app>.up.railway.app`

---

## Phase 5.1 — Seeding NYC Taxi Data on Railway Postgres

### Install the Railway CLI

```bash
npm install -g @railway/cli
```

### Link to your project

```bash
railway login
railway link   # select your project and service when prompted
```

### Load the full dataset (all 12 months, ~38M rows)

```bash
railway run python load_nyc_taxi.py
```

### Load specific months only (faster, for demos or free-tier limits)

```bash
# Load January–March only
railway run python load_nyc_taxi.py --months 01 02 03

# Load a single month
railway run python load_nyc_taxi.py --months 01
```

> **Railway free tier:** 500 MB Postgres storage limit.  
> 1 month ≈ 200–250 MB. Use `--months 01` for a minimal production demo.  
> Full 38M-row dataset requires a paid plan or Hobby tier (~5 GB).

### Verify row count after seeding

```bash
railway run python -c "
from db.connection import engine
from sqlalchemy import text
count = engine.connect().execute(text('SELECT COUNT(*) FROM yellow_taxi_trips')).scalar()
print(f'Rows loaded: {count:,}')
"
```

Expected output: `Rows loaded: 38,310,122` (full year) or proportionally fewer for partial months.

---

## Phase 5.1 — Verify Railway Deployment

```bash
# Health check
curl https://<your-app>.up.railway.app/health

# Schema (confirms DB connected and table exists)
curl https://<your-app>.up.railway.app/schema

# Example query
curl -X POST https://<your-app>.up.railway.app/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How many total trips were taken in 2023?"}'
```

Expected `/health` response:
```json
{"status": "ok", "db": "connected", "schema_cached": true}
```

---

## Phase 5.2 — Vercel Frontend Deployment

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import the same GitHub repo
3. Set **Root Directory** to `frontend`
4. Set environment variable in Vercel dashboard:
   ```
   VITE_API_URL = https://<your-railway-app>.up.railway.app
   ```
5. Vercel auto-deploys on every push to `main`
6. Your live URL: `https://<your-app>.vercel.app`

---

## Local Production Test (before deploying)

Test `docker-compose.prod.yml` locally:

```bash
docker-compose -f docker-compose.prod.yml up --build
```

Confirm: `curl http://localhost:8000/health` returns `{"status":"ok"}`

---

## Environment Variables Reference

| Variable         | Dev (`.env`)                        | Railway                          | Vercel              |
|------------------|-------------------------------------|----------------------------------|---------------------|
| `OPENAI_API_KEY` | `sk-...`                            | set manually                     | not needed          |
| `DATABASE_URL`   | `postgresql://postgres:postgres@localhost:5432/text_to_sql` | auto from Postgres plugin | not needed |
| `DB_NAME`        | `text_to_sql`                       | `railway`                        | not needed          |
| `DB_USER`        | `postgres`                          | `postgres`                       | not needed          |
| `DB_PASSWORD`    | `postgres`                          | from Postgres plugin             | not needed          |
| `DB_HOST`        | `localhost`                         | from Postgres plugin             | not needed          |
| `DB_PORT`        | `5432`                              | `5432`                           | not needed          |
| `EVAL_LOG_DB`    | `eval_log.db`                       | `/app/eval_log.db`               | not needed          |
| `VITE_API_URL`   | `http://localhost:8000`             | not needed                       | Railway public URL  |
