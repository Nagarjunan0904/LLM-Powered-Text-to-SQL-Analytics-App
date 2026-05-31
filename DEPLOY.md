# Deployment Guide

## Railway Backend Deployment

1. Push code to GitHub (main branch)
2. Create new Railway project → Deploy from GitHub repo
3. Add PostgreSQL plugin inside Railway project
4. Set these environment variables in Railway dashboard:
   ```
   OPENAI_API_KEY = <your key>
   DATABASE_URL   = <Railway provides this automatically from Postgres plugin>
   DB_USER        = postgres
   DB_PASSWORD    = <from Railway Postgres plugin>
   DB_NAME        = railway
   EVAL_LOG_DB    = /app/eval_log.db
   ```
5. Railway auto-detects Dockerfile and builds — no extra config needed
6. Note your Railway public URL: `https://<your-app>.railway.app`

## Seeding NYC Taxi Data on Railway Postgres

> **Note:** Railway free tier has a 500 MB limit.

Load 1 month only for a production demo:

```bash
railway run python load_nyc_taxi.py --months 01
```

(Update `load_nyc_taxi.py` to accept `--months` argument if not already present)

**Full dataset alternatives:**
- Use Railway's managed Postgres with a paid plan
- Connect DBeaver to Railway Postgres and run `COPY` manually

## Vercel Frontend Deployment

1. Push `frontend/` folder to the same GitHub repo
2. Create new Vercel project → import GitHub repo
3. Set root directory to: `frontend`
4. Set environment variable in Vercel dashboard:
   ```
   VITE_API_URL = https://<your-railway-app>.railway.app
   ```
5. Vercel auto-deploys on every push to main
6. Your live URL: `https://<your-app>.vercel.app`

## Local Production Test (before deploying)

Test `docker-compose.prod.yml` locally:

```bash
docker-compose -f docker-compose.prod.yml up --build
```

Confirm: `curl http://localhost:8000/health` returns `{"status":"ok"}`

## Environment Variables Reference

| Variable         | Dev (`.env`)              | Railway              | Vercel       |
|------------------|---------------------------|----------------------|--------------|
| `OPENAI_API_KEY` | `sk-...`                  | set manually         | not needed   |
| `DATABASE_URL`   | `postgresql://localhost`  | auto from plugin     | not needed   |
| `VITE_API_URL`   | `http://localhost:8000`   | not needed           | Railway URL  |
