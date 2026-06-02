# 🚲 MiBici Sonora

**Sistema de monitoreo y sonificación en tiempo real** del sistema de bicicletas compartidas MiBici en Guadalajara.

## ¿Qué hace?

1. **Consume** datos GBFS de MiBici (estaciones y estado en tiempo real)
2. **Detecta** eventos (bicis tomadas/devueltas) comparando snapshots
3. **Guarda** un histórico completo en PostgreSQL/PostGIS
4. **Expone** una API REST para consultar estaciones, eventos y heatmaps
5. *(Futuro)* Visualiza estaciones en mapa y genera sonificación artística

## Arquitectura

```
Hexagonal (Ports & Adapters)
───────────────────────────────────────
  domain/        → Entidades + Interfaces (puertos)
  application/   → Casos de uso (lógica de negocio)
  adapters/      → Implementaciones concretas
                   ├── gbfs_http_adapter (consume API)
                   ├── postgres_repos (persistencia)
                   └── api/ (FastAPI REST)
  infrastructure/→ Configuración, DB engine, DI container
  cli.py         → Comandos manuales
```

## Inicio rápido

```bash
# 1. Copiar variables de entorno
cp .env.example .env

# Asegúrate de agregar tus credenciales de Supabase en el archivo .env
# NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY son requeridas 
# por el frontend para consultar estaciones y eventos en tiempo real.

# 2. Levantar servicios (PostgreSQL + API)
docker compose up -d

# 3. Inicializar base de datos
docker compose exec backend python -m cli init-db

# 4. Sincronizar estaciones (una vez)
docker compose exec backend python -m cli sync-stations

# 5. Recolectar un snapshot manual
docker compose exec backend python -m cli collect-once

# 6. Cuando estés listo, iniciar el collector automático
docker compose exec backend python -m cli start-collector
```

## API Endpoints

| Endpoint | Descripción |
|---|---|
| `GET /api/health` | Health check |
| `GET /api/stations` | Todas las estaciones con status actual |
| `GET /api/stations/{id}/history` | Historial de una estación |
| `GET /api/events/latest` | Últimos eventos detectados |
| `GET /api/heatmap` | Datos agregados para heatmap |

## Stack

- **Python 3.12** + FastAPI + SQLAlchemy
- **PostgreSQL 16** + PostGIS
- **Docker Compose** para desarrollo local
- **httpx** para consumo de API GBFS
- **APScheduler** para polling programado
