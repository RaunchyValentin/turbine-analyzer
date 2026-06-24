# Turbine Analyzer — Project Architecture

## Overview

Desktop application for parsing, storing, comparing, and analyzing gas turbine parameters
from SPPA-T3000 JAR/SREL files and Excel workbooks. Supports mathematical curve fitting,
interpolation, interactive chart editing, and multi-turbine comparison (up to 3 simultaneously).
Designed for fully offline field use.

---

## Repository

> **IMPORTANT: This repository must remain PRIVATE at all times.**
> It contains proprietary parsing logic for SPPA-T3000 (Orion Server) JAR/SREL files
> and may contain sensitive turbine commissioning data.
> Never change visibility to Public on GitHub or any other hosting platform.

- Hosting: GitHub (private repository)
- Branch strategy:
  - `main` — stable, working version only
  - `dev` — active development
  - `feature/*` — individual features, merged into dev via PR

---

## Tech Stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Desktop    | Electron                                |
| Frontend   | React + Vite                            |
| Backend    | Python 3.11+ / FastAPI + Uvicorn        |
| Database   | SQLite via SQLAlchemy                   |
| Charts     | Plotly.js                               |
| Tables     | AG Grid (Community)                     |
| State      | Zustand                                 |
| HTTP       | Axios                                   |
| Math       | NumPy + SciPy                           |
| Excel I/O  | Pandas + OpenPyXL                       |

---

## Project Structure

```
turbine-analyzer/
│
├── ARCHITECTURE.md             ← this file
│
├── backend/                    # Python / FastAPI
│   ├── main.py                 # FastAPI app entry point
│   ├── database.py             # SQLAlchemy engine, session factory
│   ├── models/
│   │   ├── turbine.py          # Turbine, Project models
│   │   ├── parameter.py        # Parameter, ParameterValue models
│   │   ├── curve.py            # Curve, CurvePoint models
│   │   └── session.py          # WorkSession (save/restore state)
│   ├── parsers/
│   │   ├── jar_parser.py       # JAR / SREL T3000 parser (SGT5-4000F format)
│   │   ├── excel_parser.py     # .xlsx input workbooks
│   │   └── csv_parser.py       # .txt / .csv experimental data points
│   ├── services/
│   │   ├── comparison.py       # multi-turbine parameter comparison logic
│   │   ├── math_engine.py      # interpolation, extrapolation, LOESS, polynomials
│   │   └── export.py           # Excel export with defined output structure
│   ├── api/
│   │   ├── routes_turbines.py  # CRUD for turbines and projects
│   │   ├── routes_parameters.py
│   │   ├── routes_curves.py
│   │   ├── routes_import.py    # file upload and parsing endpoints
│   │   └── routes_export.py
│   └── requirements.txt
│
├── frontend/                   # React + Vite
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx        # project overview, turbine list
│   │   │   ├── Parameters.jsx       # parameter table for single turbine
│   │   │   ├── Comparison.jsx       # side-by-side comparison up to 3 turbines
│   │   │   ├── Curves.jsx           # curve editor: chart + XY table input
│   │   │   ├── Import.jsx           # file import (JAR, Excel, CSV)
│   │   │   └── Export.jsx           # export results to Excel
│   │   ├── components/
│   │   │   ├── ParameterTable/      # AG Grid with diff highlighting
│   │   │   ├── CurveEditor/         # Plotly chart + mouse drag + XY table
│   │   │   ├── TurbineSelector/     # pick 1-3 turbines for comparison
│   │   │   └── DiffHighlight/       # color coding for differing values
│   │   ├── api/
│   │   │   └── client.js            # Axios client → FastAPI localhost
│   │   └── store/
│   │       └── appStore.js          # Zustand global state
│   ├── index.html
│   └── package.json
│
├── electron/
│   ├── main.js                 # Electron main process
│   ├── preload.js              # context bridge
│   └── python-bridge.js        # spawn Python/Uvicorn as subprocess
│
└── data/
    └── turbines.db             # SQLite database (auto-created on first run)
```

---

## Database Schema

### `projects`
| Column      | Type    | Description                        |
|-------------|---------|------------------------------------|
| id          | INTEGER | Primary key                        |
| name        | TEXT    | Project name                       |
| description | TEXT    | Optional notes                     |
| created_at  | DATE    | Creation timestamp                 |

### `turbines`
| Column      | Type    | Description                              |
|-------------|---------|------------------------------------------|
| id          | INTEGER | Primary key                              |
| project_id  | INTEGER | FK → projects                            |
| name        | TEXT    | Turbine name / tag                       |
| type        | TEXT    | e.g. SGT5-4000F, SGT5-2000E             |
| site        | TEXT    | Site / location                          |
| source_file | TEXT    | Original import filename                 |
| imported_at | DATE    | Import timestamp                         |

### `parameters`
| Column      | Type    | Description                              |
|-------------|---------|------------------------------------------|
| id          | INTEGER | Primary key                              |
| turbine_id  | INTEGER | FK → turbines                            |
| kks         | TEXT    | KKS identifier                           |
| name        | TEXT    | Parameter mnemonic / name                |
| value       | TEXT    | Raw value (stored as text, typed in app) |
| unit        | TEXT    | Engineering unit                         |
| data_type   | TEXT    | REAL, INT, BOOL, STRING, CURVE           |
| source      | TEXT    | jar / excel / manual                     |
| group       | TEXT    | Functional group / page                  |

