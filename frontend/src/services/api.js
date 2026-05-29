/* ==========================================================================
   MiBici Sonora — Capa de Servicios de API
   ==========================================================================
   Centraliza todas las peticiones al backend.
   Gracias al proxy de Next.js (next.config.mjs), podemos llamar a /api/*
   y las peticiones se dirigirán a http://localhost:8000/api/*
   ========================================================================== */

// El proxy de Next.js (next.config.mjs) se encarga de redirigir a BACKEND_API_URL o localhost:8000
const API_BASE = '/api';

/**
 * Obtiene todas las estaciones con su status actual
 */
export async function fetchStations() {
  const response = await fetch(`${API_BASE}/stations`);
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
  const response = await fetch(`${API_BASE}/events/latest?limit=${limit}&_t=${t}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!response.ok) {
    throw new Error(`Error fetching events: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Obtiene el estado del backend
 */
export async function fetchHealth() {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Error fetching health: ${response.statusText}`);
  }
  return response.json();
}
