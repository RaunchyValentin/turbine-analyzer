# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for turbine-analyzer
# Build: pyinstaller turbine-analyzer.spec --noconfirm
#
# Output: dist\turbine-analyzer\turbine-analyzer.exe   (onedir, fast startup)
# Data:   turbine-analyzer-data\  folder next to the .exe  (created on first run)

import os
from PyInstaller.utils.hooks import collect_all, collect_submodules

ROOT = os.path.abspath('.')
BACKEND = os.path.join(ROOT, 'backend')
DIST_SRC = os.path.join(ROOT, 'frontend', 'dist')

# Collect packages that have non-Python data files
scipy_d,   scipy_b,   scipy_h   = collect_all('scipy')
openpyxl_d, openpyxl_b, openpyxl_h = collect_all('openpyxl')
pandas_d,  pandas_b,  pandas_h  = collect_all('pandas')

a = Analysis(
    [os.path.join(BACKEND, 'main.py')],
    pathex=[BACKEND],
    binaries=scipy_b + openpyxl_b + pandas_b,
    datas=[
        (DIST_SRC, 'dist'),           # built React app
    ] + scipy_d + openpyxl_d + pandas_d,
    hiddenimports=[
        # aiosqlite / sqlalchemy
        'aiosqlite',
        'sqlalchemy.dialects.sqlite',
        'sqlalchemy.dialects.sqlite.aiosqlite',
        # uvicorn internals (not auto-detected)
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        # starlette static files
        'starlette.staticfiles',
        'starlette.responses',
        # stdlib
        'multiprocessing',
        'email.mime.text',
        'email.mime.multipart',
        'zipfile',
        'gzip',
        'webbrowser',
    ] + scipy_h + openpyxl_h + pandas_h
      + collect_submodules('starlette'),
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='turbine-analyzer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,       # no console window
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name='turbine-analyzer',
)
