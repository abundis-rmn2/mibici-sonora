# =============================================================================
# MiBici Sonora — Adaptador HTTP para GBFS
# =============================================================================
# CAPA: Adaptadores (infraestructura externa)
#
# Este adaptador IMPLEMENTA el puerto GBFSPort definido en domain/ports.py.
# Su responsabilidad es conectarse a la API real de MiBici y convertir
# los datos JSON en entidades de dominio (Station, Snapshot).
#
# ARQUITECTURA HEXAGONAL:
#   Este es un ADAPTADOR DE SALIDA (driven adapter):
#   - El caso de uso llama al puerto: gbfs_port.fetch_station_info()
#   - El puerto está implementado por ESTE adaptador
#   - Este adaptador hace la petición HTTP real a la API de MiBici
#
#   El caso de uso NO sabe que existe httpx, ni HTTP, ni JSON.
#   Solo sabe que recibe una lista de Station.
#
# PRINCIPIO SOLID:
#   - Single Responsibility: solo se encarga de HTTP + parseo GBFS
#   - Liskov Substitution: se puede reemplazar por un mock para tests
#   - Open/Closed: si la API cambia, solo se modifica ESTE archivo
# =============================================================================

import logging
from datetime import datetime, timezone

import httpx

from domain.entities import Snapshot, Station
from domain.ports import GBFSPort

# Logger con nombre del módulo para identificar mensajes en los logs
logger = logging.getLogger(__name__)


