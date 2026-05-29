# =============================================================================
# MiBici Sonora — Adaptadores PostgreSQL (Repositorios)
# =============================================================================
# CAPA: Adaptadores (infraestructura externa)
#
# Estos adaptadores IMPLEMENTAN los puertos de repositorio definidos
# en domain/ports.py. Su responsabilidad es traducir operaciones de
# dominio a queries SQL de PostgreSQL via SQLAlchemy.
#
# ARQUITECTURA HEXAGONAL:
#   Estos son ADAPTADORES DE SALIDA (driven adapters):
#   - Los casos de uso llaman al puerto: station_repo.upsert_many(...)
#   - El puerto está implementado por PostgresStationRepo
#   - Este adaptador ejecuta el SQL real contra PostgreSQL
#
# PRINCIPIO SOLID:
#   - Single Responsibility: cada clase = una tabla
#   - Interface Segregation: StationRepo, SnapshotRepo, EventRepo separados
#   - Liskov Substitution: intercambiables con repos in-memory para tests
#
# CONVERSIÓN ENTRE CAPAS:
#   Entidad de dominio ←→ Modelo ORM
#   Station (dataclass) ←→ StationModel (SQLAlchemy)
#
#   Los métodos _to_model() y _to_entity() hacen esta conversión.
#   El dominio NUNCA ve los modelos ORM.
# =============================================================================

import logging
from datetime import datetime, timezone
from typing import Optional

from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from sqlalchemy import delete, desc, func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from domain.entities import BikeEvent, Snapshot, Station
from domain.ports import EventRepository, SnapshotRepository, StationRepository
from infrastructure.models import EventModel, SnapshotModel, StationModel

logger = logging.getLogger(__name__)


class PostgresStationRepo(StationRepository):
    """
    Implementación PostgreSQL del puerto StationRepository.

    Maneja la persistencia de estaciones en la tabla 'stations'.
    Usa upsert (INSERT ... ON CONFLICT UPDATE) para idempotencia.

    Args:
        session_factory: Fábrica de sesiones async de SQLAlchemy
    """

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        """
        Inicializa el repositorio con la fábrica de sesiones.

        La session_factory se inyecta desde el contenedor DI.
        No creamos la sesión aquí; cada operación crea su propia sesión.
        """
        self._session_factory = session_factory

    async def upsert_many(self, stations: list[Station]) -> int:
        """
        Inserta o actualiza estaciones en batch.

        Usa la operación UPSERT de PostgreSQL:
        - Si la estación NO existe → INSERT
        - Si ya existe (mismo id) → UPDATE con los datos nuevos

        Esto es IDEMPOTENTE: ejecutar múltiples veces da el mismo resultado.

        También calcula el punto PostGIS (geom) a partir de lat/lon.

        Args:
            stations: Lista de entidades Station del dominio

        Returns:
            Número de estaciones procesadas
        """
        if not stations:
            return 0

        async with self._session_factory() as session:
            for station in stations:
                # Preparar el INSERT con ON CONFLICT (upsert de PostgreSQL)
                stmt = pg_insert(StationModel).values(
                    id=station.id,
                    name=station.name,
                    short_name=station.short_name,
                    lat=station.lat,
                    lon=station.lon,
                    capacity=station.capacity,
                    address=station.address,
                    post_code=station.post_code,
                    region=station.region,
                    # Crear punto PostGIS: ST_SetSRID(ST_MakePoint(lon, lat), 4326)
                    # NOTA: PostGIS usa (lon, lat), no (lat, lon)
                    geom=func.ST_SetSRID(
                        func.ST_MakePoint(station.lon, station.lat), 4326
                    ),
                )

                # ON CONFLICT: si ya existe un registro con el mismo id,
                # actualizar TODOS los campos con los valores nuevos.
                stmt = stmt.on_conflict_do_update(
                    index_elements=["id"],
                    set_={
                        "name": station.name,
                        "short_name": station.short_name,
                        "lat": station.lat,
                        "lon": station.lon,
                        "capacity": station.capacity,
                        "address": station.address,
                        "post_code": station.post_code,
                        "region": station.region,
                        "geom": func.ST_SetSRID(
                            func.ST_MakePoint(station.lon, station.lat), 4326
                        ),
                    },
                )

                await session.execute(stmt)

            # Confirmar TODOS los cambios en una sola transacción
            await session.commit()

        logger.info(f"✅ Upsert completado: {len(stations)} estaciones")
        return len(stations)

    async def get_all(self) -> list[Station]:
        """
        Obtiene todas las estaciones de la base de datos.

        Returns:
            Lista de entidades Station ordenadas por id
        """
        async with self._session_factory() as session:
            result = await session.execute(
                select(StationModel).order_by(StationModel.id)
            )
            models = result.scalars().all()

            # Convertir modelos ORM a entidades de dominio
            return [self._to_entity(m) for m in models]

    async def get_by_id(self, station_id: str) -> Optional[Station]:
        """
        Obtiene una estación por su ID.

        Args:
            station_id: ID de la estación (e.g. "2", "3")

        Returns:
            Entidad Station o None si no existe
        """
        async with self._session_factory() as session:
            result = await session.execute(
                select(StationModel).where(StationModel.id == station_id)
            )
            model = result.scalar_one_or_none()

            if model is None:
                return None
            return self._to_entity(model)

    @staticmethod
    def _to_entity(model: StationModel) -> Station:
        """
        Convierte un modelo ORM (StationModel) a una entidad de dominio (Station).

        Esta conversión es necesaria porque el dominio NO debe saber
        que existe SQLAlchemy. Solo trabaja con dataclasses puras.
        """
        return Station(
            id=model.id,
            name=model.name,
            short_name=model.short_name,
            lat=model.lat,
            lon=model.lon,
            capacity=model.capacity,
            address=model.address,
            post_code=model.post_code,
            region=model.region,
        )


