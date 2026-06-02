import os
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def main():
    url = os.environ.get("SUPABASE_DB_URL")
    print(f"URL loaded: {url}")
    if not url:
        print("URL is empty!")
        return
    try:
        conn = await asyncpg.connect(url, timeout=5.0)
        print("SUCCESS! Connected to Supabase.")
        await conn.close()
    except Exception as e:
        print(f"FAILED: {e}")

asyncio.run(main())
