import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import upload, data, charts, export, filters, advanced, converter, profiler, templates, materiais

app = FastAPI(title="Analytics Dashboard API", version="2.0.0")

_default_origins = "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:3000,http://localhost:8001"
_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", _default_origins).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(data.router)
app.include_router(charts.router)
app.include_router(export.router)
app.include_router(filters.router)
app.include_router(advanced.router)
app.include_router(converter.router)
app.include_router(profiler.router)
app.include_router(templates.router)
app.include_router(materiais.router)


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))