class PostgresSnapshotRepo(SnapshotRepository):
    """
    Implementación PostgreSQL del puerto SnapshotRepository.

    Maneja la persistencia de snapshots en la tabla 'snapshots'.
    Los snapshots son INMUTABLES: solo se insertan, nunca se actualizan.

    Args:
        session_factory: Fábrica de sesiones async de SQLAlchemy
    """

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory

    async def insert_many(self, snapshots: list[Snapshot]) -> int:
        """
        Inserta múltiples snapshots en batch.

        Cada snapshot representa el estado de una estación en un momento dado.
        Son inmutables: una vez insertados, no se modifican.

        Args:
            snapshots: Lista de entidades Snapshot del dominio

        Returns:
            Número de snapshots insertados
        """
        if not snapshots:
            return 0

        async with self._session_factory() as session:
            # Construir la lista de diccionarios para inserción masiva.
            # Esto es MUCHO más eficiente que insertar uno por uno.
            values = [
                {
                    "station_id": s.station_id,
                    "timestamp": s.timestamp,
                    "bikes": s.bikes,
                    "docks": s.docks,
                    "disabled": s.disabled,
                    "is_renting": s.is_renting,
                    "is_returning": s.is_returning,
                }
                for s in snapshots
            ]

            # INSERT masivo: una sola query para todos los snapshots
            await session.execute(
                SnapshotModel.__table__.insert(),
                values,
            )
            await session.commit()

        logger.info(f"✅ Insertados {len(snapshots)} snapshots")
        return len(snapshots)

    async def get_latest_by_station(self) -> dict[str, Snapshot]:
        """
        Obtiene el ÚLTIMO snapshot de CADA estación.

        Esta es la consulta más importante del sistema: necesitamos
        el snapshot anterior para comparar con el actual y detectar
        eventos (bike_taken, bike_returned).

        Usa DISTINCT ON de PostgreSQL: para cada station_id, retorna
        solo la fila con el timestamp más reciente.

        Returns:
            Diccionario {station_id: último_snapshot}
        """
        async with self._session_factory() as session:
            # Usar LATERAL JOIN en lugar de DISTINCT ON.
            # DISTINCT ON sin Skip Scan escanea toda la tabla (millones de filas).
            # Con LATERAL JOIN, PostgreSQL hace ~300 búsquedas indexadas ultrarrápidas.
            raw_sql = text("""
                SELECT sn.*
                FROM stations st
                CROSS JOIN LATERAL (
                    SELECT *
                    FROM snapshots
                    WHERE station_id = st.id
                    ORDER BY timestamp DESC
                    LIMIT 1
                ) sn
            """)
            
            stmt = select(SnapshotModel).from_statement(raw_sql)

            result = await session.execute(stmt)
            models = result.scalars().all()

            # Construir diccionario station_id → Snapshot
            return {
                m.station_id: self._to_entity(m)
                for m in models
            }

    async def get_history(
        self,
        station_id: str,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Snapshot]:
        """
        Obtiene el historial de snapshots de una estación.

        Ordenados por timestamp descendente (más reciente primero).
        Soporta paginación con limit/offset.

        Args:
            station_id: ID de la estación
            limit: Máximo de resultados (default 100)
            offset: Desplazamiento para paginación

        Returns:
            Lista de snapshots
        """
        async with self._session_factory() as session:
            stmt = (
                select(SnapshotModel)
                .where(SnapshotModel.station_id == station_id)
                .order_by(desc(SnapshotModel.timestamp))
                .limit(limit)
                .offset(offset)
            )

            result = await session.execute(stmt)
            models = result.scalars().all()

            return [self._to_entity(m) for m in models]

    async def get_volatility_by_station(self) -> list[dict]:
        """
        Calcula el índice de volatilidad (STDDEV) de bicicletas por estación.

        Usado por el Índice de Presión Multimodal: alta volatilidad = estación
        que se llena y vacía constantemente = estrés de última milla.

        Returns:
            Lista de {station_id, volatility_index} ordenada de mayor a menor
        """
        async with self._session_factory() as session:
            raw = text("""
                WITH hourly AS (
                    SELECT station_id,
                           date_trunc('hour', timestamp) as hour,
                           AVG(bikes) as avg_bikes
                    FROM snapshots
                    WHERE timestamp > NOW() - INTERVAL '7 days'
                    GROUP BY station_id, date_trunc('hour', timestamp)
                )
                SELECT station_id,
                       STDDEV(avg_bikes) as volatility_index,
                       AVG(avg_bikes)    as mean_bikes,
                       COUNT(*)          as sample_hours
                FROM hourly
                GROUP BY station_id
                HAVING COUNT(*) >= 5
                ORDER BY volatility_index DESC NULLS LAST
            """)
            result = await session.execute(raw)
            rows = result.mappings().all()
            return [
                {
                    "station_id": r["station_id"],
                    "volatility_index": float(r["volatility_index"] or 0),
                    "mean_bikes": float(r["mean_bikes"] or 0),
                    "sample_hours": int(r["sample_hours"]),
                }
                for r in rows
            ]

    @staticmethod
    def _to_entity(model: SnapshotModel) -> Snapshot:
        """Convierte modelo ORM → entidad de dominio."""
        return Snapshot(
            station_id=model.station_id,
            timestamp=model.timestamp,
            bikes=model.bikes,
            docks=model.docks,
            disabled=model.disabled,
            is_renting=model.is_renting,
            is_returning=model.is_returning,
        )


