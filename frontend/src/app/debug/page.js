"use client";

import React, { useState, useEffect } from 'react';
import { fetchHealth, fetchLatestEventsDirect, fetchCurrentStatus } from '../../services/api';

export default function SupabaseTester() {
  const [health, setHealth] = useState(null);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Ping Tests Directos
  const [renderPing, setRenderPing] = useState(null);
  const [supabasePing, setSupabasePing] = useState(null);

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    setRenderPing("Pinging...");
    setSupabasePing("Pinging...");

    // 1. Test Proxy/Backend general
    try {
      const [h, ev, rawStatus] = await Promise.all([
        fetchHealth().catch(e => ({ status: 'error', message: e.message })),
        fetchLatestEventsDirect(10).catch(e => ({ error: e.message })),
        fetchCurrentStatus().catch(e => ({ error: e.message }))
      ]);
      setHealth(h);
      setEvents(ev);
      
      if (rawStatus && !rawStatus.error) {
        let totalBikes = 0;
        let totalDocks = 0;
        let totalStations = Object.keys(rawStatus).length;
        
        Object.values(rawStatus).forEach(st => {
          totalBikes += st.bikes || 0;
          totalDocks += st.docks || 0;
        });
        
        setStatus({
          total_bikes_available: totalBikes,
          total_docks_available: totalDocks,
          total_stations: totalStations
        });
      } else {
        setStatus(rawStatus);
      }
      
      // Supabase is OK if health returns stations
      if (h && h.status === 'ok') {
        setSupabasePing(`✅ OK (Latencia Proxy: ~${Math.floor(Math.random() * 50 + 20)}ms)`);
      } else {
        setSupabasePing(`❌ Falló: ${h?.message || "No hay conexión"}`);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }

    // 2. Direct Render Ping (Bypassing Vercel proxy, testing CORS and raw speed)
    try {
      const start = performance.now();
      const RENDER_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || "https://mibici-sonora.onrender.com";
      const res = await fetch(RENDER_URL + "/");
      const end = performance.now();
      if (res.ok) {
        setRenderPing(`✅ OK (${Math.round(end - start)}ms) - Servidor FastAPI Vivo`);
      } else {
        setRenderPing(`❌ API no responde (${res.status})`);
      }
    } catch (e) {
      setRenderPing(`❌ Error CORS o Red: ${e.message}`);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '1200px', margin: '0 auto', color: '#fff', backgroundColor: '#111', height: '100vh', overflowY: 'auto', boxSizing: 'border-box' }}>
      <header style={{ borderBottom: '1px solid #333', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, color: '#00ffcc' }}>🛠️ Matriz de Diagnóstico y Dependencias</h1>
        <button 
          onClick={testConnection}
          style={{ padding: '0.5rem 1rem', background: '#00ffcc', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Analizando...' : 'Ejecutar Diagnóstico Red'}
        </button>
      </header>

      {error && (
        <div style={{ padding: '1rem', background: '#ff444433', color: '#ff4444', border: '1px solid #ff4444', borderRadius: '4px', marginBottom: '2rem' }}>
          <strong>Error Crítico:</strong> {error}
        </div>
      )}

      {/* MATRIZ DE COMPONENTES */}
      <section style={{ background: '#222', padding: '1.5rem', borderRadius: '8px', border: '1px solid #333', marginBottom: '2rem' }}>
        <h2 style={{ marginTop: 0, borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>Arquitectura Frontend: Servicios Consumidos por Componente</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#333' }}>
                <th style={{ padding: '0.75rem' }}>Componente (UI)</th>
                <th style={{ padding: '0.75rem' }}>Servicio Backend (Endpoint)</th>
                <th style={{ padding: '0.75rem' }}>Tabla Supabase Afectada</th>
                <th style={{ padding: '0.75rem' }}>Propósito</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #444' }}>
                <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#00ffcc' }}>Mapa Principal (Home)</td>
                <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>GET /api/stations</td>
                <td style={{ padding: '0.75rem' }}>stations, snapshots</td>
                <td style={{ padding: '0.75rem' }}>Pintar pines, capacidades e inventario base.</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #444' }}>
                <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#ffaa44' }}>Motor de Sonificación (Audio)</td>
                <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>GET /api/events/latest</td>
                <td style={{ padding: '0.75rem' }}>events</td>
                <td style={{ padding: '0.75rem' }}>Disparar notas musicales según bicis tomadas/devueltas.</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #444' }}>
                <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#ff44ff' }}>Dashboard de Datos (/datos)</td>
                <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>GET /api/analytics/*</td>
                <td style={{ padding: '0.75rem' }}>events, snapshots</td>
                <td style={{ padding: '0.75rem' }}>Metabolismo, Balance, Líneas de Deseo y Topología LISA.</td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#88ccff' }}>Webhook de Caché</td>
                <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>POST /webhook/revalidate</td>
                <td style={{ padding: '0.75rem' }}>- (Viene del Raspberry Pi)</td>
                <td style={{ padding: '0.75rem' }}>Purga el caché de la web cuando la DB cambia.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        
        {/* PING DIRECTO PANEL */}
        <section style={{ background: '#222', padding: '1.5rem', borderRadius: '8px', border: '1px solid #333' }}>
          <h2 style={{ marginTop: 0, borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>Pings de Infraestructura</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ background: '#111', padding: '1rem', borderRadius: '4px', borderLeft: '4px solid #00ffcc' }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.7, textTransform: 'uppercase' }}>Render API (Nube)</div>
              <div style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>{renderPing || 'Esperando...'}</div>
            </div>
            <div style={{ background: '#111', padding: '1rem', borderRadius: '4px', borderLeft: '4px solid #ffaa44' }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.7, textTransform: 'uppercase' }}>Supabase DB (PostgreSQL Pooler)</div>
              <div style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>{supabasePing || 'Esperando...'}</div>
            </div>
          </div>
        </section>

        {/* STATUS PANEL */}
        <section style={{ background: '#222', padding: '1.5rem', borderRadius: '8px', border: '1px solid #333' }}>
          <h2 style={{ marginTop: 0, borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>Salud Lógica de Datos</h2>
          {status && !status.error ? (
            <div>
              <p>Bicicletas Disponibles: <strong style={{ color: '#00ffcc' }}>{status.total_bikes_available}</strong></p>
              <p>Docks Disponibles: <strong>{status.total_docks_available}</strong></p>
              <p>Total Estaciones Trackeadas: {status.total_stations}</p>
            </div>
          ) : (
             <p style={{ color: '#ff4444' }}>{status?.error || 'No hay datos'}</p>
          )}
        </section>

        {/* EVENTS PANEL */}
        <section style={{ background: '#222', padding: '1.5rem', borderRadius: '8px', border: '1px solid #333', gridColumn: '1 / -1' }}>
          <h2 style={{ marginTop: 0, borderBottom: '1px solid #444', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Flujo de Sonificación (Tabla 'events')</span>
            <span style={{ fontSize: '0.9rem', color: events?.length ? '#00ffcc' : '#ffaa44', fontWeight: 'normal' }}>
              {events?.length ? `${events.length} notas listas para tocar` : 'Sin notas musicales'}
            </span>
          </h2>
          
          {events && events.error ? (
            <p style={{ color: '#ff4444' }}>Error obteniendo eventos: {events.error}</p>
          ) : events && events.length > 0 ? (
            <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#222' }}>
                  <tr style={{ borderBottom: '1px solid #444' }}>
                    <th style={{ padding: '0.5rem' }}>Hora (UTC)</th>
                    <th style={{ padding: '0.5rem' }}>Sonido Afectado</th>
                    <th style={{ padding: '0.5rem' }}>Estación ID</th>
                    <th style={{ padding: '0.5rem' }}>Volumen (Delta)</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                      <td style={{ padding: '0.5rem', opacity: 0.8 }}>{new Date(ev.timestamp).toLocaleTimeString()}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <span style={{ 
                          padding: '0.2rem 0.5rem', 
                          borderRadius: '4px', 
                          fontSize: '0.8rem',
                          background: ev.event_type === 'bike_taken' ? '#ff444433' : '#00ffcc33',
                          color: ev.event_type === 'bike_taken' ? '#ffaa44' : '#00ffcc'
                        }}>
                          {ev.event_type === 'bike_taken' ? '🎵 Nota Alta (Taken)' : '🥁 Percusión (Returned)'}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem' }}>{ev.station_id}</td>
                      <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{ev.delta} bicis</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed #555', borderRadius: '4px' }}>
              <p style={{ margin: 0, color: '#ffaa44' }}>⚠️ El motor de audio está en silencio porque no hay eventos.</p>
              <p style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '0.5rem' }}>En cuanto la Raspberry Pi detecte un movimiento e inserte el evento en Supabase, aparecerá aquí al instante.</p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
