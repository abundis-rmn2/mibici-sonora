import os
import httpx
import logging

logger = logging.getLogger(__name__)

async def fetch_mibici_data(endpoint_path: str) -> dict:
    base_url = os.environ.get("GBFS_BASE_URL", "https://guadalajara.publicbikesystem.net/customer/gbfs/v3.0")
    url = f"{base_url.rstrip('/')}/{endpoint_path}"
    
    try:
        async with httpx.AsyncClient(http2=True, timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.error(f"❌ Error fetching {url}: {e.__class__.__name__} - {str(e)}")
        return None