class PostgresEventRepo(EventRepository):
    """
    Implementación PostgreSQL del puerto EventRepository.

    Maneja la persistencia de eventos detectados en la tabla 'events'.
    Los eventos se generan por el caso de uso DetectEventsUseCase.

    Args:
        session_factory: Fábrica de sesiones async de SQLAlchemy
    """

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory

    async def insert_many(self, events: list[BikeEvent]) -> int:
        """
        Inserta múltiples eventos en batch.

        Args:
            events: Lista de eventos detectados

        Returns:
            Número de eventos insertados
        """
        if not events:
            return 0

        async with self._session_factory() as session:
            values = [
                {
                    "station_id": e.station_id,
                    "timestamp": e.timestamp,
                    "event_type": e.event_type,
                    "delta": e.delta,
                    "zone": e.zone,
                }
                for e in events
            ]

            await session.execute(
                EventModel.__table__.insert(),
                values,
            )
            await session.commit()

        logger.info(f"✅ Insertados {len(events)} eventos")
        return len(events)

    async def get_latest(self, limit: int = 50) -> list[BikeEvent]:
        """
        Obtiene los eventos más recientes del sistema.

        Args:
            limit: Máximo de eventos (default 50, máximo 200)

        Returns:
            Lista de eventos ordenados por fecha descendente
        """
        # Limitar a 200 máximo para evitar queries pesadas
        limit = min(limit, 200)

        async with self._session_factory() as session:
            stmt = (
                select(EventModel)
                .order_by(desc(EventModel.timestamp))
                .limit(limit)
            )

            result = await session.execute(stmt)
            models = result.scalars().all()

            return [self._to_entity(m) for m in models]

    async def get_by_station(
        self,
        station_id: str,
        limit: int = 50,
    ) -> list[BikeEvent]:
        """
        Obtiene los eventos de una estación específica.

        Args:
            station_id: ID de la estación
            limit: Máximo de resultados

        Returns:
            Lista de eventos
        """
        async with self._session_factory() as session:
            stmt = (
                select(EventModel)
                .where(EventModel.station_id == station_id)
                .order_by(desc(EventModel.timestamp))
                .limit(limit)
            )

            result = await session.execute(stmt)
            models = result.scalars().all()

            return [self._to_entity(m) for m in models]

    async def get_events_summary(
        self,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> dict[str, dict[str, int]]:
        async with self._session_factory() as session:
            stmt = select(
                EventModel.station_id,
                EventModel.event_type,
                func.sum(EventModel.delta).label("total")
            )
            if start:
                stmt = stmt.where(EventModel.timestamp >= start)
            if end:
                stmt = stmt.where(EventModel.timestamp <= end)
            
            stmt = stmt.group_by(EventModel.station_id, EventModel.event_type)
            result = await session.execute(stmt)
            
            summary = {}
            for row in result.all():
                sid, etype, total = row
                if sid not in summary:
                    summary[sid] = {"taken": 0, "returned": 0}
                if etype == "bike_taken":
                    summary[sid]["taken"] += total
                elif etype == "bike_returned":
                    summary[sid]["returned"] += total
                    
            return summary

    async def get_mass_movements(
        self,
        threshold: int = 8,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> list[BikeEvent]:
        async with self._session_factory() as session:
            stmt = select(EventModel).where(EventModel.delta > threshold)
            if start:
                stmt = stmt.where(EventModel.timestamp >= start)
            if end:
                stmt = stmt.where(EventModel.timestamp <= end)
                
            stmt = stmt.order_by(desc(EventModel.timestamp))
            result = await session.execute(stmt)
            return [self._to_entity(m) for m in result.scalars().all()]

    async def get_events_by_hour_range(
        self,
        hour_start: int,
        hour_end: int,
    ) -> list[BikeEvent]:
        """
        Obtiene eventos dentro de un rango horario (hora del día).

        Usado por get_urban_metabolism para calcular flujo neto
        en ventanas como "mañana 7-10h" o "tarde 17-20h".

        Args:
            hour_start: Hora de inicio (0-23)
            hour_end: Hora de fin (0-23, inclusive)

        Returns:
            Lista de eventos en ese rango horario
        """
        async with self._session_factory() as session:
            raw = text("""
                SELECT * FROM events
                WHERE EXTRACT(HOUR FROM timestamp AT TIME ZONE 'America/Mexico_City')
                      BETWEEN :h_start AND :h_end
                ORDER BY timestamp DESC
                LIMIT 5000
            """)
            result = await session.execute(raw, {"h_start": hour_start, "h_end": hour_end})
            rows = result.mappings().all()
            return [
                BikeEvent(
                    station_id=r["station_id"],
                    timestamp=r["timestamp"],
                    event_type=r["event_type"],
                    delta=r["delta"],
                    zone=r["zone"],
                )
                for r in rows
            ]

    @staticmethod
    def _to_entity(model: EventModel) -> BikeEvent:
        """Convierte modelo ORM → entidad de dominio."""
        return BikeEvent(
            station_id=model.station_id,
            timestamp=model.timestamp,
            event_type=model.event_type,
            delta=model.delta,
            zone=model.zone,
        )
