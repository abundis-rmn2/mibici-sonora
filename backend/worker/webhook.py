import os
import httpx
import logging

logger = logging.getLogger(__name__)

async def trigger_frontend_revalidate():
    webhook_url = os.environ.get("FRONTEND_URL", "https://mibici-sonora.vercel.app")
    secret_token = os.environ.get("SECRET_TOKEN")
    
    if not secret_token:
        logger.warning("SECRET_TOKEN is not set, skipping webhook.")
        return
        
    url = f"{webhook_url.rstrip('/')}/webhook/revalidate"
    headers = {"Authorization": f"Bearer {secret_token}"}
    
    try:
        async with httpx.AsyncClient(http2=True, timeout=15.0) as client:
            resp = await client.post(url, headers=headers)
            if resp.status_code == 200:
                logger.info("✅ Frontend cache revalidated successfully.")
            else:
                logger.error(f"❌ Failed to revalidate cache. Status: {resp.status_code}, Body: {resp.text}")
    except Exception as e:
        logger.error(f"❌ Error triggering webhook: {e.__class__.__name__} - {str(e)}")
