/* ==========================================================================
   MiBici Sonora — Capa de Servicios de API (Consumo Directo e Invocación a API)
   ==========================================================================
   Centraliza las llamadas del frontend.
   - Rutas simples y analíticas precalculadas se consultan DIRECTAMENTE a Supabase.
   - Rutas dinámicas (con filtros de tiempo elegidos por el usuario) y lógicas
     complejas de negocio (como el Viaje del Héroe) se consultan al backend de FastAPI.
   ========================================================================== */

import { createClient } from '../utils/supabase/client';
const supabase = createClient();

// El proxy de Next.js (next.config.mjs) se encarga de redirigir a BACKEND_API_URL o localhost:8000
const API_BASE = '/api';

/**
 * Wrapper de fetch para Debug en Consola (Muestra la ruta del tráfico de FastAPI)
 */
async function customFetch(url, options = {}) {
  if (typeof window !== 'undefined') {
    console.log(
      `%c[📡 FastAPI Render]`, 
      'background: #00ffcc; color: #000; font-weight: bold; border-radius: 4px; padding: 2px 4px;', 
      `Consultando endpoint dinámico: ${url}`
    );
  }
  return fetch(url, options);
}

/**
 * Log para peticiones directas a Supabase
 */
function logSupabase(tableOrView, details = '') {
  if (typeof window !== 'undefined') {
    console.log(
      `%c[🔓 Supabase Direct]`, 
      'background: #ff00ff; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 4px;', 
      `Consultando: ${tableOrView} ${details}`
    );
  }
}

/* ==========================================================================
   1. CONSUMO DIRECTO DESDE SUPABASE (Migración Fase 1 y 2)
   ========================================================================== */

/**
 * Obtiene todas las estaciones con su status actual desde la vista stations_with_latest_snapshot
 */
export async function fetchStations() {
  logSupabase('stations_with_latest_snapshot');
  const { data, error } = await supabase
    .from('stations_with_latest_snapshot')
    .select('*');
  if (error) throw error;
  
  // Mapeamos para mantener compatibilidad si es necesario
  return data.map(s => ({
    id: s.id,
    name: s.name,
    short_name: s.short_name,
    lat: s.lat,
    lon: s.lon,
    capacity: s.capacity,
    address: s.address,
    region: s.region,
    bikes: s.bikes,
    docks: s.docks,
    disabled: s.disabled,
    last_reported: s.last_reported
  }));
}

/**
 * Alias para fetchStations usado por useStations hook
 */
export async function fetchStationsDirect() {
  return fetchStations();
}

/**
 * Obtiene los últimos eventos detectados en el sistema desde la tabla events
 */
