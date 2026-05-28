# =============================================================================
# MiBici Sonora — Schemas de la API (Pydantic)
# =============================================================================
# CAPA: Adaptadores → API
#
# Define los esquemas de RESPUESTA de la API usando Pydantic.
# Estos schemas controlan:
#   1. Qué campos se exponen al cliente
#   2. Qué tipos tienen (validación automática)
#   3. Cómo se serializan a JSON
#
# ¿Por qué Pydantic y no las entidades de dominio directamente?
#   Las entidades de dominio son dataclasses puras (sin serialización).
#   Los schemas de Pydantic agregan:
#   - Serialización automática a JSON
#   - Validación de tipos
#   - Documentación OpenAPI/Swagger
#   - Control preciso de qué campos exponer
#
# PRINCIPIO SOLID — Interface Segregation:
#   Los schemas de respuesta pueden DIFERIR de las entidades de dominio.
#   Ejemplo: no exponemos todos los campos internos al cliente.
# =============================================================================

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class StationResponse(BaseModel):
    """
    Schema de respuesta para una estación.

    Se usa en: GET /api/stations y GET /api/stations/{id}

    Incluye datos estáticos (nombre, ubicación) y opcionalmente
    el status actual (bikes, docks) si está disponible.
    """

    # Datos estáticos de la estación
    id: str = Field(description="ID único de la estación en el GBFS")
    name: str = Field(description="Nombre legible de la estación")
    short_name: str = Field(description="Código corto (e.g. GDL-001)")
    lat: float = Field(description="Latitud (WGS84)")
    lon: float = Field(description="Longitud (WGS84)")
    capacity: int = Field(description="Número total de docks")
    address: str = Field(description="Dirección legible", default="")
    region: str = Field(description="Zona geográfica (GDL, ZPN, TLQ)")

    # Status actual (opcional, solo si hay snapshots)
    bikes: Optional[int] = Field(
        default=None, description="Bicicletas disponibles ahora"
    )
    docks: Optional[int] = Field(
        default=None, description="Docks libres ahora"
    )
    disabled: Optional[int] = Field(
        default=None, description="Bicicletas deshabilitadas"
    )
    last_reported: Optional[datetime] = Field(
        default=None, description="Último reporte del GBFS"
    )


class SnapshotResponse(BaseModel):
    """
    Schema de respuesta para un snapshot.

    Se usa en: GET /api/stations/{id}/history
    """

    station_id: str = Field(description="ID de la estación")
    timestamp: datetime = Field(description="Momento del snapshot (UTC)")
    bikes: int = Field(description="Bicicletas disponibles")
    docks: int = Field(description="Docks libres")
    disabled: int = Field(description="Bicicletas deshabilitadas")
    is_renting: bool = Field(description="¿Permite rentar?")
    is_returning: bool = Field(description="¿Permite devolver?")


class EventResponse(BaseModel):
    """
    Schema de respuesta para un evento.

    Se usa en: GET /api/events/latest
    """

    station_id: str = Field(description="ID de la estación del evento")
    timestamp: datetime = Field(description="Momento del evento (UTC)")
    event_type: str = Field(description="Tipo: bike_taken o bike_returned")
    delta: int = Field(description="Número de bicis movidas")
    zone: str = Field(description="Zona geográfica (GDL, ZPN, TLQ)")


class HealthResponse(BaseModel):
    """
    Schema de respuesta para el health check.

    Se usa en: GET /api/health
    """

    status: str = Field(description="Estado del sistema", default="ok")
    stations: int = Field(description="Estaciones en la DB", default=0)
    message: str = Field(description="Mensaje informativo", default="")
