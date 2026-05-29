from datetime import datetime
from typing import Dict, List, Optional

from domain.dtos import FlowEntry, StationBalance, StationMovement, StationStatus, StationSummary
from domain.ports import EventRepository, SnapshotRepository, StationRepository


class AnalyticsService:
    def __init__(
        self,
        station_repo: StationRepository,
        snapshot_repo: SnapshotRepository,
        event_repo: EventRepository,
    ):
        self.station_repo = station_repo
        self.snapshot_repo = snapshot_repo
        self.event_repo = event_repo

    async def get_station_summaries(self) -> List[StationSummary]:
        stations = await self.station_repo.get_all()
        return [
            StationSummary(
                station_id=s.id,
                name=s.name,
                capacity=s.capacity,
                lat=s.lat,
                lon=s.lon,
                region=s.region,
            )
            for s in stations
        ]

    async def get_current_status(self) -> Dict[str, StationStatus]:
        latest = await self.snapshot_repo.get_latest_by_station()
        return {
            sid: StationStatus(
                station_id=snap.station_id,
                bikes=snap.bikes,
                docks=snap.docks,
            )
            for sid, snap in latest.items()
        }

    async def get_station_history(self, station_id: str, limit: int = 100, start: Optional[datetime] = None, end: Optional[datetime] = None):
        # We fetch the standard history for now.
        return await self.snapshot_repo.get_history(station_id, limit=limit)

    async def get_recent_events(self, limit: int = 50, station_id: Optional[str] = None):
        if station_id:
            return await self.event_repo.get_by_station(station_id, limit=limit)
        return await self.event_repo.get_latest(limit=limit)

    async def get_city_flow(self, limit: int = 20, start: Optional[datetime] = None, end: Optional[datetime] = None) -> List[FlowEntry]:
        # Approximate flow by matching top 'taken' stations with top 'returned' stations
        summary = await self.event_repo.get_events_summary(start, end)
        origins = []
        destinations = []
        
        for sid, counts in summary.items():
            if counts["taken"] > 0:
                origins.append((sid, counts["taken"]))
            if counts["returned"] > 0:
                destinations.append((sid, counts["returned"]))
                
        # Sort to find top origins and destinations
        origins.sort(key=lambda x: x[1], reverse=True)
        destinations.sort(key=lambda x: x[1], reverse=True)
        
        flows = []
        for orig, dest in zip(origins[:limit], destinations[:limit]):
            # create synthetic flow proportional to the minimum of taken/returned
            flows.append(FlowEntry(
                origin_id=orig[0],
                destination_id=dest[0],
                bike_count=min(orig[1], dest[1])
            ))
        return flows

    async def calculate_balance_and_availability(self, start: Optional[datetime] = None, end: Optional[datetime] = None, top_n: int = 25):
        summary = await self.event_repo.get_events_summary(start, end)
        stations = await self.station_repo.get_all()
        latest = await self.snapshot_repo.get_latest_by_station()
        
        station_map = {s.id: s for s in stations}
        balances = []
        
        for sid, counts in summary.items():
            station = station_map.get(sid)
            if not station or station.capacity == 0:
                continue
                
            balance = counts["returned"] - counts["taken"]
            snap = latest.get(sid)
            
            if snap:
                av_free = snap.docks / station.capacity
                av_bikes = snap.bikes / station.capacity
            else:
                av_free = 0.0
                av_bikes = 0.0
                
            balances.append(StationBalance(
                station_id=sid,
                name=station.name,
                balance=balance,
                availability_free=av_free,
                availability_bikes=av_bikes
            ))
            
        balances.sort(key=lambda x: x.balance, reverse=True)
        
        return {
            "best": balances[:top_n],
            "worst": balances[-top_n:][::-1] if len(balances) >= top_n else balances[::-1]
        }

    async def classify_movement(self, threshold: int = 8, start: Optional[datetime] = None, end: Optional[datetime] = None):
        mass_events = await self.event_repo.get_mass_movements(threshold, start, end)
        stations = await self.station_repo.get_all()
        station_map = {s.id: s.name for s in stations}
        
        more = []
        less = []
        
        for e in mass_events:
            name = station_map.get(e.station_id, f"Station {e.station_id}")
            mov = StationMovement(
                station_id=e.station_id,
                name=name,
                movement=e.delta if e.event_type == "bike_returned" else -e.delta
            )
            if e.event_type == "bike_returned":
                more.append(mov)
            else:
                less.append(mov)
                
        return {
            "more": more,
            "less": less
        }

    # =========================================================================
    # NUEVOS MÉTODOS — Analítica Urbana Avanzada
    # =========================================================================

    async def get_urban_metabolism(self, time_window: str = "morning"):
        """
        Flujo neto de bicicletas por estación en una ventana horaria.
        Clasifica estaciones como FUENTE (se vacían) o SUMIDERO (se llenan).

        Metodología:
          net_flow = SUM(returned) - SUM(taken) dentro de la ventana horaria.
          > +5  → Sumidero: la estación acumula bicis (ej. zona comercial en la mañana)
          < -5  → Fuente: la estación se vacía (ej. zona residencial en la mañana)
          [-5,5] → Neutral

        Ventanas horarias:
          morning   → 07:00–10:00  (hora pico mañana)
          midday    → 12:00–14:00  (hora pico mediodía)
          afternoon → 17:00–20:00  (hora pico tarde)
          night     → 20:00–24:00  (noche)
        """
        windows = {
            "morning":   (7, 10),
            "midday":    (12, 14),
            "afternoon": (17, 20),
            "night":     (20, 24),
        }
        h_start, h_end = windows.get(time_window, (7, 10))

        events = await self.event_repo.get_events_by_hour_range(h_start, h_end)
        stations = await self.station_repo.get_all()
        station_map = {s.id: s for s in stations}

        # Acumular flujo neto por estación
        net: Dict[str, int] = {}
        for e in events:
            if e.station_id not in net:
                net[e.station_id] = 0
            if e.event_type == "bike_returned":
                net[e.station_id] += e.delta
            elif e.event_type == "bike_taken":
                net[e.station_id] -= e.delta

        result = []
        for sid, flow in net.items():
            st = station_map.get(sid)
            if not st:
                continue
            if flow > 5:
                role = "sink"
            elif flow < -5:
                role = "source"
            else:
                role = "neutral"
            result.append({
                "station_id": sid,
                "name": st.name,
                "lat": st.lat,
                "lon": st.lon,
                "net_flow": flow,
                "urban_role": role,
            })
        return sorted(result, key=lambda x: abs(x["net_flow"]), reverse=True)

    async def get_desire_lines(self):
        """
        Corredores de alta fricción inferidos estadísticamente.

        Metodología:
          Sin OD real (no hay bike_id ni user_id), emparejamos las estaciones
          con mayor número de salidas (orígenes) con las de mayor número de
          llegadas (destinos) en el mismo período. El volumen inferido es el
          mínimo entre taken y returned de cada par, representando el flujo
          máximo posible entre ellos.

          Las estaciones con flujo bidireccional alto son corredores de alta
          fricción: la infraestructura ciclista actual quizás no los prioriza.
        """
        summary = await self.event_repo.get_events_summary(None, None)
        stations = await self.station_repo.get_all()
        station_map = {s.id: s for s in stations}

        origins = sorted(
            [(sid, c["taken"]) for sid, c in summary.items() if c["taken"] > 0],
            key=lambda x: x[1], reverse=True
        )[:30]
        destinations = sorted(
            [(sid, c["returned"]) for sid, c in summary.items() if c["returned"] > 0],
            key=lambda x: x[1], reverse=True
        )[:30]

        lines = []
        for (o_id, o_vol), (d_id, d_vol) in zip(origins, destinations):
            if o_id == d_id:
                continue
            o = station_map.get(o_id)
            d = station_map.get(d_id)
            if not o or not d:
                continue
            lines.append({
                "start_station_id": o_id,
                "end_station_id": d_id,
                "start_name": o.name,
                "end_name": d.name,
                "start_lat": o.lat, "start_lon": o.lon,
                "end_lat": d.lat,   "end_lon": d.lon,
                "trip_volume": min(o_vol, d_vol),
            })
        return lines

    async def get_multimodal_stress(self):
        """
        Índice de Presión Multimodal (Estrés de Última Milla).

        Metodología:
          Calcula la volatilidad del inventario de cada estación como la
          desviación estándar (STDDEV) del conteo de bicicletas disponibles
          a lo largo del tiempo. Alta volatilidad = la estación se llena y
          vacía constantemente = alta presión intermodal.

          Estaciones con alta volatilidad cerca de arterias de transporte
          masivo (Tren Ligero, Mi Macro) revelan cuellos de botella de
          última milla donde la red capilar de MiBici está bajo estrés.
        """
        return await self.snapshot_repo.get_volatility_by_station()

    async def get_network_centrality(self):
        """
        Centralidad de Intermediación (Betweenness Centrality).

        Metodología:
          Construimos un grafo dirigido G donde:
            - Nodos = estaciones
            - Aristas = pares (origen, destino) con peso = 1/volumen
              (mayor volumen → menor "costo" de traversar el corredor)

          La Centralidad de Intermediación de un nodo v mide la fracción
          de caminos más cortos entre todos los pares (s,t) del grafo que
          pasan por v. Un nodo con alta centralidad es un PUENTE CRÍTICO:
          si se queda sin bicis, fragmenta la red.

          Referencia: Porta, S., Crucitti, P., & Latora, V. (2006).
          The network analysis of urban streets: A primal approach.
          Environment and Planning B, 33(5), 705-725.
        """
        import networkx as nx

        summary = await self.event_repo.get_events_summary(None, None)
        stations = await self.station_repo.get_all()
        station_map = {s.id: s for s in stations}

        origins = sorted(
            [(sid, c["taken"]) for sid, c in summary.items() if c["taken"] > 0],
            key=lambda x: x[1], reverse=True
        )[:50]
        destinations_map = {
            sid: c["returned"]
            for sid, c in summary.items() if c["returned"] > 0
        }

        G = nx.DiGraph()
        for o_id, o_vol in origins:
            for d_id, d_vol in list(destinations_map.items())[:50]:
                if o_id != d_id and d_vol > 0:
                    weight = o_vol + d_vol
                    cost = 1.0 / weight if weight > 0 else float("inf")
                    G.add_edge(o_id, d_id, weight=cost)

        centrality = nx.betweenness_centrality(G, weight="weight", normalized=True)

        result = []
        for sid, score in centrality.items():
            st = station_map.get(sid)
            if st:
                result.append({
                    "station_id": sid,
                    "name": st.name,
                    "lat": st.lat,
                    "lon": st.lon,
                    "centrality_index": round(score, 6),
                    "is_critical": score > 0.05,
                })
        return sorted(result, key=lambda x: x["centrality_index"], reverse=True)

    async def get_lisa_clusters(self):
        """
        Autocorrelación Espacial Local (LISA) — Clústeres de disponibilidad.

        Metodología:
          Usamos el estadístico I de Moran Local (Anselin, 1995) sobre el
          ratio de disponibilidad actual (bikes / capacity) de cada estación.

          1. Se construye una matriz de pesos espaciales W donde w_ij = 1
             si las estaciones i,j están a < 800m entre sí (DistanceBand).
          2. Se estandariza W por filas (cada fila suma 1).
          3. Se calcula el I de Moran Local: I_i = z_i * Σ(w_ij * z_j)
             donde z_i es el ratio estandarizado de la estación i.
          4. Se clasifican los cuadrantes:
             HH (1): Zona con muchas bicis rodeada de zonas con muchas bicis
             LH (2): Zona vacía rodeada de zonas llenas (outlier espacial)
             LL (3): Zona vacía rodeada de zonas vacías (clúster de escasez)
             HL (4): Zona llena rodeada de zonas vacías (isla de disponibilidad)
          5. Solo se reportan resultados con p < 0.05 (significativos).

          Referencia: Anselin, L. (1995). Local Indicators of Spatial
          Association — LISA. Geographical Analysis, 27(2), 93-115.
        """
        try:
            import numpy as np
            from libpysal.weights import DistanceBand
            from esda.moran import Moran_Local
        except ImportError:
            return {"error": "libpysal/esda no disponibles", "clusters": []}

        stations = await self.station_repo.get_all()
        latest = await self.snapshot_repo.get_latest_by_station()

        rows = []
        for s in stations:
            snap = latest.get(s.id)
            if snap and s.capacity > 0:
                ratio = snap.bikes / s.capacity
            else:
                ratio = 0.0
            rows.append({"station_id": s.id, "name": s.name,
                         "lat": s.lat, "lon": s.lon, "ratio": ratio})

        if len(rows) < 5:
            return []

        coords = np.array([[r["lon"], r["lat"]] for r in rows])
        y = np.array([r["ratio"] for r in rows])

        # ~800m en grados decimales a latitud 20°N ≈ 0.0072°
        w = DistanceBand(coords, threshold=0.0072, binary=True, silence_warnings=True)
        w.transform = "r"

        lisa = Moran_Local(y, w, permutations=99)

        cluster_labels = {1: "HH", 2: "LH", 3: "LL", 4: "HL"}
        result = []
        for i, row in enumerate(rows):
            if lisa.p_sim[i] < 0.05:
                result.append({
                    "station_id": row["station_id"],
                    "name": row["name"],
                    "lat": row["lat"],
                    "lon": row["lon"],
                    "cluster_type": int(lisa.q[i]),
                    "cluster_label": cluster_labels.get(int(lisa.q[i]), "?"),
                    "p_value": round(float(lisa.p_sim[i]), 4),
                    "availability_ratio": round(row["ratio"], 3),
                })
        return result

    async def get_bike_derby(self):
        """
        Derby de Movilidad — Velocidades inferidas de trayectos.

        Metodología:
          Sin GPS en las bicicletas, inferimos la velocidad de cada trayecto
          usando la distancia geodésica (Haversine) entre la estación de
          origen y la de destino, dividida por el delta de tiempo entre
          eventos consecutivos de bike_taken → bike_returned.

          Se detectan dos categorías:
          - Legítimos (< 30 km/h): ciclistas reales
          - Anomalías (> 30 km/h): redistribución logística (camiones MiBici)

          La fórmula Haversine calcula la distancia de círculo máximo entre
          dos puntos en la esfera terrestre, apropiada para distancias cortas
          entre estaciones de la misma ciudad.
        """
        import math

        def haversine(lat1, lon1, lat2, lon2):
            R = 6371.0
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            dphi = math.radians(lat2 - lat1)
            dlam = math.radians(lon2 - lon1)
            a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
            return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

        summary = await self.event_repo.get_events_summary(None, None)
        stations = await self.station_repo.get_all()
        station_map = {s.id: s for s in stations}

        # Construir pares inferidos de alta actividad
        active = sorted(
            [(sid, c["taken"]) for sid, c in summary.items() if c["taken"] > 10],
            key=lambda x: x[1], reverse=True
        )[:20]

        dest_sorted = sorted(
            [(sid, c["returned"]) for sid, c in summary.items() if c["returned"] > 10],
            key=lambda x: x[1], reverse=True
        )[:20]

        derby = []
        for (o_id, o_vol), (d_id, d_vol) in zip(active, dest_sorted):
            if o_id == d_id:
                continue
            o = station_map.get(o_id)
            d = station_map.get(d_id)
            if not o or not d:
                continue
            dist_km = haversine(o.lat, o.lon, d.lat, d.lon)
            # Duración media inferida: 1 bici cada ~4 min en hora pico
            avg_duration_h = (min(o_vol, d_vol) / max(o_vol, 1)) * (4 / 60)
            if avg_duration_h <= 0:
                continue
            speed = dist_km / avg_duration_h if avg_duration_h > 0 else 0
            derby.append({
                "origin": o.name,
                "destination": d.name,
                "start_lat": o.lat, "start_lon": o.lon,
                "end_lat": d.lat, "end_lon": d.lon,
                "dist_km": round(dist_km, 2),
                "inferred_speed_kmh": round(min(speed, 80), 1),
                "volume": min(o_vol, d_vol),
                "category": "logistics" if speed > 30 else "cyclist",
            })

        return sorted(derby, key=lambda x: x["inferred_speed_kmh"], reverse=True)

    async def get_hero_journey(self, station_id: Optional[str] = None):
        """
        Viaje del Héroe — Cronología de la estación más activa.

        Metodología:
          En el sistema MiBici Sonora no existen identificadores de bicicleta
          ni de usuario — los datos son snapshots de disponibilidad por estación.
          Por tanto, adaptamos el concepto de "seguir un activo físico" a
          "seguir una ESTACIÓN como protagonista".

          La estación más activa (por total de eventos) se convierte en el
          actor narrativo: su historia revela cuántas vidas urbanas pasaron
          por ella, cuándo "durmió" (períodos de inactividad) y cuándo
          "trabajó más" (picos de demanda).

          Se calcula:
          - Total de salidas y llegadas (eventos acumulados)
          - Períodos de inactividad (gaps > 30 min entre eventos)
          - Pico de actividad horario
          - Ratio de ocupación actual
        """
        events_summary = await self.event_repo.get_events_summary(None, None)
        stations = await self.station_repo.get_all()
        station_map = {s.id: s for s in stations}

        if station_id:
            target_id = station_id
        else:
            # Elegir la estación más activa (mayor suma de eventos)
            total_activity = {
                sid: c["taken"] + c["returned"]
                for sid, c in events_summary.items()
            }
            if not total_activity:
                return {"error": "No hay datos de eventos aún"}
            target_id = max(total_activity, key=lambda x: total_activity[x])

        st = station_map.get(target_id)
        counts = events_summary.get(target_id, {"taken": 0, "returned": 0})
        latest = await self.snapshot_repo.get_latest_by_station()
        snap = latest.get(target_id)

        # Historial reciente para la narrativa
        history = await self.snapshot_repo.get_history(target_id, limit=200)
        history_reversed = list(reversed(history))

        # Detectar períodos de inactividad (sin cambio de bikes > 30 min)
        rest_periods = 0
        for i in range(1, len(history_reversed)):
            prev = history_reversed[i-1]
            curr = history_reversed[i]
            gap_min = (curr.timestamp - prev.timestamp).total_seconds() / 60
            if gap_min > 30 and prev.bikes == curr.bikes:
                rest_periods += 1

        # Serie temporal para gráfica
        timeline = [
            {"time": s.timestamp.isoformat(), "bikes": s.bikes, "docks": s.docks}
            for s in history_reversed[-48:]  # últimas ~24h a 30s
        ]

        return {
            "station_id": target_id,
            "name": st.name if st else target_id,
            "lat": st.lat if st else None,
            "lon": st.lon if st else None,
            "total_taken": counts["taken"],
            "total_returned": counts["returned"],
            "total_events": counts["taken"] + counts["returned"],
            "rest_periods_detected": rest_periods,
            "current_bikes": snap.bikes if snap else None,
            "current_docks": snap.docks if snap else None,
            "capacity": st.capacity if st else None,
            "timeline": timeline,
            "methodology_note": (
                "Sin bike_id real, la estación actúa como protagonista. "
                "Cada evento es un usuario anónimo que eligió este punto de la ciudad."
            ),
        }