export async function fetchLatestEvents(limit = 50) {
  logSupabase('events', `(limit: ${limit})`);
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/**
 * Alias para fetchLatestEventsDirect usado por useEvents hook
 */
export async function fetchLatestEventsDirect(limit = 50) {
  return fetchLatestEvents(limit);
}

/**
 * Obtiene el resumen estático de estaciones desde la vista de Supabase
 */
export async function fetchStationSummary() {
  logSupabase('stations_with_latest_snapshot (resumen estático)');
  const { data, error } = await supabase
    .from('stations_with_latest_snapshot')
    .select('id, name, capacity, region, lat, lon');
  if (error) throw error;
  return data.map(s => ({
    station_id: s.id,
    name: s.name,
    capacity: s.capacity,
    region: s.region,
    lat: s.lat,
    lon: s.lon
  }));
}

/**
 * Obtiene el estado actual (bikes, docks) de las estaciones desde la vista de Supabase
 */
export async function fetchCurrentStatus() {
  logSupabase('stations_with_latest_snapshot (status actual)');
  const { data, error } = await supabase
    .from('stations_with_latest_snapshot')
    .select('id, bikes, docks');
  if (error) throw error;
  
  const statusMap = {};
  data.forEach(s => {
    statusMap[s.id] = {
      station_id: s.id,
      bikes: s.bikes,
      docks: s.docks
    };
  });
  return statusMap;
}

/**
 * Obtiene el historial de snapshots de una estación directamente desde Supabase
 */
export async function fetchHistory(stationId, limit = 100, start, end) {
  logSupabase('snapshots', `(station_id: ${stationId}, limit: ${limit})`);
  let query = supabase
    .from('snapshots')
    .select('station_id, timestamp, bikes, docks, disabled, is_renting, is_returning')
    .eq('station_id', stationId)
    .order('timestamp', { ascending: false });

  if (start) query = query.gte('timestamp', start);
  if (end) query = query.lte('timestamp', end);
  
  query = query.limit(limit);
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Obtiene eventos filtrados por estación o límite directamente desde Supabase
 */
export async function fetchAnalyticsEvents(limit = 50, stationId) {
  logSupabase('events', `(analytics filter, limit: ${limit})`);
  let query = supabase
    .from('events')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (stationId) query = query.eq('station_id', stationId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/* ==========================================================================
   2. CONSUMO DE ANALÍTICAS PRE-CALCULADAS (Edge Worker ➡️ Supabase)
   ========================================================================== */

/** Metabolismo Urbano — fuentes y sumideros precalculados por ventana horaria */
export async function fetchUrbanMetabolism(timeWindow = 'morning') {
  logSupabase('analytics_urban_metabolism', `(time_window: ${timeWindow})`);
  const { data, error } = await supabase
    .from('analytics_urban_metabolism')
    .select('*')
    .eq('time_window', timeWindow);
  if (error) throw error;
  
  // Ordenar por valor absoluto del flujo neto (descendente) en memoria para emular la lógica original
  return data.sort((a, b) => Math.abs(b.net_flow) - Math.abs(a.net_flow));
}

/** Líneas de Deseo — corredores O/D precalculados */
export async function fetchDesireLines() {
  logSupabase('analytics_desire_lines');
  const { data, error } = await supabase
    .from('analytics_desire_lines')
    .select('*')
    .order('trip_volume', { ascending: false });
  if (error) throw error;
  return data;
}

/** Índice de Presión Multimodal — volatilidad de inventario precalculada */
export async function fetchMultimodalStress() {
  logSupabase('analytics_multimodal_stress');
  const { data, error } = await supabase
    .from('analytics_multimodal_stress')
    .select('*')
    .order('volatility_index', { ascending: false });
  if (error) throw error;
  return data;
}

/** Topología de Red — Betweenness Centrality precalculada */
export async function fetchNetworkCentrality() {
  logSupabase('analytics_centrality_results');
  const { data, error } = await supabase
    .from('analytics_centrality_results')
    .select('*')
    .order('centrality_index', { ascending: false });
  if (error) throw error;
  return data;
}

/** LISA — Clústeres de autocorrelación espacial local precalculados */
export async function fetchLisaClusters() {
  logSupabase('analytics_lisa_results');
  const { data, error } = await supabase
    .from('analytics_lisa_results')
    .select('*');
  if (error) throw error;
  return data;
}

/** Derby de Movilidad — velocidades inferidas precalculadas */
export async function fetchBikeDerby() {
  logSupabase('analytics_bike_derby');
  const { data, error } = await supabase
    .from('analytics_bike_derby')
    .select('*')
    .order('inferred_speed_kmh', { ascending: false });
  if (error) throw error;
  return data;
}

/* ==========================================================================
   3. CONSULTAS DINÁMICAS (FastAPI en Render ➡️ API en Vivo)
   ========================================================================== */

/** Obtiene el estado del backend */
export async function fetchHealth() {
  const response = await customFetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Error fetching health: ${response.statusText}`);
  }
  return response.json();
}

/** Consulta de ventana dinámica de flujo */
export async function fetchFlow(limit = 20, start, end) {
  let url = `${API_BASE}/analytics/flow?limit=${limit}`;
  if (start) url += `&start=${start}`;
  if (end) url += `&end=${end}`;
  const res = await customFetch(url);
  if (!res.ok) throw new Error("Error fetching flow");
  return res.json();
}

/** Consulta de ventana dinámica de balance */
export async function fetchBalance(topN = 25, start, end) {
  let url = `${API_BASE}/analytics/balance?top_n=${topN}`;
  if (start) url += `&start=${start}`;
  if (end) url += `&end=${end}`;
  const res = await customFetch(url);
  if (!res.ok) throw new Error("Error fetching balance");
  return res.json();
}

/** Consulta de ventana dinámica de clasificación de movimientos */
export async function fetchMovement(threshold = 8, start, end) {
  let url = `${API_BASE}/analytics/movement?threshold=${threshold}`;
  if (start) url += `&start=${start}`;
  if (end) url += `&end=${end}`;
  const res = await customFetch(url);
  if (!res.ok) throw new Error("Error fetching movement");
  return res.json();
}

/** Viaje del Héroe — Cronología procedimental y narrativa de estación */
export async function fetchHeroJourney(stationId) {
  let url = `${API_BASE}/analytics/playful/hero-journey`;
  if (stationId) url += `?station_id=${stationId}`;
  const res = await customFetch(url);
  if (!res.ok) throw new Error("Error fetching hero journey");
  return res.json();
}
