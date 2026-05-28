# =============================================================================
# MiBici Sonora — Caso de Uso: Recolectar Status
# =============================================================================
# CAPA: Aplicación (casos de uso)
#
# Este caso de uso orquesta la recolección de un snapshot completo:
# 1. Consulta station_status del GBFS (datos dinámicos)
# 2. Guarda los snapshots en la base de datos
# 3. Detecta eventos comparando con el snapshot anterior
#
# Es el caso de uso que se ejecuta cada ~30 segundos cuando el
# collector está activo. Orquesta los otros casos de uso.
#
# FLUJO:
#   station_status (GBFS)
#         ↓
#   insert snapshots (PostgreSQL)
#         ↓
#   detect_events (comparar con anterior)
#         ↓
#   insert events (PostgreSQL)
#
# FRECUENCIA: Cada 30 segundos (configurable con STATUS_POLL_SECONDS)
# =============================================================================

import logging

from domain.ports import GBFSPort, SnapshotRepository, StationRepository
from application.detect_events import DetectEventsUseCase

logger = logging.getLogger(__name__)


class CollectStatusUseCase:
    """
    Caso de uso: Recolectar status de estaciones y detectar eventos.

    Este es el "orquestador" principal del collector.
    Combina dos operaciones en una:
    1. Guardar snapshots (datos crudos)
    2. Detectar eventos (análisis del delta)

    ¿Por qué combinar ambas operaciones?
    Porque siempre se ejecutan juntas: primero guardamos el snapshot actual,
    luego lo comparamos con el anterior para detectar eventos.
    Separarlas en dos comandos distintos sería innecesariamente complejo.

    PRINCIPIO SOLID — Single Responsibility:
    Aunque orquesta dos operaciones, su responsabilidad es UNA:
    "procesar un ciclo de polling completo".

    Args:
        gbfs_port:      Puerto para obtener datos del GBFS
        snapshot_repo:  Puerto para persistir snapshots
        detect_events:  Caso de uso de detección de eventos
    """

    def __init__(
        self,
        gbfs_port: GBFSPort,
        snapshot_repo: SnapshotRepository,
        detect_events: DetectEventsUseCase,
    ):
        self._gbfs_port = gbfs_port
        self._snapshot_repo = snapshot_repo
        self._detect_events = detect_events

        # Mapa de zonas por estación (se carga lazy la primera vez).
        # Se usa para clasificar los eventos por zona geográfica.
        self._station_zones: dict[str, str] = {}

    async def execute(self) -> dict:
        """
        Ejecuta un ciclo completo de recolección.

        Proceso:
        1. Obtener station_status del GBFS (~300 estaciones)
        2. Detectar eventos comparando con snapshots anteriores
        3. Insertar nuevos snapshots en la base de datos
        4. Los eventos se insertan automáticamente por DetectEventsUseCase

        ⚠️ IMPORTANTE: detectamos eventos ANTES de insertar los nuevos
        snapshots. Si insertamos primero, get_latest_by_station() retornaría
        los snapshots que acabamos de insertar como "anteriores", y nunca
        detectaríamos ningún cambio.

        Returns:
            Diccionario con resumen:
            {
                "snapshots": número de snapshots insertados,
                "events": número de eventos detectados
            }
        """
        logger.info("🔄 Iniciando ciclo de recolección...")

        # Paso 1: Obtener datos dinámicos del GBFS
        snapshots = await self._gbfs_port.fetch_station_status()
        logger.info(f"📡 Obtenidos {len(snapshots)} snapshots del GBFS")

        # Paso 2: Detectar eventos ANTES de insertar los nuevos snapshots.
        # Si no hay station_zones cargadas, usamos un mapa vacío.
        # Los eventos se guardan automáticamente en la DB dentro de detect_events.
        events = await self._detect_events.execute(
            current_snapshots=snapshots,
            station_zones=self._station_zones,
        )

        # Paso 3: AHORA sí insertar los nuevos snapshots en la DB.
        # Estos serán los "anteriores" para el próximo ciclo.
        count = await self._snapshot_repo.insert_many(snapshots)

        result = {
            "snapshots": count,
            "events": len(events),
        }

        logger.info(
            f"✅ Ciclo completado: {count} snapshots, {len(events)} eventos"
        )
        return result

    def set_station_zones(self, zones: dict[str, str]):
        """
        Establece el mapa de zonas por estación.

        Se llama después de sincronizar estaciones para que los eventos
        se clasifiquen correctamente por zona geográfica.

        Args:
            zones: Diccionario {station_id: region}
                   Ejemplo: {"2": "GDL", "5": "ZPN", "300": "TLQ"}
        """
        self._station_zones = zones
        logger.info(f"🗺️ Mapa de zonas actualizado: {len(zones)} estaciones")
