# Analytics Dashboard — Backend API

FastAPI backend for the Analytics Dashboard. Backend-only branch for Render deployment.

## Local development

```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs

## Environment variables

| Variable       | Default              | Description                                  |
|----------------|----------------------|----------------------------------------------|
| `PORT`         | `8000`               | Port the server listens on                   |
| `CORS_ORIGINS` | localhost defaults   | Comma-separated list of allowed CORS origins |

## Deploy on Render

This repo includes `render.yaml` and `Procfile`. To deploy:

1. Push this branch to GitHub.
2. In Render, create a **New Web Service** from this repo and select the `BACK-API` branch.
3. Render will detect `render.yaml` and provision the service automatically.
4. Set `CORS_ORIGINS` env var to your deployed frontend URL (e.g. `https://your-frontend.vercel.app`).

Build command: `pip install --upgrade pip && pip install -r requirements.txt`
Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

## Project structure

```
backend/
  main.py          # FastAPI app entry
  session.py       # Session management
  routers/         # API endpoints
  services/        # Business logic
requirements.txt
render.yaml
Procfile
runtime.txt
```
