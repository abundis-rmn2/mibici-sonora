/* ==========================================================================
   MiBici Sonora — Capa de Servicios de API
   ==========================================================================
   Centraliza todas las peticiones al backend.
   Gracias al proxy de Next.js (next.config.mjs), podemos llamar a /api/*
   y las peticiones se dirigirán a http://localhost:8000/api/*
   ========================================================================== */

// El proxy de Next.js (next.config.mjs) se encarga de redirigir a BACKEND_API_URL o localhost:8000
const API_BASE = '/api';

import { createClient } from '../utils/supabase/client';
const supabase = createClient();

/**
 * Wrapper de fetch para Debug en Consola (Muestra la ruta del tráfico)
 */
async function customFetch(url, options = {}) {
  // Solo imprimir en consola del cliente (navegador)
  if (typeof window !== 'undefined') {
    console.log(
      `%c[📡 MiBici Edge]`, 
      'background: #00ffcc; color: #000; font-weight: bold; border-radius: 4px; padding: 2px 4px;', 
      `Obteniendo datos de: ${url} ➡️ (Ruta: Vercel Proxy -> Render API -> Supabase DB)`
    );
  }
  return fetch(url, options);
}

/**
 * Obtiene todas las estaciones con su status actual
 */
export async function fetchStations() {
  const response = await customFetch(`${API_BASE}/stations`, {
    next: { tags: ['stations-data'] }
  });
  if (!response.ok) {
    throw new Error(`Error fetching stations: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Obtiene los últimos eventos detectados en el sistema
 * @param {number} limit Máximo de eventos a retornar
 */
export async function fetchLatestEvents(limit = 50) {
  const t = new Date().getTime();
  const response = await customFetch(`${API_BASE}/events/latest?limit=${limit}&_t=${t}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!response.ok) {
    throw new Error(`Error fetching events: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Obtiene todas las estaciones con su status actual directamente desde Supabase
 */
export async function fetchStationsDirect() {
  console.log(
    `%c[🔓 Supabase Direct]`, 
    'background: #ff00ff; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 4px;', 
    `Obteniendo datos de stations...`
  );
  const { data, error } = await supabase.from('stations').select('*');
  if (error) throw error;
  return data;
}

/**
 * Obtiene los últimos eventos detectados en el sistema directamente desde Supabase
 * @param {number} limit Máximo de eventos a retornar
 */
export async function fetchLatestEventsDirect(limit = 50) {
  console.log(
    `%c[🔓 Supabase Direct]`, 
    'background: #ff00ff; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 4px;', 
    `Obteniendo datos de events (limit: ${limit})...`
  );
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/**
 * Obtiene el estado del backend
 */
export async function fetchHealth() {
  const response = await customFetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Error fetching health: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Analytics endpoints
 */
export async function fetchStationSummary() {
  const res = await customFetch(`${API_BASE}/analytics/station-summary`);
  if (!res.ok) throw new Error("Error fetching station summary");
  return res.json();
}

export async function fetchCurrentStatus() {
  const res = await customFetch(`${API_BASE}/analytics/current-status`);
  if (!res.ok) throw new Error("Error fetching current status");
  return res.json();
}

export async function fetchHistory(stationId, limit = 100, start, end) {
  let url = `${API_BASE}/analytics/history/${stationId}?limit=${limit}`;
  if (start) url += `&start=${start}`;
  if (end) url += `&end=${end}`;
  const res = await customFetch(url);
  if (!res.ok) throw new Error("Error fetching history");
  return res.json();
}

export async function fetchAnalyticsEvents(limit = 50, stationId) {
  let url = `${API_BASE}/analytics/events?limit=${limit}`;
  if (stationId) url += `&station_id=${stationId}`;
  const res = await customFetch(url);
  if (!res.ok) throw new Error("Error fetching analytics events");
  return res.json();
}

export async function fetchFlow(limit = 20, start, end) {
  let url = `${API_BASE}/analytics/flow?limit=${limit}`;
  if (start) url += `&start=${start}`;
  if (end) url += `&end=${end}`;
  const res = await customFetch(url);
  if (!res.ok) throw new Error("Error fetching flow");
  return res.json();
}

export async function fetchBalance(topN = 25, start, end) {
  let url = `${API_BASE}/analytics/balance?top_n=${topN}`;
  if (start) url += `&start=${start}`;
  if (end) url += `&end=${end}`;
  const res = await customFetch(url);
  if (!res.ok) throw new Error("Error fetching balance");
  return res.json();
}

export async function fetchMovement(threshold = 8, start, end) {
  let url = `${API_BASE}/analytics/movement?threshold=${threshold}`;
  if (start) url += `&start=${start}`;
  if (end) url += `&end=${end}`;
  const res = await customFetch(url);
  if (!res.ok) throw new Error("Error fetching movement");
  return res.json();
}

// ============================================================
// Endpoints de Analítica Urbana Avanzada
// ============================================================

/** Metabolismo Urbano — flujo neto fuente/sumidero por ventana horaria */
export async function fetchUrbanMetabolism(timeWindow = 'morning') {
  const res = await customFetch(`${API_BASE}/analytics/urban/metabolism?time_window=${timeWindow}`);
  if (!res.ok) throw new Error("Error fetching urban metabolism");
  return res.json();
}

/** Líneas de Deseo — corredores O/D de alta fricción inferidos */
export async function fetchDesireLines() {
  const res = await customFetch(`${API_BASE}/analytics/urban/desire-lines`);
  if (!res.ok) throw new Error("Error fetching desire lines");
  return res.json();
}

/** Índice de Presión Multimodal — volatilidad de inventario (STDDEV) */
export async function fetchMultimodalStress() {
  const res = await customFetch(`${API_BASE}/analytics/urban/multimodal-stress`);
  if (!res.ok) throw new Error("Error fetching multimodal stress");
  return res.json();
}

/** Topología de Red — Betweenness Centrality (NetworkX) */
export async function fetchNetworkCentrality() {
  const res = await customFetch(`${API_BASE}/analytics/network/centrality`);
  if (!res.ok) throw new Error("Error fetching network centrality");
  return res.json();
}

/** LISA — Clústeres de autocorrelación espacial local (HH/LL/HL/LH) */
export async function fetchLisaClusters() {
  const res = await customFetch(`${API_BASE}/analytics/network/lisa`);
  if (!res.ok) throw new Error("Error fetching LISA clusters");
  return res.json();
}

/** Derby de Movilidad — velocidades inferidas de trayectos */
export async function fetchBikeDerby() {
  const res = await customFetch(`${API_BASE}/analytics/playful/derby`);
  if (!res.ok) throw new Error("Error fetching bike derby");
  return res.json();
}

/** Viaje del Héroe — cronología de la estación protagonista */
export async function fetchHeroJourney(stationId) {
  let url = `${API_BASE}/analytics/playful/hero-journey`;
  if (stationId) url += `?station_id=${stationId}`;
  const res = await customFetch(url);
  if (!res.ok) throw new Error("Error fetching hero journey");
  return res.json();
}
