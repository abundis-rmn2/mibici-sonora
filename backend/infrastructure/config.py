# =============================================================================
# MiBici Sonora — Configuración del Sistema
# =============================================================================
# CAPA: Infraestructura
#
# Centraliza TODA la configuración del sistema en un solo lugar.
# Usa pydantic-settings para cargar variables de entorno automáticamente.
#
# ¿Cómo funciona?
#   1. Pydantic busca variables de entorno con los mismos nombres
#   2. Si no las encuentra, usa los valores por defecto definidos aquí
#   3. Valida los tipos automáticamente (str, int, etc.)
#
# Fuentes de configuración (en orden de prioridad):
#   1. Variables de entorno del sistema (e.g. export DATABASE_URL=...)
#   2. Archivo .env en la raíz del proyecto
#   3. Valores por defecto definidos aquí abajo
#
# PRINCIPIO SOLID — Single Responsibility:
#   Este archivo SOLO se encarga de la configuración.
#   No crea conexiones, no inicializa nada.
# =============================================================================

from pydantic_settings import BaseSettings
from pydantic import field_validator

class Settings(BaseSettings):
    """
    Configuración central del sistema MiBici Sonora.

    Todas las variables se pueden sobreescribir con variables de entorno.
    Ejemplo:
        export DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
        export STATUS_POLL_SECONDS=15  # polling más rápido

    Los valores por defecto están pensados para desarrollo local con Docker.
    """

    # ---- Base de Datos ----
    # URL de conexión a PostgreSQL con driver asyncpg.
    # El formato es: postgresql+asyncpg://usuario:password@host:puerto/db
    # "postgres" como host funciona dentro de Docker Compose (DNS interno).
    SUPABASE_DB_URL: str = (
        "postgresql+asyncpg://mibici:mibici_dev@postgres:5432/mibici_sonora"
    )

    @field_validator("SUPABASE_DB_URL", mode="before")
    @classmethod
    def assemble_db_url(cls, v: str | None) -> str:
        """
        Corrige automáticamente la URL de la base de datos que entrega Render.
        Render entrega 'postgres://...' o 'postgresql://...', pero SQLAlchemy Async
        requiere explícitamente el driver asyncpg ('postgresql+asyncpg://...').
        """
        if isinstance(v, str):
            if v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://"):
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # ---- GBFS ----
    # URL base del feed GBFS v3.0 de MiBici Guadalajara.
    # Los endpoints específicos se construyen a partir de esta base:
    #   - {base}/station_information
    #   - {base}/station_status
    GBFS_BASE_URL: str = (
        "https://guadalajara.publicbikesystem.net/customer/gbfs/v3.0"
    )

    # ---- Intervalos de Polling ----
    # Cada cuántos segundos el collector consulta station_status.
    # 8 segundos (a petición del usuario para mayor granularidad).
    # Originalmente 30 segundos (TTL que reporta la API del GBFS).
    STATUS_POLL_SECONDS: int = 8

    # Cada cuántos segundos el collector consulta station_information.
    # 14400 segundos = 4 horas. Los datos estáticos cambian muy rara vez
    # (cuando agregan/quitan una estación física).
    INFO_POLL_SECONDS: int = 14400

    # ---- Zona Horaria ----
    # Los timestamps del GBFS llegan en UTC.
    # Configuramos la zona horaria local para:
    #   - Mostrar timestamps legibles en logs
    #   - Analizar patrones por hora del día (rush hour, etc.)
    #   - La sonificación cambiará según la hora local
    TIMEZONE: str = "America/Mexico_City"

    class Config:
        """
        Configuración de pydantic-settings.

        env_file: busca un archivo .env en el directorio de trabajo.
        env_file_encoding: codificación del archivo .env.
        case_sensitive: las variables de entorno son case-sensitive.
        """

        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# ---------------------------------------------------------------------------
# Instancia global de configuración.
# Se importa así: from infrastructure.config import settings
#
# ¿Por qué una instancia global?
#   En una aplicación sin framework DI complejo, es la forma más simple
#   y explícita de acceder a la configuración. El contenedor DI
#   (container.py) la inyecta donde sea necesario.
# ---------------------------------------------------------------------------
settings = Settings()
