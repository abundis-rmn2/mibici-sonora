# =============================================================================
# MiBici Sonora — Router: Eventos
# =============================================================================
# CAPA: Adaptadores → API → Routers
#
# Define los endpoints HTTP relacionados con eventos:
#   GET /api/events/latest         → Últimos eventos del sistema
#   GET /api/events/station/{id}   → Eventos de una estación
#
# Los eventos son el dato más valioso del sistema:
# representan actividad real (alguien tomó o devolvió una bici).
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
    summary="Últimos eventos",
    description="Retorna los eventos más recientes del sistema (bike_taken, bike_returned).",
)
async def get_latest_events(
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
        description="Máximo de eventos (1-200, default 50)",
    ),
    container: Container = Depends(get_container),
):
    """
    Obtiene los eventos más recientes de TODO el sistema.

    Cada evento indica que una o más bicicletas fueron tomadas
    o devueltas en una estación específica.

    Los eventos se ordenan por timestamp descendente (más reciente primero).

    Args:
        limit: Máximo de eventos a retornar (default 50, max 200)

    Returns:
        Lista de eventos recientes
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
    summary="Eventos de una estación",
    description="Retorna los eventos más recientes de una estación específica.",
)
async def get_station_events(
    station_id: str,
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
        description="Máximo de eventos",
    ),
    container: Container = Depends(get_container),
):
    """
    Obtiene los eventos de una estación específica.

    Útil para ver la actividad reciente de una estación individual:
    ¿cuántas bicis se tomaron/devolvieron en las últimas horas?

    Args:
        station_id: ID de la estación
        limit: Máximo de eventos

    Returns:
        Lista de eventos de esa estación
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
