# =============================================================================
# MiBici Sonora — Contenedor de Inyección de Dependencias
# =============================================================================
# CAPA: Infraestructura
#
# Este archivo es el CORAZÓN de la arquitectura hexagonal.
# Conecta los PUERTOS (interfaces) con sus ADAPTADORES (implementaciones).
#
# ¿Qué es la Inyección de Dependencias (DI)?
#   En lugar de que cada clase cree sus propias dependencias:
#     ❌ class SyncStations:
#           def __init__(self):
#               self.repo = PostgresStationRepo()  # acoplado a PostgreSQL!
#
#   Inyectamos las dependencias desde fuera:
#     ✅ class SyncStations:
#           def __init__(self, repo: StationRepository):  # acepta cualquier repo
#               self.repo = repo
#
# ¿Por qué un contenedor?
#   1. Centraliza la creación de TODAS las dependencias
#   2. Facilita cambiar implementaciones (PostgreSQL → SQLite)
#   3. Facilita testing (inyectar mocks/fakes)
#   4. Documenta explícitamente cómo se conecta todo
#
# PRINCIPIO SOLID — Dependency Inversion:
#   Los casos de uso NUNCA importan PostgresStationRepo directamente.
#   Reciben un StationRepository (interfaz) que ESTE contenedor resuelve.
# =============================================================================

from infrastructure.config import settings
from infrastructure.database import async_session_factory

# Importar los adaptadores (implementaciones concretas)
from adapters.gbfs_http_adapter import GBFSHttpAdapter
from adapters.postgres_repos import (
    PostgresEventRepo,
    PostgresSnapshotRepo,
    PostgresStationRepo,
)

# Importar los casos de uso (application layer)
from application.sync_stations import SyncStationsUseCase
from application.collect_status import CollectStatusUseCase
from application.detect_events import DetectEventsUseCase
from application.analytics import AnalyticsService


class Container:
    """
    Contenedor de Inyección de Dependencias.

    Centraliza la creación y conexión de todos los componentes del sistema.
    Es el ÚNICO lugar donde se instancian las implementaciones concretas.

    Uso:
        container = Container()
        # Ahora puedes usar los casos de uso:
        await container.sync_stations.execute()
        await container.collect_status.execute()

    Diagrama de dependencias:
        Container
          ├── GBFSHttpAdapter (implementa GBFSPort)
          ├── PostgresStationRepo (implementa StationRepository)
          ├── PostgresSnapshotRepo (implementa SnapshotRepository)
          ├── PostgresEventRepo (implementa EventRepository)
          ├── SyncStationsUseCase (usa GBFSPort + StationRepository)
          ├── DetectEventsUseCase (usa SnapshotRepository + EventRepository)
          └── CollectStatusUseCase (usa GBFSPort + SnapshotRepository + DetectEventsUseCase)
    """

    def __init__(self):
        """
        Inicializa el contenedor creando todas las dependencias.

        El orden de creación importa:
        1. Primero los adaptadores (no dependen de nada del sistema)
        2. Luego los casos de uso (dependen de los adaptadores via puertos)
        """

        # === ADAPTADORES (implementaciones concretas de los puertos) ===

        # Adaptador GBFS: consume la API de MiBici via HTTP
        # Implementa el puerto GBFSPort definido en domain/ports.py
        self.gbfs_adapter = GBFSHttpAdapter(
            base_url=settings.GBFS_BASE_URL,
        )

        # Adaptador PostgreSQL para estaciones
        # Implementa el puerto StationRepository
        self.station_repo = PostgresStationRepo(
            session_factory=async_session_factory,
        )

        # Adaptador PostgreSQL para snapshots
        # Implementa el puerto SnapshotRepository
        self.snapshot_repo = PostgresSnapshotRepo(
            session_factory=async_session_factory,
        )

        # Adaptador PostgreSQL para eventos
        # Implementa el puerto EventRepository
        self.event_repo = PostgresEventRepo(
            session_factory=async_session_factory,
        )

        # === CASOS DE USO (lógica de aplicación) ===

        # UseCase: Sincronizar estaciones desde GBFS → PostgreSQL
        self.sync_stations = SyncStationsUseCase(
            gbfs_port=self.gbfs_adapter,
            station_repo=self.station_repo,
        )

        # UseCase: Detectar eventos comparando snapshots
        self.detect_events = DetectEventsUseCase(
            snapshot_repo=self.snapshot_repo,
            event_repo=self.event_repo,
        )

        # UseCase: Recolectar status y detectar eventos
        self.collect_status = CollectStatusUseCase(
            gbfs_port=self.gbfs_adapter,
            snapshot_repo=self.snapshot_repo,
            detect_events=self.detect_events,
        )

        # Servicio de analítica
        self.analytics = AnalyticsService(
            station_repo=self.station_repo,
            snapshot_repo=self.snapshot_repo,
            event_repo=self.event_repo,
        )
