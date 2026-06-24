from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import init_db
from api import routes_turbines, routes_parameters, routes_curves, routes_import, routes_export, routes_settings, routes_comparison


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Turbine Analyzer API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_turbines.router, prefix="/api")
app.include_router(routes_parameters.router, prefix="/api")
app.include_router(routes_curves.router, prefix="/api")
app.include_router(routes_import.router, prefix="/api")
app.include_router(routes_export.router, prefix="/api")
app.include_router(routes_settings.router, prefix="/api")
app.include_router(routes_comparison.router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
