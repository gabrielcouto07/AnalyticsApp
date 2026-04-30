import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import advanced, analytics, charts, converter, data, export, filters, materiais, profiler, templates, upload
from .routers import custos as custos_router
from .routers import efetivo_por_obra as por_obra_router
from .routers import forecast as forecast_router
from .routers import orcamento as orcamento_router

app = FastAPI(title="Analytics Dashboard API", version="2.0.0")

_default_origins = "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:3000,http://localhost:8001"
_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", _default_origins).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
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
app.include_router(analytics.router)
app.include_router(custos_router.router, prefix="/api/custos", tags=["custos"])
app.include_router(orcamento_router.router, prefix="/api/orcamento", tags=["orcamento"])
app.include_router(por_obra_router.router, prefix="/api/efetivo", tags=["efetivo"])
app.include_router(forecast_router.router, prefix="/api/forecast", tags=["forecast"])
app.include_router(converter.router)
app.include_router(profiler.router)
app.include_router(templates.router)
app.include_router(templates.compare_router)
app.include_router(materiais.router)


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8001")))
