# =============================================================================
# MiBici Sonora — Router: Heatmap (placeholder)
# =============================================================================
# CAPA: Adaptadores → API → Routers
#
# Endpoint placeholder para datos agregados de heatmap.
# Se implementará completamente en fases posteriores cuando
# tengamos suficiente histórico para generar mapas de calor.
#
# GET /api/heatmap → Datos agregados de actividad por estación
# =============================================================================

from fastapi import APIRouter

router = APIRouter(
    prefix="/api/heatmap",
    tags=["Heatmap"],
)


@router.get(
    "",
    summary="Datos de heatmap (próximamente)",
    description="Retornará datos agregados de actividad por estación para visualización en mapa de calor.",
)
async def get_heatmap():
    """
    Endpoint placeholder para heatmap.

    En fases posteriores, retornará datos agregados como:
    - Actividad total por estación en un rango de tiempo
    - Patrones de uso por hora del día
    - Flujo neto (taken - returned) por zona

    Returns:
        Mensaje indicando que está en desarrollo
    """
    return {
        "message": "Endpoint en desarrollo. Disponible en fases posteriores.",
        "planned_features": [
            "Actividad total por estación",
            "Patrones de uso por hora",
            "Flujo neto por zona",
        ],
    }
