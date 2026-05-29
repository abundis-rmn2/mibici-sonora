# =============================================================================
# MiBici Sonora — App FastAPI Principal
# =============================================================================
# CAPA: Adaptadores → API
#
# Este es el PUNTO DE ENTRADA de la API REST.
# Configura la aplicación FastAPI, registra routers y define el
# health check principal.
#
# ARQUITECTURA HEXAGONAL:
#   La API REST es un ADAPTADOR DE ENTRADA (driving adapter):
#   - Recibe requests HTTP del mundo exterior
#   - Las traduce a operaciones del dominio
#   - Retorna respuestas JSON
#
#   Es equivalente al CLI pero para clientes HTTP (frontend, curl, etc.)
#
# ENDPOINTS:
#   GET /api/health              → Health check
#   GET /api/stations            → Todas las estaciones
#   GET /api/stations/{id}       → Una estación
#   GET /api/stations/{id}/history → Historial de snapshots
#   GET /api/events/latest       → Últimos eventos
#   GET /api/events/station/{id} → Eventos de una estación
#   GET /api/heatmap             → Datos de heatmap (placeholder)
#   GET /docs                    → Documentación Swagger (automática)
# =============================================================================

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from adapters.api.dependencies import get_container
from adapters.api.schemas import HealthResponse

# Importar los routers (cada uno define un grupo de endpoints)
from adapters.api.routers import events, heatmap, stations, analytics

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# =============================================================================
# Crear la aplicación FastAPI
# =============================================================================
app = FastAPI(
    title="MiBici Sonora API",
    description=(
        "API REST para el sistema de monitoreo y sonificación "
        "de MiBici Guadalajara. Expone datos de estaciones, "
        "snapshots en tiempo real y eventos detectados."
    ),
    version="0.1.0",
    # La documentación Swagger se genera automáticamente en /docs
    docs_url="/docs",
    # Documentación alternativa en formato ReDoc
    redoc_url="/redoc",
)


# =============================================================================
# CORS: Cross-Origin Resource Sharing
# =============================================================================
# Permite que el frontend (que correrá en otro puerto/dominio)
# haga requests a esta API.
#
# En desarrollo: permitimos TODOS los orígenes (*).
# En producción: restringir a los dominios del frontend.
# =============================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción: ["https://mibici-sonora.vercel.app"]
    allow_credentials=True,
    allow_methods=["*"],  # Permitir GET, POST, etc.
    allow_headers=["*"],  # Permitir todos los headers
)


# =============================================================================
# Registrar los routers
# =============================================================================
# Cada router maneja un grupo de endpoints relacionados.
# FastAPI los agrega a la aplicación principal.
# =============================================================================
app.include_router(stations.router)
app.include_router(events.router)
app.include_router(heatmap.router)
app.include_router(analytics.router)


# =============================================================================
# Eventos de Lifecycle
# =============================================================================
@app.on_event("startup")
async def on_startup():
    """
    Se ejecuta cuando la API arranca.

    Crea las tablas de la base de datos si no existen.
    Esto es útil para el primer arranque o después de borrar el volumen.
    """
    logger.info("🚀 Iniciando MiBici Sonora API...")

    # Importar aquí para evitar importaciones circulares
    from infrastructure.database import Base, engine
    import infrastructure.models  # noqa: F401 — registra los modelos

    # Crear tablas si no existen (idempotente)
    from sqlalchemy import text
    async with engine.begin() as conn:
        # Habilitar PostGIS primero (esencial en bases de datos nuevas como en Render)
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        await conn.run_sync(Base.metadata.create_all)

    # -------------------------------------------------------------------------
    # WORKAROUND PARA RENDER FREE TIER
    # Como Render no permite 'Background Workers' en la capa gratuita,
    # ejecutamos el recolector aquí mismo, dentro de la API web.
    # -------------------------------------------------------------------------
    logger.info("🚀 Iniciando recolector de datos en segundo plano...")
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from infrastructure.config import settings

    scheduler = AsyncIOScheduler()

    async def _poll_status():
        try:
            container = get_container()
            current_stations = await container.station_repo.get_all()
            
            # Si la DB está vacía, saltamos este ciclo
            if not current_stations:
                logger.warning("Esperando sincronización de estaciones...")
                return
                
            zones = {s.id: s.region for s in current_stations}
            container.collect_status.set_station_zones(zones)
            
            result = await container.collect_status.execute()
            logger.info(f"📊 Collector: {result['snapshots']} snapshots, {result['events']} eventos detectados")
        except Exception as e:
            logger.error(f"❌ Error en recolector: {e}")

    scheduler.add_job(
        _poll_status,
        "interval",
        seconds=settings.STATUS_POLL_SECONDS,
        id="poll_status",
    )
    
    # Guardamos el scheduler en la app para poder detenerlo al apagar
    app.state.scheduler = scheduler
    scheduler.start()

    logger.info("✅ API lista. Documentación en: http://localhost:8000/docs")


