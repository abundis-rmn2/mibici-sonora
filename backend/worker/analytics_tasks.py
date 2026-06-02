import math
import logging
import asyncio
from datetime import datetime, timezone
import numpy as np
import networkx as nx

logger = logging.getLogger(__name__)

# Haversine formula
def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

async def run_compute_urban_metabolism(conn):
    """Calculate sources and sinks by time window."""
    logger.info("Computing urban metabolism...")
    
    # 1. Fetch stations
    stations = await conn.fetch("SELECT id, name, lat, lon FROM stations")
    station_map = {s["id"]: s for s in stations}
    
    windows = [
        ("morning", 7, 10),
        ("midday", 12, 14),
        ("afternoon", 17, 20),
        ("night", 20, 24)
    ]
    
    for window_name, h_start, h_end in windows:
        # Fetch events count in range
        events = await conn.fetch("""
            SELECT station_id, event_type, SUM(delta) as total
            FROM events
            WHERE EXTRACT(HOUR FROM timestamp AT TIME ZONE 'America/Mexico_City') BETWEEN $1 AND $2
            GROUP BY station_id, event_type
        """, h_start, h_end)
        
        net = {}
        for e in events:
            sid = e["station_id"]
            if sid not in net:
                net[sid] = 0
            if e["event_type"] == "bike_returned":
                net[sid] += e["total"]
            elif e["event_type"] == "bike_taken":
                net[sid] -= e["total"]
                
        values = []
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
                
            values.append((
                window_name,
                sid,
                st["name"],
                st["lat"],
                st["lon"],
                flow,
                role
            ))
            
        if values:
            await conn.executemany("""
                INSERT INTO analytics_urban_metabolism (time_window, station_id, name, lat, lon, net_flow, urban_role, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (time_window, station_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    lat = EXCLUDED.lat,
                    lon = EXCLUDED.lon,
                    net_flow = EXCLUDED.net_flow,
                    urban_role = EXCLUDED.urban_role,
                    updated_at = NOW();
            """, values)
            
    logger.info("✅ Computed and saved urban metabolism.")

async def run_compute_desire_lines(conn):
    """Calculate inferred desire lines."""
    logger.info("Computing desire lines...")
    
    # Fetch events summary
    events = await conn.fetch("""
        SELECT station_id, event_type, SUM(delta) as total
        FROM events
        GROUP BY station_id, event_type
    """)
    
    summary = {}
    for e in events:
        sid = e["station_id"]
        if sid not in summary:
            summary[sid] = {"taken": 0, "returned": 0}
        if e["event_type"] == "bike_taken":
            summary[sid]["taken"] = e["total"]
        elif e["event_type"] == "bike_returned":
            summary[sid]["returned"] = e["total"]
            
    stations = await conn.fetch("SELECT id, name, lat, lon FROM stations")
    station_map = {s["id"]: s for s in stations}
    
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
            
        lines.append((
            o_id,
            d_id,
            o["name"],
            d["name"],
            o["lat"],
            o["lon"],
            d["lat"],
            d["lon"],
            min(o_vol, d_vol)
        ))
        
    async with conn.transaction():
        # Clear old lines
        await conn.execute("DELETE FROM analytics_desire_lines")
        if lines:
            await conn.executemany("""
                INSERT INTO analytics_desire_lines 
                (start_station_id, end_station_id, start_name, end_name, start_lat, start_lon, end_lat, end_lon, trip_volume, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            """, lines)
            
    logger.info(f"✅ Computed and saved {len(lines)} desire lines.")

async def run_compute_multimodal_stress(conn):
    """Calculate multimodal stress (inventory volatility)."""
    logger.info("Computing multimodal stress...")
    
    rows = await conn.fetch("""
        WITH hourly AS (
            SELECT station_id,
                   date_trunc('hour', timestamp) as hour,
                   AVG(bikes) as avg_bikes
            FROM snapshots
            WHERE timestamp > NOW() - INTERVAL '7 days'
            GROUP BY station_id, date_trunc('hour', timestamp)
        )
        SELECT station_id,
               STDDEV(avg_bikes) as volatility_index
        FROM hourly
        GROUP BY station_id
        HAVING COUNT(*) >= 5
        ORDER BY volatility_index DESC NULLS LAST
    """)
    
    values = [(r["station_id"], float(r["volatility_index"] or 0.0)) for r in rows]
    
    if values:
        await conn.executemany("""
            INSERT INTO analytics_multimodal_stress (station_id, volatility_index, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (station_id) DO UPDATE SET
                volatility_index = EXCLUDED.volatility_index,
                updated_at = NOW();
        """, values)
        
    logger.info(f"✅ Computed and saved {len(values)} stress entries.")

