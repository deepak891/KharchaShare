"""
KharchaShare API — application factory.

main.py has exactly one job: assemble the FastAPI application.
  - Configuration  → core/config.py
  - Startup logic  → core/lifespan.py
  - Schemas        → models/schemas.py
  - Business logic → services/
  - Routes         → api/routes/
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import expenses, group_expenses, groups, splits
from core.config import get_settings
from core.lifespan import lifespan


def create_app() -> FastAPI:
    settings = get_settings()

    application = FastAPI(
        title="KharchaShare API",
        version="1.0.0",
        lifespan=lifespan,
    )

    application.add_middleware(1
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        allow_private_network=True,   # Chrome Private Network Access: lets pages on LAN IPs reach localhost
    )

    application.include_router(expenses.router)
    application.include_router(groups.router)
    application.include_router(group_expenses.router)
    application.include_router(splits.router)

    @application.get("/health", tags=["meta"])
    def health():
        return {
            "status": "ok",
            "model": settings.ollama_model,
            "ollama_host": settings.ollama_host,
        }

    return application


app = create_app()
