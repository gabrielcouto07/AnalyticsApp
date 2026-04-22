from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import upload, templates

app = FastAPI(title="Analytics Dashboard API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(templates.router)


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}
