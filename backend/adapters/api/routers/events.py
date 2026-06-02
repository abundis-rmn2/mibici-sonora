# =============================================================================
# MiBici Sonora — Router: Eventos
# =============================================================================
# CAPA: Adaptadores → API → Routers
#
# Define los endpoints HTTP relacionados con eventos.
#
# NOTA DE ARQUITECTURA:
# - Todos estos endpoints fueron migrados a Consumo Directo desde el Frontend 
#   hacia Supabase (a través de consultas directas a la tabla events con RLS).
# - Se mantienen aquí marcados como DEPRECATED únicamente para compatibilidad de API.
# =============================================================================

from fastapi import APIRouter, Depends, Query

from adapters.api.dependencies import get_container
from adapters.api.schemas import EventResponse
from infrastructure.container import Container

router = APIRouter(
    prefix="/api/events",
    tags=["Eventos"],
)


@router.get(
    "/latest",
    response_model=list[EventResponse],
    summary="[DEPRECATED] Últimos eventos",
    description="Migrado a consumo directo de la tabla events en Supabase.",
    deprecated=True,
)
async def get_latest_events(
    limit: int = Query(
        default=50,
        ge=1,
        le=1000,
        description="Máximo de eventos (1-1000, default 50)",
    ),
    container: Container = Depends(get_container),
):
    """
    Obtiene los eventos más recientes de TODO el sistema.
    """
    events = await container.event_repo.get_latest(limit=limit)

    return [
        EventResponse(
            station_id=e.station_id,
            timestamp=e.timestamp,
            event_type=e.event_type,
            delta=e.delta,
            zone=e.zone,
        )
        for e in events
    ]


@router.get(
    "/station/{station_id}",
    response_model=list[EventResponse],
    summary="[DEPRECATED] Eventos de una estación",
    description="Migrado a consumo directo de la tabla events en Supabase.",
    deprecated=True,
)
async def get_station_events(
    station_id: str,
    limit: int = Query(
        default=50,
        ge=1,
        le=1000,
        description="Máximo de eventos",
    ),
    container: Container = Depends(get_container),
):
    """
    Obtiene los eventos de una estación específica.
    """
    events = await container.event_repo.get_by_station(
        station_id=station_id,
        limit=limit,
    )

    return [
        EventResponse(
            station_id=e.station_id,
            timestamp=e.timestamp,
            event_type=e.event_type,
            delta=e.delta,
            zone=e.zone,
        )
        for e in events
    ]