class GBFSHttpAdapter(GBFSPort):
    """
    Adaptador que consume la API GBFS de MiBici via HTTP.

    Implementa el puerto GBFSPort: convierte respuestas JSON del GBFS
    en entidades de dominio puras (Station, Snapshot).

    Args:
        base_url: URL base del feed GBFS (e.g. "https://...gbfs/v3.0")
    """

    def __init__(self, base_url: str):
        """
        Inicializa el adaptador con la URL base del GBFS.

        Args:
            base_url: URL base sin trailing slash.
                      Ejemplo: "https://guadalajara.publicbikesystem.net/customer/gbfs/v3.0"
        """
        # Guardar la URL base (sin trailing slash para construir endpoints)
        self._base_url = base_url.rstrip("/")

    async def fetch_station_info(self) -> list[Station]:
        """
        Consulta el endpoint /station_information y retorna entidades Station.

        Este endpoint contiene datos ESTÁTICOS de las estaciones:
        nombre, coordenadas, capacidad, dirección, etc.
        Cambia muy rara vez (cuando agregan/quitan estaciones físicas).

        Proceso:
        1. Hace GET a /station_information
        2. Parsea el JSON de respuesta
        3. Para cada estación, extrae el nombre en español
        4. Crea una entidad Station de dominio
        5. Retorna la lista completa

        Returns:
            Lista de ~300 entidades Station

        Raises:
            httpx.HTTPError: si la petición HTTP falla
        """
        # Construir la URL completa del endpoint
        url = f"{self._base_url}/station_information"
        logger.info(f"📡 Consultando station_information: {url}")

        # Crear un cliente HTTP temporal para esta petición.
        # async with garantiza que se cierre la conexión al terminar.
        # timeout=30: si no hay respuesta en 30 segundos, falla.
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url)
            # Lanzar excepción si el status code no es 2xx
            response.raise_for_status()

        # Parsear la respuesta JSON
        data = response.json()

        # El GBFS envuelve los datos en {"data": {"stations": [...]}}
        raw_stations = data.get("data", {}).get("stations", [])
        logger.info(f"📊 Recibidas {len(raw_stations)} estaciones del GBFS")

        # Convertir cada estación JSON en una entidad de dominio
        stations: list[Station] = []
        for raw in raw_stations:
            # Extraer el nombre en español del array multilingüe.
            # El GBFS retorna: "name": [{"text": "GDL-001", "language": "es"}, ...]
            # Buscamos el que tiene language="es". Si no existe, usamos el primero.
            name = self._extract_spanish_text(raw.get("name", []))

            # Extraer el short_name (código como "GDL-001", "ZPN-005")
            short_name = self._extract_spanish_text(raw.get("short_name", []))

            # Crear la entidad Station.
            # El __post_init__ de Station extrae automáticamente la región
            # del short_name (e.g. "GDL-001" → region="GDL")
            station = Station(
                id=str(raw.get("station_id", "")),
                name=name,
                short_name=short_name,
                lat=float(raw.get("lat", 0.0)),
                lon=float(raw.get("lon", 0.0)),
                capacity=int(raw.get("capacity", 0)),
                address=str(raw.get("address", "")),
                post_code=str(raw.get("post_code", "")),
            )
            stations.append(station)

        logger.info(
            f"✅ Parseadas {len(stations)} estaciones. "
            f"Regiones: {set(s.region for s in stations if s.region)}"
        )
        return stations

    async def fetch_station_status(self) -> list[Snapshot]:
        """
        Consulta el endpoint /station_status y retorna entidades Snapshot.

        Este endpoint contiene datos DINÁMICOS de las estaciones:
        bicicletas disponibles, docks libres, bicicletas deshabilitadas.
        Se actualiza cada ~30 segundos.

        Proceso:
        1. Hace GET a /station_status
        2. Parsea el JSON de respuesta
        3. Convierte cada status en una entidad Snapshot
        4. Normaliza los campos del GBFS a nuestro dominio

        Mapeo de campos GBFS → dominio:
            num_vehicles_available → bikes
            num_docks_available    → docks
            num_vehicles_disabled  → disabled

        Returns:
            Lista de ~300 entidades Snapshot

        Raises:
            httpx.HTTPError: si la petición HTTP falla
        """
        url = f"{self._base_url}/station_status"
        logger.info(f"📡 Consultando station_status: {url}")

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url)
            response.raise_for_status()

        data = response.json()
        raw_statuses = data.get("data", {}).get("stations", [])
        logger.info(f"📊 Recibidos {len(raw_statuses)} status del GBFS")

        # Convertir cada status JSON en un Snapshot de dominio
        snapshots: list[Snapshot] = []
        for raw in raw_statuses:
            # Parsear el timestamp del GBFS.
            # Viene en formato ISO 8601 con timezone (UTC).
            # Ejemplo: "2026-05-26T06:04:22.344Z"
            timestamp = self._parse_timestamp(raw.get("last_reported", ""))

            snapshot = Snapshot(
                station_id=str(raw.get("station_id", "")),
                timestamp=timestamp,
                # Mapeo de campos GBFS a nuestro dominio simplificado
                bikes=int(raw.get("num_vehicles_available", 0)),
                docks=int(raw.get("num_docks_available", 0)),
                disabled=int(raw.get("num_vehicles_disabled", 0)),
                is_renting=bool(raw.get("is_renting", True)),
                is_returning=bool(raw.get("is_returning", True)),
            )
            snapshots.append(snapshot)

        # Calcular estadísticas rápidas para el log
        total_bikes = sum(s.bikes for s in snapshots)
        total_docks = sum(s.docks for s in snapshots)
        logger.info(
            f"✅ {len(snapshots)} snapshots parseados. "
            f"Total bicis: {total_bikes}, Total docks: {total_docks}"
        )
        return snapshots

    # =========================================================================
    # Métodos auxiliares (privados)
    # =========================================================================

    @staticmethod
    def _extract_spanish_text(name_array: list | str) -> str:
        """
        Extrae el texto en español de un array multilingüe del GBFS.

        El GBFS v3.0 retorna nombres como arrays de objetos:
            [
                {"text": "GDL-001", "language": "en"},
                {"text": "GDL-001", "language": "es"},
                ...
            ]

        Buscamos primero "es" (español). Si no existe, usamos el primer
        elemento. Si el input es un string directo, lo retornamos tal cual.

        Args:
            name_array: Array de {text, language} o un string directo

        Returns:
            El texto en español, o el primer texto disponible
        """
        # Si es un string directo (no array), retornar tal cual
        if isinstance(name_array, str):
            return name_array

        # Si es una lista vacía, retornar string vacío
        if not name_array:
            return ""

        # Buscar el texto en español
        for item in name_array:
            if isinstance(item, dict) and item.get("language") == "es":
                return item.get("text", "")

        # Si no hay español, usar el primer elemento
        if isinstance(name_array[0], dict):
            return name_array[0].get("text", "")

        return str(name_array[0])

    @staticmethod
    def _parse_timestamp(timestamp_str: str) -> datetime:
        """
        Parsea un timestamp ISO 8601 del GBFS a datetime de Python.

        El GBFS retorna timestamps en diferentes formatos:
            - "2026-05-26T06:04:22.344Z"     (con milisegundos)
            - "2026-05-26T06:04:22Z"          (sin milisegundos)
            - "2026-05-26T06:04:22+00:00"     (con offset)

        Si el parseo falla, retorna la hora actual en UTC como fallback.

        Args:
            timestamp_str: Timestamp en formato ISO 8601

        Returns:
            datetime con timezone UTC
        """
        if not timestamp_str:
            return datetime.now(timezone.utc)

        try:
            # Python 3.11+ puede parsear ISO 8601 directamente
            return datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            # Fallback: si no se puede parsear, usar hora actual
            logger.warning(f"⚠️ No se pudo parsear timestamp: {timestamp_str}")
            return datetime.now(timezone.utc)
