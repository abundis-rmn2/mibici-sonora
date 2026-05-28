# =============================================================================
# MiBici Sonora — CLI (Interfaz de Línea de Comandos)
# =============================================================================
# CAPA: Infraestructura (punto de entrada)
#
# Este archivo es tu CONTROL MANUAL del sistema.
# Cada comando te permite ejecutar una operación específica paso a paso,
# para que entiendas exactamente qué hace el sistema en cada momento.
#
# COMANDOS DISPONIBLES:
#   python -m cli init-db          → Crear tablas en PostgreSQL
#   python -m cli sync-stations    → Sincronizar estaciones desde GBFS
#   python -m cli collect-once     → Recolectar UN snapshot + detectar eventos
#   python -m cli start-collector  → Iniciar polling automático (cada 30s)
#
# ARQUITECTURA HEXAGONAL:
#   El CLI es un ADAPTADOR DE ENTRADA (driving adapter):
#   - Recibe comandos del usuario
#   - Los traduce a llamadas a los casos de uso
#   - Muestra los resultados en la terminal
#
# ¿Por qué usamos Click?
#   Click es un framework para CLIs que ofrece:
#   - Decoradores para definir comandos (@cli.command())
#   - Ayuda automática (--help)
#   - Validación de argumentos
#   - Colores y formato en terminal
# =============================================================================

import asyncio
import logging
import sys

import click

# Configurar logging para que los mensajes se muestren en la terminal.
# Level=INFO muestra mensajes informativos (no debug).
# El formato incluye: hora, nombre del módulo, y el mensaje.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)

logger = logging.getLogger(__name__)


def _run_async(coro):
    """
    Ejecuta una coroutine async desde código síncrono.

    Click es síncrono, pero nuestros casos de uso son async.
    Esta función es el puente entre ambos mundos.

    Args:
        coro: Coroutine async a ejecutar

    Returns:
        El resultado de la coroutine
    """
    return asyncio.run(coro)


# =============================================================================
# Grupo principal de comandos CLI
# =============================================================================
@click.group()
def cli():
    """
    🚲 MiBici Sonora — Control Manual del Sistema

    Comandos para controlar paso a paso el sistema de monitoreo.
    Usa --help en cada comando para ver opciones.

    Ejemplos:

        python -m cli init-db

        python -m cli sync-stations

        python -m cli collect-once

        python -m cli start-collector
    """
    pass


# =============================================================================
# Comando: init-db
# =============================================================================
@cli.command()
def init_db():
    """
    📦 Crear tablas en PostgreSQL.

    Crea las tablas stations, snapshots y events en la base de datos.
    Es seguro ejecutarlo múltiples veces: no borra datos existentes
    (solo crea tablas que no existen).

    Equivale a: CREATE TABLE IF NOT EXISTS ...
    """
    click.echo("📦 Creando tablas en la base de datos...")

    async def _init():
        # Importar aquí para evitar problemas de importación circular
        from infrastructure.database import engine, Base
        # Importar models para que SQLAlchemy los registre
        import infrastructure.models  # noqa: F401

        # create_all() genera el SQL de CREATE TABLE para cada modelo
        # que hereda de Base. Si la tabla ya existe, la ignora.
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            await conn.run_sync(Base.metadata.create_all)

        click.echo("✅ Tablas creadas exitosamente:")
        click.echo("   - stations  (información de estaciones)")
        click.echo("   - snapshots (estado dinámico por estación)")
        click.echo("   - events    (eventos bike_taken/bike_returned)")

        # Cerrar el engine limpiamente
        await engine.dispose()

    _run_async(_init())


# =============================================================================
# Comando: sync-stations
# =============================================================================
@cli.command()
def sync_stations():
    """
    🔄 Sincronizar estaciones desde la API GBFS.

    Consulta station_information del GBFS de MiBici y guarda
    las ~300 estaciones en la tabla stations de PostgreSQL.

    Usa upsert: si la estación ya existe, actualiza sus datos.
    Seguro de ejecutar múltiples veces.
    """
    click.echo("🔄 Sincronizando estaciones desde GBFS...")

    async def _sync():
        from infrastructure.container import Container

        # El contenedor crea todas las dependencias automáticamente
        container = Container()

        # Ejecutar el caso de uso
        count = await container.sync_stations.execute()

        click.echo(f"\n✅ {count} estaciones sincronizadas exitosamente")

        # Mostrar algunas estaciones como ejemplo
        stations = await container.station_repo.get_all()
        click.echo(f"\nPrimeras 5 estaciones:")
        for s in stations[:5]:
            click.echo(
                f"  [{s.region}] {s.short_name}: {s.name} "
                f"({s.lat:.4f}, {s.lon:.4f}) cap={s.capacity}"
            )

        # Cleanup
        from infrastructure.database import engine
        await engine.dispose()

    _run_async(_sync())