### `curves`
| Column      | Type    | Description                              |
|-------------|---------|------------------------------------------|
| id          | INTEGER | Primary key                              |
| turbine_id  | INTEGER | FK → turbines                            |
| name        | TEXT    | Curve identifier / mnemonic              |
| poly_order  | INTEGER | Polynomial degree (if fitted)            |
| description | TEXT    |                                          |

### `curve_points`
| Column   | Type    | Description            |
|----------|---------|------------------------|
| id       | INTEGER | Primary key            |
| curve_id | INTEGER | FK → curves            |
| x        | REAL    | X coordinate           |
| y        | REAL    | Y coordinate           |
| order    | INTEGER | Point sequence index   |

### `work_sessions`
| Column     | Type    | Description                              |
|------------|---------|------------------------------------------|
| id         | INTEGER | Primary key                              |
| name       | TEXT    | Session name / description               |
| state_json | TEXT    | Full UI + data snapshot (JSON)           |
| created_at | DATE    |                                          |
| updated_at | DATE    |                                          |

### `experimental_data`
| Column     | Type    | Description                              |
|------------|---------|------------------------------------------|
| id         | INTEGER | Primary key                              |
| turbine_id | INTEGER | FK → turbines (optional)                 |
| filename   | TEXT    | Source filename                          |
| label      | TEXT    | Display label                            |
| data_json  | TEXT    | Raw XY point array (JSON)               |
| imported_at| DATE    |                                          |

---

## Key Python Libraries

```txt
# requirements.txt
fastapi>=0.111.0
uvicorn>=0.29.0
sqlalchemy>=2.0.0
aiosqlite>=0.20.0
pandas>=2.2.0
openpyxl>=3.1.0
numpy>=1.26.0
scipy>=1.13.0
python-multipart>=0.0.9    # file uploads
```

---

## Key Frontend Libraries

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "plotly.js": "^2.32.0",
    "react-plotly.js": "^2.6.0",
    "ag-grid-react": "^31.3.0",
    "ag-grid-community": "^31.3.0",
    "zustand": "^4.5.0",
    "axios": "^1.7.0"
  },
  "devDependencies": {
    "vite": "^5.2.0",
    "@vitejs/plugin-react": "^4.3.0",
    "electron": "^31.0.0",
    "electron-builder": "^24.13.0"
  }
}
```

---

## UI Pages Summary

| Page        | Description                                                              |
|-------------|--------------------------------------------------------------------------|
| Dashboard   | List of projects and turbines, quick stats, open/create session          |
| Parameters  | Full parameter table for one turbine, filterable, searchable             |
| Comparison  | Side-by-side table for up to 3 turbines, diff highlighting               |
| Curves      | Interactive curve editor: Plotly chart + XY data table + mouse drag      |
| Import      | Upload JAR / Excel / CSV files, preview parsed data before saving        |
| Export      | Select turbine(s), choose export template, download .xlsx                |

---

## Curve Editor Features

- Display polynomial curves with configurable degree
- Zoom / pan (Plotly built-in)
- Overlay up to 3 turbines on single chart
- Edit points by dragging on chart with mouse
- Edit points via XY coordinate table (inline editable)
- Load experimental CSV/TXT data as reference overlay
- LOESS smoothing and polynomial fitting (scipy)
- Interpolation / extrapolation along fitted curve

---

## Comparison Features

- Select 2–3 turbines from database (any number stored total)
- Match parameters by: KKS, name, mnemonic, or custom key
- Highlight: missing parameters, differing values, out-of-range values
- Color coding: green = match, yellow = minor diff, red = significant diff / missing
- Export comparison result to Excel

---

## Development Roadmap

1. **Phase 1 — Foundation**
   - Project scaffold (Electron + React + FastAPI)
   - SQLite schema + SQLAlchemy models
   - Basic CRUD API endpoints

2. **Phase 2 — Parsers**
   - JAR / SREL parser (reuse logic from v12 React project)
   - Excel parser
   - CSV / TXT experimental data parser

3. **Phase 3 — Core UI**
   - Parameters page (AG Grid table)
   - Import page with preview

4. **Phase 4 — Comparison**
   - TurbineSelector component
   - Comparison page with diff highlighting
   - Comparison Excel export

5. **Phase 5 — Curves**
   - CurveEditor component
   - Plotly integration with drag editing
   - Math engine (interpolation, LOESS, polynomial fit)

6. **Phase 6 — Sessions & Export**
   - Save / restore work sessions
   - Full Excel export with templates

7. **Phase 7 — Packaging**
   - Electron Builder → Windows .exe installer
   - Bundle Python runtime (PyInstaller or embedded)
   - Offline installer (no internet required at runtime)

---

## Notes for Claude Code

- JAR parser format: same as SGT5-4000F SREL/JAR used in React v12 project
- Parameters can reach ~10,000 rows per turbine — optimize DB queries with indexes on `kks`, `name`, `turbine_id`
- All operations must work fully offline — no external API calls at runtime
- Target platform: Windows (primary), cross-platform not required
- AG Grid Community license is free — do not use Enterprise features
- Plotly.js chosen over Recharts for advanced interactivity (drag, zoom, multi-axis)
