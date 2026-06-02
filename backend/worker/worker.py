import asyncio
import logging
import json
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from db import init_local_db, get_local_conn, get_supabase_conn
from http_client import fetch_mibici_data
from diff import compute_diff
from webhook import trigger_frontend_revalidate
from analytics_tasks import (
    run_compute_urban_metabolism,
    run_compute_desire_lines,
    run_compute_multimodal_stress,
    run_compute_network_centrality,
    run_compute_lisa_clusters,
    run_compute_bike_derby
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger(__name__)

def extract_spanish_text(name_array) -> str:
    if isinstance(name_array, str):
        return name_array
    if not name_array:
        return ""
    for item in name_array:
        if isinstance(item, dict) and item.get("language") == "es":
            return item.get("text", "")
    if isinstance(name_array[0], dict):
        return name_array[0].get("text", "")
    return str(name_array[0])


async def run_sync_stations():
    """Fetch station information and bulk upsert into Supabase."""
    data = await fetch_mibici_data("station_information.json")
    if not data or 'data' not in data or 'stations' not in data['data']:
        return

    stations = data['data']['stations']
    
    # We only upsert to Supabase
    conn = None
    try:
        conn = await get_supabase_conn()
        
        # Prepare bulk values
        values = []
        for st in stations:
            sid = str(st.get('station_id', ''))
            name = extract_spanish_text(st.get('name', ''))
            short_name = extract_spanish_text(st.get('short_name', ''))
            lat = st.get('lat', 0.0)
            lon = st.get('lon', 0.0)
            capacity = st.get('capacity', 0)
            address = st.get('address', '')
            post_code = st.get('post_code', '')
            # Simple region extraction if needed
            region = short_name.split('-')[0] if '-' in short_name else ''
            
            values.append((sid, name, short_name, lat, lon, capacity, address, post_code, region))
            
        if values:
            await conn.executemany("""
                INSERT INTO stations (id, name, short_name, lat, lon, capacity, address, post_code, region)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    short_name = EXCLUDED.short_name,
                    lat = EXCLUDED.lat,
                    lon = EXCLUDED.lon,
                    capacity = EXCLUDED.capacity,
                    address = EXCLUDED.address,
                    post_code = EXCLUDED.post_code,
                    region = EXCLUDED.region;
            """, values)
            logger.info(f"✅ Synced {len(values)} stations to Supabase.")
    except Exception as e:
        logger.error(f"❌ Error syncing stations to Supabase: {e}")
    finally:
        if conn:
            await conn.close()

async def run_collect_status():
    """Fetch station status, store full locally, compute diffs, bulk insert diffs, and revalidate frontend."""
    data = await fetch_mibici_data("station_status.json")
    if not data or 'data' not in data or 'stations' not in data['data']:
        return
        
    stations = data['data']['stations']
    now = datetime.now(timezone.utc)
    
    # 1. Store full payload to local DB for auditing
    try:
        local_conn = await get_local_conn()
        payload_json = json.dumps(stations)
        await local_conn.execute("INSERT INTO audit_raw_payloads (timestamp, payload) VALUES ($1, $2)", now, payload_json)
        await local_conn.close()
    except Exception as e:
        logger.error(f"❌ Error saving audit payload locally: {e}")
        
    # 2. Compute diffs
    diffs = compute_diff(stations)
    if not diffs:
        # No changes
        return
        
    logger.info(f"🔍 Computed diffs: {len(diffs)} stations changed state.")
    
    # 3. Bulk insert to Supabase
    supa_conn = None
    try:
        supa_conn = await get_supabase_conn()
        
        # Prepare values for snapshots
        values = []
        for d in diffs:
            values.append((
                d['station_id'],
                now,
                d['bikes'],
                d['docks'],
                d['disabled'],
                d['is_renting'],
                d['is_returning']
            ))
            
        if values:
            await supa_conn.executemany("""
                INSERT INTO snapshots (station_id, timestamp, bikes, docks, disabled, is_renting, is_returning)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            """, values)
            
            # 3.5 Generate and insert events
            event_values = []
            for d in diffs:
                delta = d.get('delta_bikes', 0)
                if delta == 0:
                    continue
                
                event_type = "bike_returned" if delta > 0 else "bike_taken"
                # For multiple bikes taken/returned at once, we log the absolute delta
                abs_delta = abs(delta)
                
                event_values.append((
                    d['station_id'],
                    now,
                    event_type,
                    abs_delta
                ))
                
            if event_values:
                await supa_conn.executemany("""
                    INSERT INTO events (station_id, timestamp, event_type, delta)
                    VALUES ($1, $2, $3, $4)
                """, event_values)
                logger.info(f"✅ Bulk inserted {len(event_values)} events to Supabase.")
            
            logger.info(f"✅ Bulk inserted {len(values)} diffs to Supabase.")
            
            # 4. Trigger Webhook
            await trigger_frontend_revalidate()
            
    except Exception as e:
        logger.error(f"❌ Error bulk inserting diffs to Supabase: {e}")
    finally:
        if supa_conn:
            await supa_conn.close()
        



async def run_hourly_analytics():
    logger.info("🎬 Running hourly analytics job...")
    conn = None
    try:
        conn = await get_supabase_conn()
        await run_compute_urban_metabolism(conn)
        await run_compute_bike_derby(conn)
    except Exception as e:
        logger.error(f"❌ Error in hourly analytics job: {e}")
    finally:
        if conn:
            await conn.close()


async def run_daily_analytics():
    logger.info("🎬 Running daily analytics job...")
    conn = None
    try:
        conn = await get_supabase_conn()
        await run_compute_network_centrality(conn)
        await run_compute_lisa_clusters(conn)
        await run_compute_desire_lines(conn)
        await run_compute_multimodal_stress(conn)
    except Exception as e:
        logger.error(f"❌ Error in daily analytics job: {e}")
    finally:
        if conn:
            await conn.close()


async def run_analytics_on_startup():
    logger.info("🚀 Startup Analytics Trigger: Wait 5 seconds for system to settle...")
    await asyncio.sleep(5)
    await run_hourly_analytics()
    await run_daily_analytics()


async def main():
    logger.info("🚀 Starting Edge Worker...")
    
    # Initialize local DB
    await init_local_db()
    
    scheduler = AsyncIOScheduler(timezone="America/Mexico_City")
    
    # -------------------------------------------------------------------------
    # HORARIO ACTIVO (5 AM a 1 AM del día siguiente)
    # -------------------------------------------------------------------------
    # Metadatos: Cada 30 minutos (minutos 0 y 30)
    scheduler.add_job(run_sync_stations, 'cron', hour='5-23,0', minute='0,30')
    
    # Estado/Diffs: Cada 16 segundos (segundos 0, 16, 32, 48 de cada minuto)
    scheduler.add_job(run_collect_status, 'cron', hour='5-23,0', second='*/16')

    # -------------------------------------------------------------------------
    # HORARIO INACTIVO (1 AM a 5 AM)
    # -------------------------------------------------------------------------
    # Metadatos: Cada hora (minuto 0)
    scheduler.add_job(run_sync_stations, 'cron', hour='1-4', minute='0')
    
    # Estado/Diffs: Cada hora (minuto 0) para ahorrar recursos del nodo y DB
    scheduler.add_job(run_collect_status, 'cron', hour='1-4', minute='0')
    
    # -------------------------------------------------------------------------
    # TAREAS DE ANALÍTICA (EDGE/PI)
    # -------------------------------------------------------------------------
    # Analítica Horaria (Metabolismo y Derby): Cada hora al minuto 5
    scheduler.add_job(run_hourly_analytics, 'cron', minute='5')
    
    # Analítica Diaria (LISA, Centralidad, Desire Lines, Volatilidad): A las 2:00 AM diariamente
    scheduler.add_job(run_daily_analytics, 'cron', hour='2', minute='0')
    
    scheduler.start()
    
    # Ejecutar analíticas en background al iniciar para poblar tablas vacías
    asyncio.create_task(run_analytics_on_startup())
    
    # Keep the worker running
    while True:
        await asyncio.sleep(3600)

if __name__ == "__main__":
    asyncio.run(main())