# =============================================================================
# Comando: collect-once
# =============================================================================
@cli.command()
def collect_once():
    """
    📸 Recolectar UN snapshot de station_status.

    Consulta station_status del GBFS, guarda los snapshots
    y detecta eventos comparando con el snapshot anterior.

    Úsalo para entender el flujo antes de activar el polling automático.

    La PRIMERA ejecución no detectará eventos porque no hay
    snapshot anterior para comparar. A partir de la segunda,
    empezarás a ver eventos.
    """
    click.echo("📸 Recolectando snapshot de station_status...")

    async def _collect():
        from infrastructure.container import Container

        container = Container()

        # Cargar el mapa de zonas (necesario para clasificar eventos)
        stations = await container.station_repo.get_all()
        zones = {s.id: s.region for s in stations}
        container.collect_status.set_station_zones(zones)

        if not stations:
            click.echo(
                "⚠️ No hay estaciones en la DB. "
                "Ejecuta primero: python -m cli sync-stations"
            )
            return

        # Ejecutar la recolección
        result = await container.collect_status.execute()

        click.echo(f"\n✅ Recolección completada:")
        click.echo(f"   📊 Snapshots guardados: {result['snapshots']}")
        click.echo(f"   🎯 Eventos detectados:  {result['events']}")

        if result["events"] == 0:
            click.echo(
                "\n💡 Tip: Si es la primera ejecución, es normal que no "
                "haya eventos. Ejecuta el comando otra vez en 30 segundos "
                "para ver eventos detectados."
            )

        # Cleanup
        from infrastructure.database import engine
        await engine.dispose()

    _run_async(_collect())


# =============================================================================
# Comando: start-collector
# =============================================================================
@cli.command()
@click.option(
    "--interval",
    default=8,
    help="Intervalo de polling en segundos (default: 8)",
)
def start_collector(interval: int):
    """
    🚀 Iniciar el collector automático.

    Inicia un loop que cada N segundos (default 30):
    1. Consulta station_status del GBFS
    2. Guarda snapshots en PostgreSQL
    3. Detecta y guarda eventos

    Presiona Ctrl+C para detener.

    El intervalo de 8 segundos permite capturar eventos con mayor
    frecuencia para una sonificación más granular.
    """
    click.echo(f"🚀 Iniciando collector (polling cada {interval}s)...")
    click.echo("   Presiona Ctrl+C para detener\n")

    async def _run_collector():
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from infrastructure.container import Container
        from infrastructure.config import settings

        container = Container()

        # Cargar el mapa de zonas
        stations = await container.station_repo.get_all()
        zones = {s.id: s.region for s in stations}
        container.collect_status.set_station_zones(zones)

        if not stations:
            click.echo(
                "⚠️ No hay estaciones en la DB. "
                "Ejecuta primero: python -m cli sync-stations"
            )
            return

        click.echo(f"📍 {len(stations)} estaciones cargadas")

        # Contador de ciclos para el log
        cycle_count = 0

        async def _poll_status():
            """Job que se ejecuta cada N segundos."""
            nonlocal cycle_count
            cycle_count += 1
            logger.info(f"--- Ciclo #{cycle_count} ---")
            try:
                result = await container.collect_status.execute()
                click.echo(
                    f"   Ciclo #{cycle_count}: "
                    f"{result['snapshots']} snapshots, "
                    f"{result['events']} eventos"
                )
            except Exception as e:
                logger.error(f"❌ Error en ciclo #{cycle_count}: {e}")

        async def _poll_stations():
            """Job que sincroniza estaciones cada 4 horas."""
            logger.info("🔄 Re-sincronizando estaciones...")
            try:
                count = await container.sync_stations.execute()
                # Actualizar mapa de zonas
                fresh_stations = await container.station_repo.get_all()
                zones = {s.id: s.region for s in fresh_stations}
                container.collect_status.set_station_zones(zones)
                click.echo(f"   📍 Estaciones re-sincronizadas: {count}")
            except Exception as e:
                logger.error(f"❌ Error sincronizando estaciones: {e}")

        # Configurar APScheduler con dos jobs
        scheduler = AsyncIOScheduler()

        # Job 1: Recolectar status cada N segundos
        scheduler.add_job(
            _poll_status,
            "interval",
            seconds=interval,
            id="poll_status",
            name="Recolectar station_status",
        )

        # Job 2: Sincronizar estaciones cada 4 horas
        scheduler.add_job(
            _poll_stations,
            "interval",
            seconds=settings.INFO_POLL_SECONDS,
            id="poll_stations",
            name="Sincronizar station_information",
        )

        scheduler.start()
        click.echo(f"\n✅ Scheduler activo con 2 jobs:")
        click.echo(f"   📊 station_status: cada {interval}s")
        click.echo(f"   📍 station_information: cada {settings.INFO_POLL_SECONDS}s")
        click.echo(f"\n   Presiona Ctrl+C para detener\n")

        # Mantener el proceso corriendo hasta Ctrl+C
        try:
            while True:
                await asyncio.sleep(1)
        except (KeyboardInterrupt, SystemExit):
            click.echo("\n🛑 Deteniendo collector...")
            scheduler.shutdown()
            from infrastructure.database import engine
            await engine.dispose()
            click.echo("👋 Collector detenido limpiamente")

    try:
        _run_async(_run_collector())
    except KeyboardInterrupt:
        click.echo("\n👋 ¡Hasta luego!")


# =============================================================================
# Punto de entrada: python -m cli
# =============================================================================
if __name__ == "__main__":
    cli()
