# =============================================================================
# MiBici Sonora — Router: Estaciones
# =============================================================================
# CAPA: Adaptadores → API → Routers
#
# Define los endpoints HTTP relacionados con estaciones.
#
# NOTA DE ARQUITECTURA:
# - Todos estos endpoints fueron migrados a Consumo Directo desde el Frontend 
#   hacia Supabase (a través de la vista stations_with_latest_snapshot y consultas
#   directas a snapshots/events con RLS).
# - Se mantienen aquí marcados como DEPRECATED únicamente para compatibilidad de API.
# =============================================================================

from fastapi import APIRouter, Depends, HTTPException, Query

from adapters.api.dependencies import get_container
from adapters.api.schemas import SnapshotResponse, StationResponse
from infrastructure.container import Container

# Crear el router con prefijo y tag para la documentación Swagger
router = APIRouter(
    prefix="/api/stations",
    tags=["Estaciones"],
)


@router.get(
    "",
    response_model=list[StationResponse],
    summary="[DEPRECATED] Obtener todas las estaciones",
    description="Migrado a consumo directo de la vista stations_with_latest_snapshot en Supabase.",
    deprecated=True,
)
async def get_stations(
    container: Container = Depends(get_container),
):
    """
    Obtiene TODAS las estaciones con su status actual.
    """
    stations = await container.station_repo.get_all()
    latest_snapshots = await container.snapshot_repo.get_latest_by_station()

    result = []
    for station in stations:
        snapshot = latest_snapshots.get(station.id)

        response = StationResponse(
            id=station.id,
            name=station.name,
            short_name=station.short_name,
            lat=station.lat,
            lon=station.lon,
            capacity=station.capacity,
            address=station.address,
            region=station.region,
            bikes=snapshot.bikes if snapshot else None,
            docks=snapshot.docks if snapshot else None,
            disabled=snapshot.disabled if snapshot else None,
            last_reported=snapshot.timestamp if snapshot else None,
        )
        result.append(response)

    return result


@router.get(
    "/{station_id}",
    response_model=StationResponse,
    summary="[DEPRECATED] Obtener una estación por ID",
    description="Migrado a consumo directo de la vista stations_with_latest_snapshot en Supabase.",
    deprecated=True,
)
async def get_station(
    station_id: str,
    container: Container = Depends(get_container),
):
    """
    Obtiene una estación específica por su ID.
    """
    station = await container.station_repo.get_by_id(station_id)

    if station is None:
        raise HTTPException(
            status_code=404,
            detail=f"Estación {station_id} no encontrada",
        )

    latest = await container.snapshot_repo.get_latest_by_station()
    snapshot = latest.get(station.id)

    return StationResponse(
        id=station.id,
        name=station.name,
        short_name=station.short_name,
        lat=station.lat,
        lon=station.lon,
        capacity=station.capacity,
        address=station.address,
        region=station.region,
        bikes=snapshot.bikes if snapshot else None,
        docks=snapshot.docks if snapshot else None,
        disabled=snapshot.disabled if snapshot else None,
        last_reported=snapshot.timestamp if snapshot else None,
    )


@router.get(
    "/{station_id}/history",
    response_model=list[SnapshotResponse],
    summary="[DEPRECATED] Historial de una estación",
    description="Migrado a consumo directo de la tabla snapshots en Supabase.",
    deprecated=True,
)
async def get_station_history(
    station_id: str,
    limit: int = Query(default=100, ge=1, le=1000, description="Máximo de resultados"),
    offset: int = Query(default=0, ge=0, description="Desplazamiento para paginación"),
    container: Container = Depends(get_container),
):
    """
    Obtiene el historial de snapshots de una estación.
    """
    station = await container.station_repo.get_by_id(station_id)
    if station is None:
        raise HTTPException(
            status_code=404,
            detail=f"Estación {station_id} no encontrada",
        )

    snapshots = await container.snapshot_repo.get_history(
        station_id=station_id,
        limit=limit,
        offset=offset,
    )

    return [
        SnapshotResponse(
            station_id=s.station_id,
            timestamp=s.timestamp,
            bikes=s.bikes,
            docks=s.docks,
            disabled=s.disabled,
            is_renting=s.is_renting,
            is_returning=s.is_returning,
        )
        for s in snapshots
    ]
