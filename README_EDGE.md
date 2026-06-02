# MiBici Sonora - Edge Computing Profile

This branch refactors the architecture into an Edge Computing model using Docker profiles. 

## Services

There are three main profiles you can run using Docker Compose:

1. **Edge Profile** (`docker compose --profile edge up -d`)
   - `postgres_local`: The local DB running on the Raspberry Pi/Edge node for auditing.
   - `worker`: The Python daemon that fetches the API, calculates state diffs, bulk inserts to Supabase, and triggers a cache revalidation webhook to Vercel.

2. **API Profile** (`docker compose --profile api up -d`)
   - `backend`: The FastAPI application. It is now completely stateless and acts only as an analytical computing engine querying Supabase.

3. **Web Profile** (`docker compose --profile web up -d`)
   - `frontend`: The Next.js web application.

## Environment Variables (.env)

Make sure you copy `.env.example` to `.env` and set the following critical variables:
```
LOCAL_DB_URL=postgresql://mibici:mibici_dev@postgres_local:5432/mibici_audit
SUPABASE_DB_URL=postgresql://<user>:<pass>@<supabase-host>:5432/mibici_sonora
SECRET_TOKEN=YOUR_GENERATED_SECRET_TOKEN
POSTGRES_VOLUME_PATH=./postgres_data
```

## Running the Edge Worker

To deploy the edge components (for example, on a Raspberry Pi using Dockge):
```bash
docker compose --profile edge up -d
```
You can view the logs to ensure the diff algorithm is running and bulk upserts are functioning:
```bash
docker compose logs -f worker
```

## Supabase Schema

The cloud database needs the tables created. Use the provided schema script located at `backend/worker/supabase_schema.sql` on the Supabase SQL editor to create the `stations`, `snapshots`, and `events` tables.
