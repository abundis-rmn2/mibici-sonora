# =============================================================================
# MiBici Sonora — Dockerfile del Backend
# =============================================================================
# Imagen ligera de Python 3.12 que contiene:
#   - La API FastAPI (se levanta automáticamente con uvicorn)
#   - El collector GBFS (se controla manualmente via CLI)
#
# El CMD por defecto solo levanta la API.
# Para el collector, usa: docker compose exec backend python -m cli <comando>
# =============================================================================

FROM python:3.12-slim

# Establecer el directorio de trabajo dentro del contenedor.
# Todos los comandos posteriores se ejecutan desde aquí.
WORKDIR /app

# Primero copiamos SOLO requirements.txt para aprovechar el cache de Docker.
# Si las dependencias no cambian, Docker reutiliza esta capa sin reinstalar.
COPY requirements.txt .

# Instalar dependencias de Python.
# --no-cache-dir: no guardar cache de pip (reduce tamaño de imagen)
RUN pip install --no-cache-dir -r requirements.txt

# Ahora copiamos todo el código fuente.
# Esta capa se reconstruye cada vez que cambia algún archivo .py
COPY . .

# Comando por defecto: levantar SOLO la API con uvicorn.
# Usamos el modo shell (sh -c) para que lea la variable de entorno $PORT asignada por Render.
# Si no existe, usa 8000 por defecto.
CMD sh -c "uvicorn adapters.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"
