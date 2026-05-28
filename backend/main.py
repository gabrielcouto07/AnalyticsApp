from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import upload, data, charts, export

app = FastAPI(title="Analytics Dashboard API", version="2.0.0")

# CORS libera o React (localhost:5173/5175) para chamar o backend (localhost:8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(data.router)
app.include_router(charts.router)
app.include_router(export.router)


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}
