# Guía de Despliegue: Nodos Edge (MiBici Sonora)

Esta guía explica cómo dar de alta un "Nodo Edge" del proyecto MiBici Sonora. Un Nodo Edge es cualquier computadora encargada exclusivamente de recolectar los datos de la ciudad, auditarlos localmente y empujar únicamente las diferencias (diffs) hacia la nube.

La ventaja de esta arquitectura es que puedes convertir **cualquier dispositivo** capaz de correr Docker en un Nodo Edge, ya sea una Raspberry Pi, una PC de escritorio vieja, o un servidor conectado por VPN.

---

## 1. Requisitos Previos Universales

Sin importar el dispositivo, necesitas tener instalados estos tres componentes fundamentales:
- **Git** (Para descargar el código fuente)
- **Docker** y **Docker Compose** (Para levantar la base de datos local y el Worker)
- Acceso a Internet (Para consumir la API de MiBici y comunicarse con Supabase)

---

## 2. Instrucciones Generales de Despliegue

### Paso 1: Obtener el Código
En tu dispositivo Edge, clona el repositorio y asegúrate de estar en la rama de despliegue (`edge`):
```bash
git clone https://github.com/tu-usuario/mibici-sonora.git
cd mibici-sonora
git checkout edge
```

### Paso 2: Las Variables de Entorno (`.env`)
Crea el archivo `.env` en la raíz del proyecto. Este archivo dictará el comportamiento del nodo.
```dotenv
# ==========================================
# Entorno Local del Nodo (Auditoría)
# ==========================================
# Docker resolverá "postgres_local" mágicamente. No cambies esto.
LOCAL_DB_URL=postgresql://mibici:mibici_dev@postgres_local:5432/mibici_audit
# Ruta en el disco duro físico del Edge node donde se guardarán los datos crudos
POSTGRES_VOLUME_PATH=./postgres_data

# ==========================================
# Conexión a la Nube (Supabase)
# ==========================================
# ⚠️ IMPORTANTE: Si estás en una Raspberry o red sin IPv6, DEBES usar 
# la URL del Connection Pooler (puerto 6543), NO la directa (puerto 5432).
SUPABASE_DB_URL=postgresql://postgres.tu-proyecto:password@aws-0-region.pooler.supabase.com:6543/postgres

# ==========================================
# Webhook y Configuración (Opcional)
# ==========================================
SECRET_TOKEN=token-de-seguridad
FRONTEND_URL=https://mibici-sonora.vercel.app
```

### Paso 3: Encendido del Nodo (Modo Consola)
Para arrancar el nodo en cualquier PC normal o servidor:
```bash
COMPOSE_PROFILES=edge docker compose up -d --build
```
Esto construirá la imagen optimizada para la arquitectura de ese dispositivo específico (ej. `arm64` en Raspberry, `amd64` en PC) y encenderá la recolección continua.

---

## 3. Despliegue con Dockge (Recomendado para HomeLabs / Raspberry Pi)

Si usas Dockge para gestionar tus contenedores en el dispositivo:
1. Clona el repo directamente dentro de la carpeta de stacks de Dockge (ej. `/opt/stacks/mibici-sonora`).
2. Entra a la interfaz de Dockge y selecciona el stack `mibici-sonora`.
3. En el panel lateral derecho, pega tus variables del `.env` normal, pero **agrega esta línea crítica al principio**:
   ```dotenv
   COMPOSE_PROFILES=edge
   ```
4. Presiona el botón "Deploy" (y usa "Update" + `--build` en la consola de Dockge si el código cambió). Dockge usará la variable de entorno para saber que solo debe levantar la base local y el worker.

---

## 4. Topologías Teóricas (Escalabilidad y Seguridad)

### A. Raspberry Pi "Bare-Metal" (Tu configuración actual)
- **Rol:** Dispositivo de bajo consumo, conectado 24/7 en tu casa u oficina.
- **Ventaja:** Si se va el internet, la base de datos de auditoría local (`postgres_local`) no se pierde gracias al mapeo de volúmenes en la tarjeta SD o SSD local. 
- **Consideración:** Requiere usar la imagen `postgres:16-alpine` (ya configurada) porque la imagen estándar de PostGIS tiene problemas con procesadores ARM en algunas versiones.

### B. PC Normal / Servidor Local (Windows/Linux/Mac)
- **Rol:** Máquina de uso diario o servidor secundario.
- **Proceso:** Exactamente igual. Docker se encargará de virtualizar la red local automáticamente adaptándose a `amd64`. Es ideal para hacer pruebas intensivas de código antes de subir el Worker a producción, ya que compila más rápido que la Raspberry Pi.

### C. Nodos en Red Privada Virtual (Tailscale / ZeroTier)
Si por cuestiones de seguridad no quieres que el Nodo Edge se comunique directamente con una base de datos pública en la nube (como Supabase), puedes crear una VPN.

- **Rol:** Nodos altamente seguros que envían información a un servidor analítico central privado (on-premise).
- **Proceso:**
  1. Instalas **Tailscale** en tu Raspberry Pi (Nodo Edge) y en tu Servidor Principal (donde vive la base de datos consolidada).
  2. En el archivo `.env` de tu Raspberry Pi, cambias la URL para que apunte a la IP mágica de la VPN de tu servidor principal:
     `SUPABASE_DB_URL=postgresql://usuario:pass@100.100.100.x:5432/mibici`
  3. **Resultado:** Todo el tráfico entre la ciudad/nodo y tu servidor analítico estará cifrado y fuera del internet público. Ideal para infraestructura crítica o si dejas el Nodo Edge físicamente en un lugar no controlado (como dentro de un SITE remoto).
