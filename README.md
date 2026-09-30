# CMPDIPS — Coal Mine Planning & Design Spatial Intelligence

A full-stack spatial database and institutional report-generation web application for the CMPDIPS project that maps real coal mines across India, relationally links them to geological, environmental, and parliamentary reports, and features an interactive dashboard.

---

## 🛠 Tech Stack

- **Backend**: Python (FastAPI)
- **Database**: PostgreSQL (with PostGIS extension) / SQLite fallback
- **Frontend**: Vanilla HTML5, CSS3, JavaScript
- **Mapping**: Leaflet.js with `leaflet.markercluster`
- **Base Map**: OpenStreetMap standard tiles (no API keys required)

---

## 🚀 Quick Start Guide

### 1. Install Dependencies

Clone the repository and install the Python dependencies:

```bash
pip install -r requirements.txt
```

---

### 2. Set Up Local PostgreSQL Database & Run Seeding

#### A. Create PostgreSQL Database & Enable PostGIS

Using `psql` or pgAdmin:

```sql
CREATE DATABASE cmpdips;
\c cmpdips
CREATE EXTENSION IF NOT EXISTS postgis;
```

#### B. Configure Environment Variable (Optional)

By default, the application connects to:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cmpdips"
```

You can set your own connection string via environment variable or `.env` file:
```bash
# Windows PowerShell
$env:DATABASE_URL="postgresql://<user>:<password>@localhost:5432/cmpdips"

# Linux / macOS / Bash
export DATABASE_URL="postgresql://<user>:<password>@localhost:5432/cmpdips"
```

> *Note: If no PostgreSQL database is running, the app automatically falls back to a local SQLite database (`cmpdips.db`) for immediate zero-config testing.*

#### C. Run Schema and Seed Script

Populate 75+ verified real-world operational coalfields (BCCL, ECL, CCL, SECL, MCL, WCL, NCL, SCCL, NLC) across India and generate 300+ institutional reports:

```bash
python scripts/seed_mines.py
```

Or execute `schema.sql` directly in PostgreSQL:

```bash
psql -U postgres -d cmpdips -f schema.sql
```

---

### 3. Start the Application

Start the FastAPI development server:

```bash
uvicorn main:app --reload
```

The application will be running live at:
👉 **http://localhost:8000**

---

## 📡 API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | `GET` | Serves the web dashboard |
| `/api/mines` | `GET` | GeoJSON FeatureCollection of all seeded mines (supports `?subsidiary=`, `?type=`, `?state=`, `?search=`) |
| `/api/mines/{mine_id}` | `GET` | Detailed metadata for a single mine |
| `/api/mines/{mine_id}/reports` | `GET` | List of historical reports for the given mine |
| `/api/reports/{report_id}` | `GET` | Full document body for the live preview pane |
| `/api/stats` | `GET` | Mine counts, report counts, and unique filter options |

---

## 📂 Project Structure

```
├── main.py               # FastAPI application & API routes
├── database.py           # Database engine & session management
├── models.py             # SQLAlchemy ORM models (Mine & Report)
├── schema.sql            # PostgreSQL schema with PostGIS geometry & triggers
├── requirements.txt      # Python dependencies
├── scripts/
│   └── seed_mines.py     # Ingestion & seeding script (Overpass API + fallback + report generator)
├── static/
│   ├── index.html        # Main dashboard UI
│   ├── style.css         # Modern design system & layout styling
│   └── app.js            # Leaflet map, hover filters, and preview renderer
└── README.md             # Setup & documentation
```
