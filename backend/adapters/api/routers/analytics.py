# =============================================================================
# MiBici Sonora — Router: Analítica y Lúdico
# =============================================================================
# CAPA: Adaptadores → API → Routers
#
# Define los endpoints analíticos y lúdicos del sistema.
#
# NOTA DE ARQUITECTURA:
# - Las rutas que realizan cálculos pesados en batch (LISA, Centralidad, etc.)
#   y las consultas CRUD directas se migraron a Supabase Direct (consumidas
#   directamente desde el frontend para mínima latencia).
# - Las rutas marcadas como DEPRECATED se mantienen por compatibilidad pero ya no
#   son consultadas por el frontend.
# - Las rutas dinámicas (que reciben parámetros dinámicos de rango de tiempo o
#   lógicas procedimentales complejas) se retienen y ejecutan en vivo aquí.
# =============================================================================

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query

from adapters.api.dependencies import get_container
from infrastructure.container import Container

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

# =============================================================================
# 1. ENPOINTS DEPRECATED (Migrados a Consumo Directo Supabase)
# =============================================================================

@router.get(
    "/station-summary",
    deprecated=True,
    summary="[DEPRECATED] Resumen de Estaciones",
    description="Migrado a consumo directo de la vista stations_with_latest_snapshot en Supabase.",
)
async def station_summary(container: Container = Depends(get_container)):
    return await container.analytics.get_station_summaries()


@router.get(
    "/current-status",
    deprecated=True,
    summary="[DEPRECATED] Estado Actual (Tiempo Real)",
    description="Migrado a consumo directo de la vista stations_with_latest_snapshot en Supabase.",
)
async def current_status(container: Container = Depends(get_container)):
    return await container.analytics.get_current_status()


@router.get(
    "/history/{station_id}",
    deprecated=True,
    summary="[DEPRECATED] Historial de una Estación",
    description="Migrado a consumo directo de la tabla snapshots en Supabase.",
)
async def history(
    station_id: str,
    limit: int = Query(100, ge=1, le=1000),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    container: Container = Depends(get_container),
):
    return await container.analytics.get_station_history(station_id, limit, start, end)


@router.get(
    "/events",
    deprecated=True,
    summary="[DEPRECATED] Eventos Recientes",
    description="Migrado a consumo directo de la tabla events en Supabase.",
)
async def events(
    limit: int = Query(50, ge=1, le=500),
    station_id: Optional[str] = None,
    container: Container = Depends(get_container),
):
    return await container.analytics.get_recent_events(limit, station_id)


@router.get(
    "/urban/metabolism",
    deprecated=True,
    summary="[DEPRECATED] Metabolismo Urbano",
    description="Migrado a precomputación en Edge Worker y consumo directo de la tabla analytics_urban_metabolism.",
)
async def urban_metabolism(
    time_window: str = Query("morning", pattern="^(morning|midday|afternoon|night)$"),
    container: Container = Depends(get_container),
):
    return await container.analytics.get_urban_metabolism(time_window)


@router.get(
    "/urban/desire-lines",
    deprecated=True,
    summary="[DEPRECATED] Líneas de Deseo",
    description="Migrado a precomputación en Edge Worker y consumo directo de la tabla analytics_desire_lines.",
)
async def desire_lines(container: Container = Depends(get_container)):
    return await container.analytics.get_desire_lines()


@router.get(
    "/urban/multimodal-stress",
    deprecated=True,
    summary="[DEPRECATED] Índice de Presión Multimodal",
    description="Migrado a precomputación en Edge Worker y consumo directo de la tabla analytics_multimodal_stress.",
)
async def multimodal_stress(container: Container = Depends(get_container)):
    return await container.analytics.get_multimodal_stress()


@router.get(
    "/network/centrality",
    deprecated=True,
    summary="[DEPRECATED] Centralidad de Intermediación",
    description="Migrado a precomputación en Edge Worker y consumo directo de la tabla analytics_centrality_results.",
)
async def network_centrality(container: Container = Depends(get_container)):
    return await container.analytics.get_network_centrality()


@router.get(
    "/network/lisa",
    deprecated=True,
    summary="[DEPRECATED] Autocorrelación Espacial Local (LISA)",
    description="Migrado a precomputación en Edge Worker y consumo directo de la tabla analytics_lisa_results.",
)
async def lisa_clusters(container: Container = Depends(get_container)):
    return await container.analytics.get_lisa_clusters()


@router.get(
    "/playful/derby",
    deprecated=True,
    summary="[DEPRECATED] Derby de Movilidad",
    description="Migrado a precomputación en Edge Worker y consumo directo de la tabla analytics_bike_derby.",
)
async def bike_derby(container: Container = Depends(get_container)):
    return await container.analytics.get_bike_derby()


# =============================================================================
# 2. ENPOINTS ACTIVOS DINÁMICOS (Procesamiento en Vivo)
# =============================================================================

@router.get(
    "/flow",
    summary="Flujo Dinámico de la Ciudad (Orígenes y Destinos)",
    description=(
      "Obtiene el flujo inferido origen-destino filtrado dinámicamente por "
      "rango de fechas en el parámetro de consulta."
    ),
)
async def flow(
    limit: int = Query(20, ge=1, le=100),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    container: Container = Depends(get_container),
):
    return await container.analytics.get_city_flow(limit, start, end)


@router.get(
    "/balance",
    summary="Balance y Disponibilidad Dinámica de Estaciones",
    description=(
      "Calcula las estaciones con mejor y peor balance de disponibilidad "
      "filtrado dinámicamente por rango de fechas."
    ),
)
async def balance(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    top_n: int = Query(25, ge=1, le=100),
    container: Container = Depends(get_container),
):
    return await container.analytics.calculate_balance_and_availability(start, end, top_n)


@router.get(
    "/movement",
    summary="Clasificación Dinámica de Movimiento Logístico (Anomalías)",
    description=(
      "Clasifica los eventos dinámicos superiores al umbral como movimientos "
      "de rebalanceo logístico del staff (anomalías de volumen)."
    ),
)
async def movement(
    threshold: int = Query(8, ge=1),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    container: Container = Depends(get_container),
):
    return await container.analytics.classify_movement(threshold, start, end)


@router.get(
    "/playful/hero-journey",
    summary="Viaje del Héroe — Cronología de la Estación Protagonista",
    description=(
        "Narra la historia procedimental de la estación más activa como protagonista. "
        "Sin bike_id, la estación actúa como actor: su cronología de eventos, "
        "períodos de inactividad y picos de demanda cuentan la vida de la ciudad."
    ),
)
async def hero_journey(
    station_id: Optional[str] = None,
    container: Container = Depends(get_container),
):
    return await container.analytics.get_hero_journey(station_id)
