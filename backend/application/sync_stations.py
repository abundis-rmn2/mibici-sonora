# =============================================================================
# MiBici Sonora — Caso de Uso: Sincronizar Estaciones
# =============================================================================
# CAPA: Aplicación (casos de uso)
#
# Este caso de uso orquesta la sincronización de estaciones desde
# la API GBFS hacia la base de datos local.
#
# ARQUITECTURA HEXAGONAL:
#   Este es un CASO DE USO (application service).
#   - Recibe datos del GBFS via el puerto GBFSPort
#   - Los guarda via el puerto StationRepository
#   - NO sabe que existe httpx ni PostgreSQL
#   - Solo conoce las interfaces (puertos) del dominio
#
# FLUJO:
#   1. GBFSPort.fetch_station_info() → obtener estaciones del GBFS
#   2. StationRepository.upsert_many() → guardar en la base de datos
#
# FRECUENCIA: Cada ~4 horas (datos estáticos que cambian rara vez)
# =============================================================================

import logging

from domain.ports import GBFSPort, StationRepository

logger = logging.getLogger(__name__)


class SyncStationsUseCase:
    """
    Caso de uso: Sincronizar estaciones desde GBFS → base de datos.

    Lee la información estática de estaciones de la API GBFS de MiBici
    y la guarda (upsert) en la base de datos local.

    Este caso de uso es IDEMPOTENTE: se puede ejecutar múltiples veces
    sin crear duplicados. Cada ejecución actualiza los datos existentes.

    PRINCIPIO SOLID — Dependency Inversion:
        No depende de GBFSHttpAdapter ni de PostgresStationRepo.
        Depende de las INTERFACES GBFSPort y StationRepository.
        Las implementaciones se inyectan desde el contenedor DI.

    Args:
        gbfs_port:    Puerto para obtener datos del GBFS
        station_repo: Puerto para persistir estaciones
    """

    def __init__(
        self,
        gbfs_port: GBFSPort,
        station_repo: StationRepository,
    ):
        """
        Inicializa el caso de uso con sus dependencias inyectadas.

        Args:
            gbfs_port:    Implementación del puerto GBFS (inyectado por DI)
            station_repo: Implementación del repositorio de estaciones (inyectado por DI)
        """
        # Guardar las dependencias como atributos privados.
        # El prefijo _ indica que son "internos" de esta clase.
        self._gbfs_port = gbfs_port
        self._station_repo = station_repo

    async def execute(self) -> int:
        """
        Ejecuta la sincronización de estaciones.

        Proceso:
        1. Consulta station_information del GBFS
        2. Parsea las ~300 estaciones con nombre, coordenadas, capacidad
        3. Hace upsert en la tabla stations de PostgreSQL
        4. Retorna el número de estaciones procesadas

        Returns:
            Número de estaciones sincronizadas

        Raises:
            httpx.HTTPError: si falla la consulta al GBFS
            SQLAlchemyError: si falla la escritura en PostgreSQL
        """
        logger.info("🔄 Iniciando sincronización de estaciones...")

        # Paso 1: Obtener datos del GBFS via el puerto
        # Esto llama a GBFSHttpAdapter.fetch_station_info() internamente,
        # pero el caso de uso NO lo sabe. Solo ve el puerto GBFSPort.
        stations = await self._gbfs_port.fetch_station_info()
        logger.info(f"📡 Obtenidas {len(stations)} estaciones del GBFS")

        # Paso 2: Guardar en base de datos via el puerto
        # Esto llama a PostgresStationRepo.upsert_many() internamente.
        count = await self._station_repo.upsert_many(stations)
        logger.info(f"💾 Sincronizadas {count} estaciones en la base de datos")

        # Mostrar resumen por región para verificación rápida
        regions = {}
        for s in stations:
            regions[s.region] = regions.get(s.region, 0) + 1
        logger.info(f"🗺️  Distribución por región: {regions}")

        return count