@app.on_event("shutdown")
async def on_shutdown():
    """
    Se ejecuta cuando la API se detiene.

    Cierra el pool de conexiones a PostgreSQL limpiamente.
    """
    from infrastructure.database import engine

    if hasattr(app.state, "scheduler"):
        logger.info("🛑 Deteniendo recolector...")
        app.state.scheduler.shutdown()

    await engine.dispose()
    logger.info("👋 API detenida")


# =============================================================================
# Endpoint: Root (Health Check secundario)
# =============================================================================
@app.get("/", tags=["Sistema"], include_in_schema=False)
async def root():
    """
    Punto de entrada base. Útil para health checks automáticos de Render.
    """
    return {"status": "ok", "app": "MiBici Sonora API", "docs": "/docs"}


# =============================================================================
# Endpoint: Admin Sync Stations (Alternativa al CLI en Render)
# =============================================================================
@app.get("/api/admin/sync-stations", tags=["Admin"], summary="Sincronizar estaciones")
async def admin_sync_stations():
    """
    Sincroniza las estaciones de MiBici desde la API GBFS hacia la base de datos.
    Útil en entornos de nube gratuitos (como Render) donde no hay acceso a la consola/shell
    para ejecutar el comando CLI.
    """
    try:
        container = get_container()
        count = await container.sync_stations.execute()
        return {
            "status": "success",
            "message": f"Se sincronizaron exitosamente {count} estaciones.",
            "instructions": "La base de datos ya tiene el mapa. El worker empezará a guardar eventos en breve."
        }
    except Exception as e:
        logger.error(f"❌ Error al sincronizar estaciones vía API: {e}")
        return {
            "status": "error",
            "message": f"Hubo un error al sincronizar: {str(e)}"
        }


# =============================================================================
# Endpoint: Health Check Principal
# =============================================================================
@app.get(
    "/api/health",
    response_model=HealthResponse,
    tags=["Sistema"],
    summary="Health check",
    description="Verifica que la API y la base de datos estén funcionando.",
)
async def health_check():
    """
    Health check del sistema.

    Verifica:
    1. Que la API está corriendo
    2. Que la conexión a PostgreSQL funciona
    3. Cuántas estaciones hay en la base de datos

    Returns:
        Status del sistema, número de estaciones y mensaje informativo
    """
    try:
        container = get_container()
        stations = await container.station_repo.get_all()
        return HealthResponse(
            status="ok",
            stations=len(stations),
            message=(
                f"{len(stations)} estaciones en la base de datos"
                if stations
                else "Base de datos vacía. Ejecuta: python -m cli sync-stations"
            ),
        )
    except Exception as e:
        logger.error(f"❌ Health check falló: {e}")
        return HealthResponse(
            status="error",
            stations=0,
            message=f"Error de conexión: {str(e)}",
        )
