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


# =============================================================================
# Endpoints de Analítica Urbana Avanzada
# =============================================================================

@router.get(
    "/urban/metabolism",
    summary="Metabolismo Urbano — Fuentes y Sumideros",
    description=(
        "Calcula el flujo neto de bicicletas por estación en una ventana horaria. "
        "Clasifica cada estación como FUENTE (se vacía) o SUMIDERO (se llena). "
        "time_window: morning|midday|afternoon|night"
    ),
)
async def urban_metabolism(
    time_window: str = Query("morning", pattern="^(morning|midday|afternoon|night)$"),
    container: Container = Depends(get_container),
):
    return await container.analytics.get_urban_metabolism(time_window)


@router.get(
    "/urban/desire-lines",
    summary="Líneas de Deseo — Corredores de Alta Fricción",
    description=(
        "Infiere pares origen-destino de alta demanda usando correlación estadística "
        "de eventos. Revela corredores que la infraestructura ciclista podría priorizar."
    ),
)
async def desire_lines(container: Container = Depends(get_container)):
    return await container.analytics.get_desire_lines()


@router.get(
    "/urban/multimodal-stress",
    summary="Índice de Presión Multimodal — Estrés de Última Milla",
    description=(
        "Calcula la volatilidad (STDDEV) del inventario de bicicletas por estación "
        "en los últimos 7 días. Alta volatilidad = alta presión intermodal."
    ),
)
async def multimodal_stress(container: Container = Depends(get_container)):
    return await container.analytics.get_multimodal_stress()


@router.get(
    "/network/centrality",
    summary="Topología de Red — Centralidad de Intermediación",
    description=(
        "Calcula la Betweenness Centrality de cada estación usando NetworkX. "
        "Identifica nodos puente cuya falla fragmentaría la red de movilidad. "
        "Ref: Porta et al. (2006), Environment and Planning B."
    ),
)
async def network_centrality(container: Container = Depends(get_container)):
    return await container.analytics.get_network_centrality()


@router.get(
    "/network/lisa",
    summary="Autocorrelación Espacial Local (LISA) — Clústeres Dinámicos",
    description=(
        "Calcula el estadístico I de Moran Local sobre el ratio de disponibilidad actual. "
        "Clasifica estaciones en HH/LL/HL/LH (p < 0.05). "
        "Ref: Anselin (1995), Geographical Analysis."
    ),
)
async def lisa_clusters(container: Container = Depends(get_container)):
    return await container.analytics.get_lisa_clusters()


@router.get(
    "/playful/derby",
    summary="Derby de Movilidad — Velocidades Inferidas",
    description=(
        "Infiere velocidades de trayectos usando distancia Haversine entre estaciones "
        "y delta temporal entre eventos. Separa ciclistas reales de redistribución logística."
    ),
)
async def bike_derby(container: Container = Depends(get_container)):
    return await container.analytics.get_bike_derby()


@router.get(
    "/playful/hero-journey",
    summary="Viaje del Héroe — Cronología de la Estación Protagonista",
    description=(
        "Narra la historia de la estación más activa como protagonista. "
        "Sin bike_id, la estación actúa como actor: su cronología de eventos, "
        "períodos de inactividad y picos de demanda cuentan la vida de la ciudad."
    ),
)
async def hero_journey(
    station_id: Optional[str] = None,
    container: Container = Depends(get_container),
):
    return await container.analytics.get_hero_journey(station_id)

