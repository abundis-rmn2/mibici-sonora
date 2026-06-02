# =============================================================================
# MiBici Sonora — Motor de Base de Datos (Database Engine)
# =============================================================================
# CAPA: Infraestructura
#
# Configura la conexión a PostgreSQL usando SQLAlchemy 2.0 async.
#
# ¿Qué hace este archivo?
#   1. Crea el "engine": el motor que gestiona el pool de conexiones
#   2. Crea el "session factory": fábrica de sesiones para transacciones
#   3. Define la clase Base para los modelos ORM
#
# IMPORTANTE:
#   - Usa asyncpg como driver (conexiones async, más rendimiento)
#   - El engine se crea UNA vez y se reutiliza en toda la aplicación
#   - Las sesiones son efímeras: se crean por operación y se cierran
#
# PRINCIPIO SOLID — Single Responsibility:
#   Este archivo SOLO configura la conexión a la DB.
#   Los modelos ORM están en models.py.
#   Los repositorios están en adapters/postgres_repos.py.
# =============================================================================

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from infrastructure.config import settings


# ---------------------------------------------------------------------------
# Engine: gestiona el pool de conexiones a PostgreSQL.
#
# Parámetros importantes:
#   - echo=False: no logear cada query SQL (activar para debug: echo=True)
#   - pool_size=5: mantener 5 conexiones abiertas en el pool
#   - max_overflow=10: permitir hasta 10 conexiones extra en picos
#
# El engine se crea al importar este módulo y se reutiliza globalmente.
# ---------------------------------------------------------------------------
engine = create_async_engine(
    settings.SUPABASE_DB_URL,
    echo=False,  # Cambiar a True para ver queries SQL en los logs
    pool_size=5,
    max_overflow=10,
)


# ---------------------------------------------------------------------------
# Session Factory: crea sesiones de base de datos.
#
# Una sesión es como una "transacción abierta":
#   - Acumula operaciones (INSERT, UPDATE, DELETE)
#   - Las ejecuta todas al hacer commit()
#   - Las revierte todas al hacer rollback()
#
# expire_on_commit=False: después de commit(), los objetos siguen
# accesibles sin hacer otra query. Útil para retornar datos recién guardados.
# ---------------------------------------------------------------------------
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ---------------------------------------------------------------------------
# Base declarativa: clase padre de todos los modelos ORM.
#
# SQLAlchemy necesita una clase base que:
#   1. Registre todos los modelos (tablas)
#   2. Genere el SQL de CREATE TABLE automáticamente
#   3. Mantenga el "metadata" (esquema de la DB)
#
# Todos los modelos en models.py heredan de esta clase.
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    """
    Clase base para todos los modelos ORM de SQLAlchemy.

    Cada modelo que herede de Base se convierte en una tabla SQL.
    Ejemplo:
        class StationModel(Base):
            __tablename__ = "stations"
            ...

    SQLAlchemy registra automáticamente todas las tablas hijas
    y puede crear/destruir el esquema completo con:
        Base.metadata.create_all(engine)
    """

    pass


async def get_session() -> AsyncSession:
    """
    Genera una sesión de base de datos para usar en un contexto async.

    Uso típico:
        async with async_session_factory() as session:
            # ... hacer operaciones
            await session.commit()

    Esta función es un atajo que se usa en el contenedor DI
    y en las dependencias de FastAPI.

    Returns:
        Una sesión async de SQLAlchemy
    """
    async with async_session_factory() as session:
        yield session
