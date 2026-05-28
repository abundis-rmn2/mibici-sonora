# =============================================================================
# MiBici Sonora — Entidades de Dominio
# =============================================================================
# CAPA: Dominio (núcleo)
#
# Este archivo define las ENTIDADES del sistema: los objetos de datos puros
# que representan los conceptos fundamentales del negocio.
#
# ARQUITECTURA HEXAGONAL:
#   Las entidades son el corazón del sistema. No dependen de NADA externo:
#   - No importan SQLAlchemy (eso es infraestructura)
#   - No importan FastAPI (eso es un adaptador)
#   - No importan httpx (eso es un adaptador)
#   Solo usan tipos estándar de Python (dataclasses, datetime, etc.)
#
# PRINCIPIO SOLID — Single Responsibility:
#   Cada entidad representa UN solo concepto del dominio de MiBici.
#
# ¿Por qué dataclasses y no Pydantic?
#   Las entidades de dominio deben ser PURAS. Pydantic agrega validación
#   y serialización que corresponden a la capa de adaptadores, no al dominio.
#   Usaremos Pydantic en los schemas de la API (adapters/api/schemas.py).
# =============================================================================

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class Station:
    """
    Representa una estación física de bicicletas MiBici.

    Datos estáticos que cambian rara vez (se sincronizan cada ~4 horas).
    Cada estación tiene una ubicación geográfica (lat/lon) y una capacidad
    máxima de docks (anclajes) para bicicletas.

    Atributos:
        id:         Identificador único del GBFS (e.g. "2", "3", "4")
        name:       Nombre legible (e.g. "GDL-001")
        short_name: Código corto con prefijo de zona (e.g. "GDL-001", "ZPN-005")
        lat:        Latitud en grados decimales (WGS84)
        lon:        Longitud en grados decimales (WGS84)
        capacity:   Número total de docks (anclajes) en la estación
        address:    Dirección legible (e.g. "Av. Juárez 100")
        post_code:  Código postal
        region:     Zona derivada del short_name ("GDL", "ZPN", "TLQ")
                    Se extrae automáticamente del prefijo del short_name.
    """

    id: str
    name: str
    short_name: str = ""
    lat: float = 0.0
    lon: float = 0.0
    capacity: int = 0
    address: str = ""
    post_code: str = ""
    region: str = ""

    def __post_init__(self):
        """
        Después de crear la estación, extrae la región del short_name.

        Ejemplo:
            short_name = "GDL-001" → region = "GDL" (Guadalajara)
            short_name = "ZPN-005" → region = "ZPN" (Zapopan)
            short_name = "TLQ-003" → region = "TLQ" (Tlaquepaque)
        """
        if self.short_name and not self.region:
            # El prefijo antes del guión es la zona/municipio
            parts = self.short_name.split("-")
            if len(parts) >= 1:
                self.region = parts[0]


@dataclass
class Snapshot:
    """
    Representa el ESTADO de una estación en un momento específico.

    Los snapshots son datos dinámicos que se recolectan cada ~30 segundos.
    Cada snapshot es INMUTABLE: una vez guardado, nunca se modifica.
    Esto nos permite reconstruir la historia completa de cada estación.

    Atributos:
        station_id:   ID de la estación (FK a Station.id)
        timestamp:    Momento exacto del snapshot (UTC del GBFS)
        bikes:        Bicicletas disponibles (num_vehicles_available del GBFS)
        docks:        Docks libres (num_docks_available del GBFS)
        disabled:     Bicicletas deshabilitadas (num_vehicles_disabled del GBFS)
        is_renting:   ¿La estación permite rentar bicis ahora?
        is_returning: ¿La estación permite devolver bicis ahora?
    """

    station_id: str
    timestamp: datetime
    bikes: int = 0
    docks: int = 0
    disabled: int = 0
    is_renting: bool = True
    is_returning: bool = True


@dataclass
class BikeEvent:
    """
    Representa un EVENTO detectado: una bici fue tomada o devuelta.

    Los eventos se generan comparando dos snapshots consecutivos de la
    misma estación. Si bikes bajó → bike_taken. Si subió → bike_returned.

    Este es el dato más valioso del sistema: nos permite:
    - Visualizar el flujo de bicicletas en tiempo real
    - Detectar patrones de uso (rush hour, zonas populares)
    - Generar sonificación artística (cada evento = un sonido)

    Atributos:
        station_id:  ID de la estación donde ocurrió el evento
        timestamp:   Momento del evento (timestamp del snapshot actual)
        event_type:  "bike_taken" o "bike_returned"
        delta:       Cantidad de bicis movidas (siempre positivo)
                     Ejemplo: delta=3 significa que se tomaron/devolvieron 3 bicis
        zone:        Zona de la estación ("GDL", "ZPN", "TLQ")
                     Útil para sonificación por zona geográfica
    """

    station_id: str
    timestamp: datetime
    event_type: str  # "bike_taken" | "bike_returned"
    delta: int = 1
    zone: str = ""
