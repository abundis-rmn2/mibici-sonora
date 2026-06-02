# Guía de Despliegue: Arquitectura Distribuida (MiBici Sonora)

Esta guía explica la topología completa de la arquitectura descentralizada de MiBici Sonora, dividida en tres capas: **Ingesta (Edge)**, **Procesamiento (Cloud API)** y **Presentación (Frontend)**.

---

## 1. Capa de Ingesta: Nodos Edge (Raspberry Pi / Servidor Local)

El Nodo Edge es una computadora encargada exclusivamente de recolectar los datos de la ciudad, auditarlos localmente y empujar únicamente las diferencias (diffs) hacia la nube.

### Configuración del Entorno (`.env`)
```dotenv
COMPOSE_PROFILES=edge
LOCAL_DB_URL=postgresql://mibici:mibici_dev@postgres_local:5432/mibici_audit
POSTGRES_VOLUME_PATH=./postgres_data

# URL del Connection Pooler (Pto. 6543 o el configurado en Supabase)
SUPABASE_DB_URL=postgresql://postgres.tu-proyecto:password@aws-0-region.pooler.supabase.com:6543/postgres

SECRET_TOKEN=tu-token-secreto
FRONTEND_URL=https://mibici-sonora.vercel.app
```

### Despliegue
En cualquier dispositivo con Docker (vía terminal o Dockge):
```bash
COMPOSE_PROFILES=edge docker compose up -d --build
```
*Nota: Si se usa Dockge, se puede inyectar `COMPOSE_PROFILES=edge` directamente en la configuración del entorno gráfico.*

---

## 2. Capa de Base de Datos (Supabase)

Supabase centraliza la información. Recibe los *diffs* del Nodo Edge y sirve los datos complejos a la API de Render.

### Seguridad Crítica: Row Level Security (RLS)
Dado que nuestra arquitectura **no utiliza el cliente de Supabase JS** en el frontend, sino que se conecta directamente mediante PostgreSQL desde el backend (Render/Edge), es fundamental **bloquear los endpoints públicos (PostgREST)** para evitar fugas de datos si tu clave anónima (`anon key`) se expone.

**Pasos de seguridad en Supabase:**
1. Ve al Dashboard de Supabase -> **Authentication** -> **Policies**.
2. Habilita **Row Level Security (RLS)** en todas tus tablas (`stations`, `snapshots`, `events`, etc.).
3. **No crees ninguna política (Policy).** Al habilitar RLS sin políticas, deniegas automáticamente todo el tráfico público proveniente de la web.
4. *Tus contenedores de Render y Raspberry Pi seguirán funcionando perfectamente porque se conectan usando la contraseña del rol `postgres` nativo, el cual hace bypass automático del RLS.*

---

## 3. Capa de Procesamiento Analítico (Render)

La API construida en FastAPI (Python) vive en Render. Su único trabajo es realizar matemáticas espaciales y devolver JSONs ligeros. Es 100% *stateless*.

### Despliegue en Render
1. Crea un nuevo **Web Service**.
2. Conecta el repositorio de GitHub.
3. Configuración crítica:
   - **Branch:** `edge` (o `main` si ya se fusionó)
   - **Language:** `Docker`
   - **Root Directory:** `backend`
   - **Health Check Path:** `/`
4. **Environment Variables:**
   - `SUPABASE_DB_URL` = La misma cadena de conexión (Connection Pooler) usada en el Edge Node.

---

## 4. Capa de Presentación (Vercel)

El frontend en Next.js se encarga de las visualizaciones interactivas. Actúa como un proxy inverso hacia Render para evitar problemas de CORS y ocultar la API real.

### Despliegue en Vercel
1. Conecta el proyecto en Vercel al repositorio.
2. Ve a **Settings -> Environment Variables**.
3. Asegúrate de configurar las siguientes variables marcando los entornos de **Production** y **Preview**:
   - `BACKEND_API_URL` = URL pública del servicio de Render (Ej: `https://mibici-sonora-api.onrender.com`). *Importante: NO usar prefijo NEXT_PUBLIC_.*
   - `SECRET_TOKEN` = El mismo token secreto configurado en el Edge Node (Ej: `tu-token-secreto`). Permite invalidar el caché estático vía webhooks.
4. Ejecuta un nuevo Deploy o fusiona tus cambios a la rama `main` para que Vercel reconstruya la aplicación.

---

## Flujo de Vida de los Datos (End-to-End)
1. **Edge Node:** Consulta GBFS cada 16s -> Detecta 8 cambios -> *INSERT* a Supabase.
2. **Edge Node:** Dispara Webhook -> HTTP POST a `Vercel (/webhook/revalidate)` con `SECRET_TOKEN`.
3. **Vercel:** Valida el token -> Purga el caché de Next.js.
4. **Navegador:** Usuario entra a la web -> Pide `/api/events` a Vercel.
5. **Vercel Proxy:** Pide `/api/events` a Render en secreto.
6. **Render:** Consulta a Supabase vía asyncpg -> Calcula JSON -> Responde a Vercel -> Responde al Navegador.
