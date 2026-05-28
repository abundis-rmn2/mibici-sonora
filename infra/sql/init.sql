-- =============================================================================
-- MiBici Sonora — Script de Inicialización de PostgreSQL
-- =============================================================================
-- Este script se ejecuta AUTOMÁTICAMENTE la primera vez que se crea
-- la base de datos (cuando el volumen pgdata está vacío).
--
-- Docker lo monta en /docker-entrypoint-initdb.d/ y PostgreSQL lo ejecuta
-- durante la inicialización del contenedor.
--
-- ¿Qué hace?
--   1. Activa la extensión PostGIS para datos geoespaciales
--   2. Verifica que la extensión se instaló correctamente
--
-- NOTA: Las tablas (stations, snapshots, events) se crean desde Python
-- con SQLAlchemy, NO aquí. Esto solo activa PostGIS.
-- =============================================================================

-- Activar PostGIS: nos permite almacenar coordenadas geográficas
-- y hacer consultas espaciales (e.g. "estaciones dentro de 500m")
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verificación: esto aparece en los logs de Docker al iniciar
-- para confirmar que PostGIS se activó correctamente.
DO $$
BEGIN
    RAISE NOTICE '✅ PostGIS activado correctamente en mibici_sonora';
    RAISE NOTICE 'Versión PostGIS: %', PostGIS_Version();
END $$;
