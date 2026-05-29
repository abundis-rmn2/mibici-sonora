# =============================================================================
# MiBici Sonora — Puertos (Interfaces) del Dominio
# =============================================================================
# CAPA: Dominio (núcleo)
#
# Este archivo define los PUERTOS del sistema: interfaces abstractas (ABC)
# que declaran QUÉ operaciones necesita el dominio, sin definir CÓMO.
#
# ARQUITECTURA HEXAGONAL — Puertos y Adaptadores:
#   - Un PUERTO es una interfaz que define un contrato.
#   - Un ADAPTADOR es una implementación concreta de ese puerto.
#
#   Ejemplo:
#     Puerto:    StationRepository.upsert_many(stations)
#     Adaptador: PostgresStationRepo (usa SQLAlchemy + PostgreSQL)
#     Adaptador: SQLiteStationRepo   (hipotético, para tests)
#     Adaptador: InMemoryStationRepo (hipotético, para tests)
#
# PRINCIPIO SOLID:
#   - Interface Segregation: cada puerto tiene UNA responsabilidad
#   - Dependency Inversion: los casos de uso dependen de ESTOS puertos,
#     nunca de las implementaciones concretas (PostgreSQL, httpx, etc.)
#
# ¿Qué ganamos con esto?
#   1. Podemos cambiar PostgreSQL por SQLite sin tocar los casos de uso
#   2. Podemos hacer tests con implementaciones fake (in-memory)
#   3. El dominio NUNCA sabe que existe PostgreSQL, httpx, o FastAPI
# =============================================================================

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from domain.entities import BikeEvent, Snapshot, Station


class GBFSPort(ABC):
    """
    Puerto de SALIDA: define cómo el sistema obtiene datos del GBFS.

    El caso de uso llama a estos métodos sin saber si los datos vienen
    de la API real de MiBici, de un archivo JSON local, o de un mock.

    Implementación real: adapters/gbfs_http_adapter.py (usa httpx)
    """

    @abstractmethod
    async def fetch_station_info(self) -> list[Station]:
        """
        Obtiene la información estática de TODAS las estaciones.

        Llama al endpoint /station_information del GBFS.
        Retorna una lista de entidades Station con nombre, coordenadas,
        capacidad y zona derivada del short_name.

        Returns:
            Lista de Station (~300 estaciones en MiBici Guadalajara)
        """
        ...

    @abstractmethod
    async def fetch_station_status(self) -> list[Snapshot]:
        """
        Obtiene el estado actual de TODAS las estaciones.

        Llama al endpoint /station_status del GBFS.
        Retorna una lista de Snapshots con bikes, docks y disabled
        para cada estación en ese momento.

        Returns:
            Lista de Snapshot (~300, uno por estación)
        """
        ...


class StationRepository(ABC):
    """
    Puerto de SALIDA: persistencia de estaciones.

    Define las operaciones de lectura/escritura para la tabla de estaciones.
    Las estaciones son datos estáticos que se actualizan cada ~4 horas.

    Implementación real: adapters/postgres_repos.py → PostgresStationRepo
    """

    @abstractmethod
    async def upsert_many(self, stations: list[Station]) -> int:
        """
        Inserta o actualiza múltiples estaciones en batch.

        "Upsert" = INSERT si no existe, UPDATE si ya existe.
        Esto es idempotente: puedes ejecutarlo múltiples veces
        sin crear duplicados.

        Args:
            stations: Lista de estaciones a insertar/actualizar

        Returns:
            Número de estaciones procesadas
        """
        ...

    @abstractmethod
    async def get_all(self) -> list[Station]:
        """
        Obtiene TODAS las estaciones.

        Returns:
            Lista completa de estaciones (~300)
        """
        ...

    @abstractmethod
    async def get_by_id(self, station_id: str) -> Optional[Station]:
        """
        Obtiene una estación por su ID.

        Args:
            station_id: ID de la estación (e.g. "2", "3")

        Returns:
            La estación encontrada, o None si no existe
        """
        ...


class SnapshotRepository(ABC):
    """
    Puerto de SALIDA: persistencia de snapshots.

    Los snapshots son el dato más voluminoso del sistema.
    ~300 registros cada 30 segundos = ~864,000 registros por día.

    Implementación real: adapters/postgres_repos.py → PostgresSnapshotRepo
    """

    @abstractmethod
    async def insert_many(self, snapshots: list[Snapshot]) -> int:
        """
        Inserta múltiples snapshots en batch.

        Cada snapshot es inmutable: nunca se actualiza, solo se inserta.

        Args:
            snapshots: Lista de snapshots a insertar

        Returns:
            Número de snapshots insertados
        """
        ...

    @abstractmethod
    async def get_latest_by_station(self) -> dict[str, Snapshot]:
        """
        Obtiene el ÚLTIMO snapshot de CADA estación.

        Esto es crucial para la detección de eventos:
        comparamos el snapshot actual con el anterior para detectar deltas.

        Returns:
            Diccionario {station_id: último_snapshot}
        """
        ...

    @abstractmethod
    async def get_history(
        self,
        station_id: str,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Snapshot]:
        """
        Obtiene el historial de snapshots de una estación específica.

        Ordenados por timestamp descendente (más reciente primero).

        Args:
            station_id: ID de la estación
            limit:      Máximo de resultados (default 100)
            offset:     Desplazamiento para paginación

        Returns:
            Lista de snapshots ordenados por fecha descendente
        """
        ...


class EventRepository(ABC):
    """
    Puerto de SALIDA: persistencia de eventos detectados.

    Los eventos (bike_taken, bike_returned) son el dato más valioso
    del sistema. Se generan por la detección de deltas entre snapshots.

    Implementación real: adapters/postgres_repos.py → PostgresEventRepo
    """

    @abstractmethod
    async def insert_many(self, events: list[BikeEvent]) -> int:
        """
        Inserta múltiples eventos en batch.

        Args:
            events: Lista de eventos detectados

        Returns:
            Número de eventos insertados
        """
        ...

    @abstractmethod
    async def get_latest(self, limit: int = 50) -> list[BikeEvent]:
        """
        Obtiene los eventos más recientes.

        Ordenados por timestamp descendente.

        Args:
            limit: Máximo de eventos a retornar (default 50, max 200)

        Returns:
            Lista de eventos recientes
        """
        ...

    @abstractmethod
    async def get_by_station(
        self,
        station_id: str,
        limit: int = 50,
    ) -> list[BikeEvent]:
        """
        Obtiene los eventos de una estación específica.

        Args:
            station_id: ID de la estación
            limit:      Máximo de resultados

        Returns:
            Lista de eventos de esa estación
        """
        ...

    @abstractmethod
    async def get_events_summary(
        self,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> dict[str, dict[str, int]]:
        """
        Obtiene el conteo total de bicicletas tomadas y devueltas por estación.
        Retorna { station_id: {"taken": int, "returned": int} }
        """
        ...

    @abstractmethod
    async def get_mass_movements(
        self,
        threshold: int = 8,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> list[BikeEvent]:
        """
        Obtiene eventos donde el delta > threshold (movimientos por camión de balanceo).
        """
        ...
