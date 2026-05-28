# =============================================================================
# MiBici Sonora — Caso de Uso: Detectar Eventos
# =============================================================================
# CAPA: Aplicación (casos de uso)
#
# Este caso de uso implementa la LÓGICA DE DETECCIÓN DE EVENTOS:
# compara los snapshots actuales con los anteriores para detectar
# cuándo se tomó o devolvió una bicicleta.
#
# ALGORITMO:
#   Para cada estación:
#     delta = bikes_actual - bikes_anterior
#     Si delta < 0 → evento "bike_taken" (se llevaron delta bicis)
#     Si delta > 0 → evento "bike_returned" (devolvieron delta bicis)
#     Si delta = 0 → no hay evento
#
# EJEMPLO:
#   Snapshot anterior: estación GDL-001, bikes=8
#   Snapshot actual:   estación GDL-001, bikes=5
#   → delta = 5 - 8 = -3
#   → Evento: bike_taken, delta=3 (se llevaron 3 bicis)
#
# NOTA: Un delta grande (e.g. -5) puede significar:
#   - 5 personas tomaron bici al mismo tiempo
#   - Un camión de redistribución quitó bicis
#   No distinguimos entre ambos casos (por ahora).
# =============================================================================

import logging

from domain.entities import BikeEvent, Snapshot
from domain.ports import EventRepository, SnapshotRepository

logger = logging.getLogger(__name__)


class DetectEventsUseCase:
    """
    Caso de uso: Detectar eventos de bicis tomadas/devueltas.

    Compara dos conjuntos de snapshots (actual vs anterior) y genera
    eventos para cada estación donde hubo un cambio en el número
    de bicicletas disponibles.

    Este es el CORAZÓN del sistema de monitoreo: sin detección de eventos,
    solo tendríamos datos crudos. Con eventos, podemos:
    - Visualizar flujo de bicis en tiempo real
    - Analizar patrones de uso
    - Generar sonificación artística

    Args:
        snapshot_repo: Puerto para leer snapshots anteriores
        event_repo:    Puerto para guardar eventos detectados
    """

    def __init__(
        self,
        snapshot_repo: SnapshotRepository,
        event_repo: EventRepository,
    ):
        self._snapshot_repo = snapshot_repo
        self._event_repo = event_repo

    async def execute(
        self,
        current_snapshots: list[Snapshot],
        station_zones: dict[str, str],
    ) -> list[BikeEvent]:
        """
        Detecta eventos comparando snapshots actuales vs anteriores.

        Proceso:
        1. Obtener el último snapshot de cada estación (de la DB)
        2. Para cada snapshot actual, calcular delta vs anterior
        3. Si delta != 0, crear un evento BikeEvent
        4. Guardar los eventos detectados en la DB
        5. Retornar la lista de eventos

        Args:
            current_snapshots: Snapshots recién obtenidos del GBFS
            station_zones:     Mapa {station_id: zona} para clasificar eventos
                              Ejemplo: {"2": "GDL", "5": "ZPN"}

        Returns:
            Lista de eventos detectados en este ciclo
        """
        # Paso 1: Obtener los snapshots anteriores de la base de datos.
        # Esto retorna un diccionario {station_id: último_snapshot}.
        # Si es la PRIMERA ejecución, estará vacío (no hay anteriores).
        previous_map = await self._snapshot_repo.get_latest_by_station()

        if not previous_map:
            # Primera ejecución: no hay snapshots anteriores para comparar.
            # Esto es normal al arrancar el sistema por primera vez.
            logger.info(
                "ℹ️ No hay snapshots anteriores. "
                "Los eventos se detectarán a partir del próximo ciclo."
            )
            return []

        # Paso 2: Comparar cada snapshot actual con su anterior
        events: list[BikeEvent] = []

        for current in current_snapshots:
            # Buscar el snapshot anterior de esta estación
            previous = previous_map.get(current.station_id)

            if previous is None:
                # Estación nueva que no existía antes. Ignorar este ciclo.
                continue

            # Calcular el DELTA: diferencia en bicicletas disponibles
            # delta > 0: devolvieron bicis
            # delta < 0: se llevaron bicis
            # delta = 0: sin cambios
            delta = current.bikes - previous.bikes

            if delta == 0:
                # Sin cambios: no hay evento
                continue

            # Determinar el tipo de evento según el signo del delta
            if delta < 0:
                # bikes bajó → alguien tomó una bici
                event_type = "bike_taken"
            else:
                # bikes subió → alguien devolvió una bici
                event_type = "bike_returned"

            # Crear el evento con todos los datos relevantes
            event = BikeEvent(
                station_id=current.station_id,
                timestamp=current.timestamp,
                event_type=event_type,
                delta=abs(delta),  # Siempre positivo (magnitud del cambio)
                zone=station_zones.get(current.station_id, ""),
            )
            events.append(event)

        # Paso 3: Guardar los eventos detectados en la base de datos
        if events:
            await self._event_repo.insert_many(events)

            # Resumen para los logs
            taken = sum(1 for e in events if e.event_type == "bike_taken")
            returned = sum(1 for e in events if e.event_type == "bike_returned")
            total_delta = sum(e.delta for e in events)
            logger.info(
                f"🎯 Detectados {len(events)} eventos: "
                f"{taken} bike_taken, {returned} bike_returned "
                f"(movimiento total: {total_delta} bicis)"
            )
        else:
            logger.info("😴 Sin eventos detectados en este ciclo")

        return events
