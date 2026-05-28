# =============================================================================
# MiBici Sonora — Dependencias de FastAPI
# =============================================================================
# CAPA: Adaptadores → API
#
# Define las DEPENDENCIAS que FastAPI inyecta automáticamente
# en los endpoints de los routers.
#
# FastAPI tiene su propio sistema de inyección de dependencias:
#   @router.get("/stations")
#   async def get_stations(container = Depends(get_container)):
#       return await container.station_repo.get_all()
#
# El container se crea UNA vez y se reutiliza en todas las requests.
#
# PRINCIPIO SOLID — Dependency Inversion:
#   Los routers reciben el container como dependencia,
#   nunca crean directamente las implementaciones.
# =============================================================================

from functools import lru_cache

from infrastructure.container import Container


@lru_cache(maxsize=1)
def get_container() -> Container:
    """
    Retorna el contenedor DI (singleton).

    @lru_cache con maxsize=1 garantiza que se crea UNA sola vez
    y se reutiliza en todas las requests. Es equivalente a un singleton.

    ¿Por qué singleton?
    - El contenedor crea conexiones HTTP y pools de DB
    - Crear uno nuevo por request sería muy costoso
    - Un solo contenedor comparte el pool de conexiones

    Returns:
        Instancia única del Container
    """
    return Container()
