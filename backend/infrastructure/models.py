# =============================================================================
# MiBici Sonora — Modelos ORM (SQLAlchemy)
# =============================================================================
# CAPA: Infraestructura
#
# Este archivo define los MODELOS ORM: la representación de las tablas
# de PostgreSQL como clases de Python.
#
# ARQUITECTURA HEXAGONAL:
#   Estos modelos son INFRAESTRUCTURA, NO dominio.
#   Las entidades de dominio (entities.py) son dataclasses puras.
#   Los adaptadores (postgres_repos.py) convierten entre modelos ORM
#   y entidades de dominio.
#
#   Flujo:
#     API GBFS → Entidad Station → PostgresStationRepo → StationModel → PostgreSQL
#     PostgreSQL → StationModel → PostgresStationRepo → Entidad Station → UseCase
#
# ¿Por qué separar modelos ORM de entidades de dominio?
#   1. El dominio no sabe que existe PostgreSQL
#   2. Podemos cambiar la DB sin tocar el dominio
#   3. Los modelos ORM tienen detalles de SQLAlchemy (Column, ForeignKey)
#      que NO pertenecen al dominio
#
# TABLAS:
#   - stations:  Información estática de estaciones (~300 registros)
#   - snapshots: Estado dinámico por estación (~864K registros/día)
#   - events:    Eventos detectados (bike_taken/bike_returned)
# =============================================================================

from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    Index,
    Integer,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.database import Base


class StationModel(Base):
    """
    Modelo ORM para la tabla 'stations'.

    Almacena la información ESTÁTICA de cada estación de MiBici.
    Se actualiza cada ~4 horas desde station_information del GBFS.

    La columna 'geom' usa PostGIS para almacenar la ubicación como
    un punto geográfico. Esto permite consultas espaciales como:
    "¿Qué estaciones están a menos de 500m de este punto?"

    Corresponde a la entidad de dominio: domain.entities.Station
    """

    __tablename__ = "stations"

    # ID de la estación del GBFS (e.g. "2", "3", "4")
    # Es string porque así lo define el estándar GBFS
    id: Mapped[str] = mapped_column(Text, primary_key=True)

    # Nombre legible de la estación (e.g. "GDL-001")
    name: Mapped[str] = mapped_column(Text, nullable=False)

    # Código corto con prefijo de zona (e.g. "GDL-001", "ZPN-005")
    short_name: Mapped[str] = mapped_column(Text, default="")

    # Coordenadas geográficas (WGS84)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)

    # Capacidad total de docks (anclajes) en la estación
    capacity: Mapped[int] = mapped_column(Integer, default=0)

    # Dirección legible y código postal
    address: Mapped[str] = mapped_column(Text, default="")
    post_code: Mapped[str] = mapped_column(Text, default="")

    # Zona derivada del short_name ("GDL", "ZPN", "TLQ")
    # Se calcula automáticamente en la entidad de dominio
    region: Mapped[str] = mapped_column(Text, default="")

    # Punto geográfico PostGIS para consultas espaciales.
    # SRID 4326 = sistema de coordenadas WGS84 (el estándar GPS).
    # nullable=True porque se calcula después del insert inicial.
    geom = mapped_column(
        Geometry("POINT", srid=4326),
        nullable=True,
    )


class SnapshotModel(Base):
    """
    Modelo ORM para la tabla 'snapshots'.

    Almacena el ESTADO de cada estación en cada momento de polling.
    Es la tabla más grande del sistema: ~300 registros cada 30 segundos.

    INMUTABLE: los snapshots nunca se modifican, solo se insertan.
    Esto permite reconstruir la historia completa de cualquier estación.

    Corresponde a la entidad de dominio: domain.entities.Snapshot
    """

    __tablename__ = "snapshots"

    # ID autoincremental (BigInteger porque habrá MUCHOS registros)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ID de la estación (referencia a stations.id)
    station_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)

    # Momento del snapshot (timezone-aware, viene en UTC del GBFS)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Bicicletas disponibles para rentar
    # (campo 'num_vehicles_available' del GBFS)
    bikes: Mapped[int] = mapped_column(Integer, default=0)

    # Docks libres para devolver bicis
    # (campo 'num_docks_available' del GBFS)
    docks: Mapped[int] = mapped_column(Integer, default=0)

    # Bicicletas deshabilitadas (en mantenimiento)
    # (campo 'num_vehicles_disabled' del GBFS)
    disabled: Mapped[int] = mapped_column(Integer, default=0)

    # ¿La estación permite rentar bicis en este momento?
    is_renting: Mapped[bool] = mapped_column(Boolean, default=True)

    # ¿La estación permite devolver bicis en este momento?
    is_returning: Mapped[bool] = mapped_column(Boolean, default=True)

    # ---------------------------------------------------------------------------
    # Índice compuesto: optimiza la consulta más frecuente del sistema:
    # "Dame el último snapshot de la estación X"
    #
    # Sin este índice, PostgreSQL tendría que escanear TODA la tabla
    # para encontrar el snapshot más reciente de una estación.
    # Con el índice, la búsqueda es instantánea.
    # ---------------------------------------------------------------------------
    __table_args__ = (
        Index("ix_snapshots_station_timestamp", "station_id", "timestamp"),
    )


class EventModel(Base):
    """
    Modelo ORM para la tabla 'events'.

    Almacena los EVENTOS detectados por el sistema de detección de deltas.
    Cada evento representa una bici tomada o devuelta en una estación.

    Tipos de evento:
      - "bike_taken":    alguien tomó una bici (bikes bajó)
      - "bike_returned": alguien devolvió una bici (bikes subió)

    Corresponde a la entidad de dominio: domain.entities.BikeEvent
    """

    __tablename__ = "events"

    # ID autoincremental
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ID de la estación donde ocurrió el evento
    station_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)

    # Momento del evento
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Tipo de evento: "bike_taken" o "bike_returned"
    event_type: Mapped[str] = mapped_column(Text, nullable=False)

    # Cantidad de bicis movidas (siempre positivo)
    # Si delta=3, se tomaron/devolvieron 3 bicis a la vez
    delta: Mapped[int] = mapped_column(Integer, default=1)

    # Zona geográfica de la estación ("GDL", "ZPN", "TLQ")
    zone: Mapped[str] = mapped_column(Text, default="")

    # ---------------------------------------------------------------------------
    # Índice compuesto: optimiza consultas de eventos por tiempo y tipo.
    # Ejemplo: "¿Cuántas bike_taken hubo en la última hora?"
    # ---------------------------------------------------------------------------
    __table_args__ = (
        Index("ix_events_timestamp_type", "timestamp", "event_type"),
    )
