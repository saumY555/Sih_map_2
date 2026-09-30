"""
CMPDIPS FastAPI Application
============================
Serves the spatial mine database, report APIs, and static frontend.
"""

import os
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db, engine
from models import Mine, Report

app = FastAPI(title="CMPDIPS — Coal Mine Planning & Design", version="1.0.0")

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files ──
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ─────────────────────────────────────────────
# ROOT → serve index.html
# ─────────────────────────────────────────────
@app.get("/")
async def root():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


# ─────────────────────────────────────────────
# API ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/api/mines")
def list_mines(
    type: str | None = Query(None),
    state: str | None = Query(None),
    subsidiary: str | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Return GeoJSON FeatureCollection of all mines, with optional filters."""
    q = db.query(Mine)
    if type:
        q = q.filter(Mine.type == type)
    if state:
        q = q.filter(Mine.state == state)
    if subsidiary:
        q = q.filter(Mine.subsidiary == subsidiary)
    if search:
        q = q.filter(Mine.name.ilike(f"%{search}%"))

    mines = q.all()

    features = []
    for m in mines:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [m.longitude, m.latitude],
            },
            "properties": {
                "mine_id": m.mine_id,
                "name": m.name,
                "subsidiary": m.subsidiary,
                "state": m.state,
                "district": m.district,
                "type": m.type,
            },
        })

    return {
        "type": "FeatureCollection",
        "features": features,
        "count": len(features),
    }


@app.get("/api/mines/{mine_id}")
def get_mine(mine_id: str, db: Session = Depends(get_db)):
    """Return detailed metadata for a single mine."""
    mine = db.query(Mine).filter(Mine.mine_id == mine_id).first()
    if not mine:
        raise HTTPException(404, "Mine not found")
    return {
        "mine_id": mine.mine_id,
        "name": mine.name,
        "subsidiary": mine.subsidiary,
        "state": mine.state,
        "district": mine.district,
        "type": mine.type,
        "latitude": mine.latitude,
        "longitude": mine.longitude,
        "report_count": db.query(Report).filter(Report.mine_id == mine_id).count(),
    }


@app.get("/api/mines/{mine_id}/reports")
def get_mine_reports(mine_id: str, db: Session = Depends(get_db)):
    """Return all reports linked to a mine."""
    mine = db.query(Mine).filter(Mine.mine_id == mine_id).first()
    if not mine:
        raise HTTPException(404, "Mine not found")

    reports = db.query(Report).filter(Report.mine_id == mine_id).order_by(Report.year.desc()).all()
    return {
        "mine_id": mine_id,
        "mine_name": mine.name,
        "reports": [
            {
                "report_id": r.report_id,
                "title": r.title,
                "year": r.year,
                "format": r.format,
                "confidence_score": r.confidence_score,
                "production_ytd": r.production_ytd,
            }
            for r in reports
        ],
    }


@app.get("/api/reports/{report_id}")
def get_report(report_id: str, db: Session = Depends(get_db)):
    """Return the full document body for the live preview pane."""
    report = db.query(Report).filter(Report.report_id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")

    mine = db.query(Mine).filter(Mine.mine_id == report.mine_id).first()
    return {
        "report_id": report.report_id,
        "mine_id": report.mine_id,
        "mine_name": mine.name if mine else "",
        "title": report.title,
        "year": report.year,
        "format": report.format,
        "confidence_score": report.confidence_score,
        "production_ytd": report.production_ytd,
        "content": report.content,
    }


@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    """Dashboard statistics."""
    mine_count = db.query(Mine).count()
    report_count = db.query(Report).count()

    states = db.execute(text("SELECT DISTINCT state FROM mines ORDER BY state")).fetchall()
    subsidiaries = db.execute(text("SELECT DISTINCT subsidiary FROM mines ORDER BY subsidiary")).fetchall()
    types = db.execute(text("SELECT DISTINCT type FROM mines ORDER BY type")).fetchall()

    return {
        "mine_count": mine_count,
        "report_count": report_count,
        "states": [r[0] for r in states if r[0]],
        "subsidiaries": [r[0] for r in subsidiaries if r[0]],
        "types": [r[0] for r in types if r[0]],
    }
