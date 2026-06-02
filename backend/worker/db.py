import os
import asyncpg
import logging

logger = logging.getLogger(__name__)

async def get_local_conn():
    local_url = os.environ.get("LOCAL_DB_URL")
    if not local_url:
        raise ValueError("LOCAL_DB_URL is not set")
    return await asyncpg.connect(local_url)

async def get_supabase_conn():
    supabase_url = os.environ.get("SUPABASE_DB_URL")
    if not supabase_url:
        raise ValueError("SUPABASE_DB_URL is not set")
    return await asyncpg.connect(supabase_url)

async def init_local_db():
    conn = await get_local_conn()
    try:
        # We need a table to store the raw audit data if not exists
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_raw_payloads (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMPTZ DEFAULT NOW(),
                payload JSONB NOT NULL
            );
        """)
        # We also need a schema for station info locally maybe? 
        # Actually, the diff logic says: "Guarda el payload completo en LOCAL_DB_URL para auditoría."
    finally:
        await conn.close()
