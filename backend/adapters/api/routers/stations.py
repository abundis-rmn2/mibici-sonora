# =============================================================================
# MiBici Sonora — Router: Estaciones
# =============================================================================
# CAPA: Adaptadores → API → Routers
#
# Define los endpoints HTTP relacionados con estaciones:
#   GET /api/stations            → Todas las estaciones con status actual
#   GET /api/stations/{id}       → Una estación por ID
#   GET /api/stations/{id}/history → Historial de snapshots
#
# ARQUITECTURA HEXAGONAL:
#   Los routers son ADAPTADORES DE ENTRADA (driving adapters):
#   - Reciben requests HTTP del cliente
#   - Extraen parámetros (query params, path params)
#   - Llaman a los repositorios del dominio
#   - Retornan respuestas formateadas con schemas Pydantic
#
#   Los routers NO contienen lógica de negocio.
#   Solo traducen HTTP ↔ dominio.
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
    summary="Obtener todas las estaciones",
    description="Retorna todas las estaciones con su status actual (bikes, docks).",
)
async def get_stations(
    container: Container = Depends(get_container),
):
    """
    Obtiene TODAS las estaciones con su status actual.

    Combina datos estáticos (nombre, ubicación) con el último snapshot
    dinámico (bikes, docks) de cada estación.

    Returns:
        Lista de ~300 estaciones con status actual
    """
    # Obtener estaciones estáticas del repositorio
    stations = await container.station_repo.get_all()

    # Obtener el último snapshot de cada estación para el status actual
    latest_snapshots = await container.snapshot_repo.get_latest_by_station()

    # Combinar datos estáticos + dinámicos en la respuesta
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
            # Si hay un snapshot, incluir el status actual
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
    summary="Obtener una estación por ID",
    description="Retorna los datos de una estación específica con su status actual.",
)
async def get_station(
    station_id: str,
    container: Container = Depends(get_container),
):
    """
    Obtiene una estación específica por su ID.

    Args:
        station_id: ID de la estación (e.g. "2", "3")

    Returns:
        Datos de la estación con status actual

    Raises:
        404: Si la estación no existe
    """
    station = await container.station_repo.get_by_id(station_id)

    if station is None:
        raise HTTPException(
            status_code=404,
            detail=f"Estación {station_id} no encontrada",
        )

    # Obtener el último snapshot para el status
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
    summary="Historial de una estación",
    description="Retorna el historial de snapshots de una estación con paginación.",
)
async def get_station_history(
    station_id: str,
    limit: int = Query(default=100, ge=1, le=1000, description="Máximo de resultados"),
    offset: int = Query(default=0, ge=0, description="Desplazamiento para paginación"),
    container: Container = Depends(get_container),
):
    """
    Obtiene el historial de snapshots de una estación.

    Cada snapshot muestra bikes, docks y disabled en un momento dado.
    Ordenados por fecha descendente (más reciente primero).

    Soporta paginación con limit y offset:
      /api/stations/2/history?limit=50&offset=0   → primeros 50
      /api/stations/2/history?limit=50&offset=50   → siguientes 50

    Args:
        station_id: ID de la estación
        limit: Máximo de resultados (1-1000, default 100)
        offset: Desplazamiento para paginación

    Returns:
        Lista de snapshots
    """
    # Verificar que la estación existe
    station = await container.station_repo.get_by_id(station_id)
    if station is None:
        raise HTTPException(
            status_code=404,
            detail=f"Estación {station_id} no encontrada",
        )

    # Obtener historial con paginación
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
