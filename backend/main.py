import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from database import init_db
from api import routes_turbines, routes_parameters, routes_curves, routes_import, routes_export, routes_settings, routes_comparison


def _dist_dir() -> str:
    if getattr(sys, 'frozen', False):
        return os.path.join(sys._MEIPASS, 'dist')
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist'))


DIST_DIR = _dist_dir()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    if getattr(sys, 'frozen', False):
        import threading, webbrowser
        threading.Timer(1.5, lambda: webbrowser.open('http://127.0.0.1:8000')).start()
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

# ── Serve built React frontend (must be registered after all /api routes) ──
if os.path.isdir(DIST_DIR):
    _assets = os.path.join(DIST_DIR, 'assets')
    if os.path.isdir(_assets):
        app.mount('/assets', StaticFiles(directory=_assets), name='spa_assets')

    @app.get('/{full_path:path}', include_in_schema=False)
    async def spa_fallback(full_path: str):
        # Serve real files from dist root (favicon.ico, vite.svg, etc.)
        if full_path:
            candidate = os.path.join(DIST_DIR, full_path)
            if os.path.isfile(candidate):
                return FileResponse(candidate)
        index = os.path.join(DIST_DIR, 'index.html')
        return FileResponse(index) if os.path.isfile(index) else Response('Frontend not built', 404)


@app.get('/api/version', include_in_schema=False)
async def get_version():
    from version import VERSION
    return {"version": VERSION}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
