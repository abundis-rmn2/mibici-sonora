import asyncio
import logging
import json
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from db import init_local_db, get_local_conn, get_supabase_conn
from http_client import fetch_mibici_data
from diff import compute_diff
from webhook import trigger_frontend_revalidate

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger(__name__)

async def run_sync_stations():
    """Fetch station information and bulk upsert into Supabase."""
    data = await fetch_mibici_data("station_information.json")
    if not data or 'data' not in data or 'stations' not in data['data']:
        return

    stations = data['data']['stations']
    
    # We only upsert to Supabase
    try:
        conn = await get_supabase_conn()
        
        # Prepare bulk values
        values = []
        for st in stations:
            sid = st.get('station_id')
            name = st.get('name', '')
            short_name = st.get('short_name', '')
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
            
            # (In a real scenario, we might also generate events here if we want to store them in 'events' table,
            # or the backend analytics could compute events on the fly. For now, we mimic what we can or let backend handle it.)
            
            logger.info(f"✅ Bulk inserted {len(values)} diffs to Supabase.")
            
        await supa_conn.close()
        
        # 4. Trigger Webhook
        await trigger_frontend_revalidate()
        
    except Exception as e:
        logger.error(f"❌ Error bulk inserting diffs to Supabase: {e}")


async def main():
    logger.info("🚀 Starting Edge Worker...")
    
    # Initialize local DB
    await init_local_db()
    
    scheduler = AsyncIOScheduler(timezone="America/Mexico_City")
    
    # Metadatos de estaciones: Minutos 0 y 30 (de 06:00 a 14:00) y minuto 0 (de 14:00 a 17:00)
    scheduler.add_job(run_sync_stations, 'cron', hour='6-13', minute='0,30')
    scheduler.add_job(run_sync_stations, 'cron', hour='14-17', minute='0')
    
    # Initial sync just in case
    await run_sync_stations()
    
    # Estado (Latest): Intervalo ininterrumpido cada 16 segundos.
    scheduler.add_job(run_collect_status, 'interval', seconds=16)
    
    scheduler.start()
    
    # Keep the worker running
    while True:
        await asyncio.sleep(3600)

if __name__ == "__main__":
    asyncio.run(main())
