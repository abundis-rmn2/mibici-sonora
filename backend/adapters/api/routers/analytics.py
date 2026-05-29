from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query

from adapters.api.dependencies import get_container
from infrastructure.container import Container

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/station-summary")
async def station_summary(container: Container = Depends(get_container)):
    return await container.analytics.get_station_summaries()


@router.get("/current-status")
async def current_status(container: Container = Depends(get_container)):
    return await container.analytics.get_current_status()


@router.get("/history/{station_id}")
async def history(
    station_id: str,
    limit: int = Query(100, ge=1, le=1000),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    container: Container = Depends(get_container),
):
    return await container.analytics.get_station_history(station_id, limit, start, end)


@router.get("/events")
async def events(
    limit: int = Query(50, ge=1, le=500),
    station_id: Optional[str] = None,
    container: Container = Depends(get_container),
):
    return await container.analytics.get_recent_events(limit, station_id)


@router.get("/flow")
async def flow(
    limit: int = Query(20, ge=1, le=100),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    container: Container = Depends(get_container),
):
    return await container.analytics.get_city_flow(limit, start, end)


@router.get("/balance")
async def balance(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    top_n: int = Query(25, ge=1, le=100),
    container: Container = Depends(get_container),
):
    return await container.analytics.calculate_balance_and_availability(start, end, top_n)


@router.get("/movement")
async def movement(
    threshold: int = Query(8, ge=1),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    container: Container = Depends(get_container),
):
    return await container.analytics.classify_movement(threshold, start, end)