async def run_compute_network_centrality(conn):
    """Calculate Betweenness Centrality."""
    logger.info("Computing network centrality...")
    
    events = await conn.fetch("""
        SELECT station_id, event_type, SUM(delta) as total
        FROM events
        GROUP BY station_id, event_type
    """)
    
    summary = {}
    for e in events:
        sid = e["station_id"]
        if sid not in summary:
            summary[sid] = {"taken": 0, "returned": 0}
        if e["event_type"] == "bike_taken":
            summary[sid]["taken"] = e["total"]
        elif e["event_type"] == "bike_returned":
            summary[sid]["returned"] = e["total"]
            
    stations = await conn.fetch("SELECT id, name, lat, lon FROM stations")
    station_map = {s["id"]: s for s in stations}
    
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
    
    values = []
    for sid, score in centrality.items():
        st = station_map.get(sid)
        if st:
            values.append((
                sid,
                st["name"],
                st["lat"],
                st["lon"],
                round(score, 6),
                round(score, 6), # centrality_score same as centrality_index
                score > 0.05
            ))
            
    if values:
        await conn.executemany("""
            INSERT INTO analytics_centrality_results 
            (station_id, name, lat, lon, centrality_index, centrality_score, is_critical, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (station_id) DO UPDATE SET
                name = EXCLUDED.name,
                lat = EXCLUDED.lat,
                lon = EXCLUDED.lon,
                centrality_index = EXCLUDED.centrality_index,
                centrality_score = EXCLUDED.centrality_score,
                is_critical = EXCLUDED.is_critical,
                updated_at = NOW();
        """, values)
        
    logger.info(f"✅ Computed and saved {len(values)} centrality entries.")

async def run_compute_lisa_clusters(conn):
    """Calculate Moran Local Spatial Autocorrelation."""
    logger.info("Computing LISA clusters...")
    try:
        from libpysal.weights import DistanceBand
        from esda.moran import Moran_Local
    except ImportError as e:
        logger.error(f"Failed to import libpysal/esda: {e}")
        return
        
    rows = await conn.fetch("""
        SELECT st.id, st.name, st.lat, st.lon, st.capacity, sn.bikes
        FROM stations st
        LEFT JOIN LATERAL (
            SELECT bikes
            FROM snapshots
            WHERE station_id = st.id
            ORDER BY timestamp DESC
            LIMIT 1
        ) sn ON TRUE
    """)
    
    valid_rows = []
    for r in rows:
        capacity = r["capacity"]
        bikes = r["bikes"]
        if capacity and capacity > 0:
            ratio = (bikes or 0) / capacity
            valid_rows.append({
                "station_id": r["id"],
                "name": r["name"],
                "lat": r["lat"],
                "lon": r["lon"],
                "ratio": ratio
            })
            
    if len(valid_rows) < 5:
        logger.warning("Not enough stations to compute LISA.")
        return
        
    coords = np.array([[r["lon"], r["lat"]] for r in valid_rows])
    y = np.array([r["ratio"] for r in valid_rows])
    
    # ~800m threshold in decimal degrees
    w = DistanceBand(coords, threshold=0.0072, binary=True, silence_warnings=True)
    w.transform = "r"
    
    lisa = Moran_Local(y, w, permutations=99)
    cluster_labels = {1: "HH", 2: "LH", 3: "LL", 4: "HL"}
    
    values = []
    for i, row in enumerate(valid_rows):
        if lisa.p_sim[i] < 0.05:
            q = int(lisa.q[i])
            values.append((
                row["station_id"],
                row["name"],
                row["lat"],
                row["lon"],
                q,
                cluster_labels.get(q, "?"),
                round(float(lisa.p_sim[i]), 4),
                round(row["ratio"], 3)
            ))
            
    async with conn.transaction():
        # Clean previous LISA results to keep only significant ones
        await conn.execute("DELETE FROM analytics_lisa_results")
        if values:
            await conn.executemany("""
                INSERT INTO analytics_lisa_results 
                (station_id, name, lat, lon, cluster_type, cluster_label, p_value, availability_ratio, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                ON CONFLICT (station_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    lat = EXCLUDED.lat,
                    lon = EXCLUDED.lon,
                    cluster_type = EXCLUDED.cluster_type,
                    cluster_label = EXCLUDED.cluster_label,
                    p_value = EXCLUDED.p_value,
                    availability_ratio = EXCLUDED.availability_ratio,
                    updated_at = NOW();
            """, values)
            
    logger.info(f"✅ Computed and saved {len(values)} LISA entries.")

async def run_compute_bike_derby(conn):
    """Calculate speed derby."""
    logger.info("Computing bike derby...")
    
    events = await conn.fetch("""
        SELECT station_id, event_type, SUM(delta) as total
        FROM events
        GROUP BY station_id, event_type
    """)
    
    summary = {}
    for e in events:
        sid = e["station_id"]
        if sid not in summary:
            summary[sid] = {"taken": 0, "returned": 0}
        if e["event_type"] == "bike_taken":
            summary[sid]["taken"] = e["total"]
        elif e["event_type"] == "bike_returned":
            summary[sid]["returned"] = e["total"]
            
    stations = await conn.fetch("SELECT id, name, lat, lon FROM stations")
    station_map = {s["id"]: s for s in stations}
    
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
            
        dist_km = haversine(o["lat"], o["lon"], d["lat"], d["lon"])
        avg_duration_h = (min(o_vol, d_vol) / max(o_vol, 1)) * (4.0 / 60.0)
        if avg_duration_h <= 0:
            continue
        speed = dist_km / avg_duration_h
        category = "logistics" if speed > 30 else "cyclist"
        
        derby.append((
            o["name"],
            d["name"],
            o["lat"],
            o["lon"],
            d["lat"],
            d["lon"],
            round(dist_km, 2),
            round(min(speed, 80), 1),
            min(o_vol, d_vol),
            category
        ))
        
    async with conn.transaction():
        await conn.execute("DELETE FROM analytics_bike_derby")
        if derby:
            await conn.executemany("""
                INSERT INTO analytics_bike_derby
                (origin, destination, start_lat, start_lon, end_lat, end_lon, dist_km, inferred_speed_kmh, volume, category, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
            """, derby)
            
    logger.info(f"✅ Computed and saved {len(derby)} derby entries.")
