'use client';
import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import MethodologyPanel from '../../../components/MethodologyPanel';
import { fetchDesireLines, fetchMultimodalStress, fetchStationSummary } from '../../../services/api';
import Link from 'next/link';
import StationDetailModal from '../../../components/StationDetailModal';

const StaticMap = dynamic(() => import('../../../components/StaticMap'), { ssr: false });

export default function CorredoresPage() {
  const [lines, setLines]       = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('desire');
  const [stress, setStress]     = useState([]);
  const [selectedStationId, setSelectedStationId] = useState(null);
  useEffect(() => {
    Promise.all([fetchDesireLines(), fetchMultimodalStress(), fetchStationSummary()])
      .then(([l, s, summ]) => { setLines(l); setStress(s); setSummaries(summ); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Map nodes and edges for StaticMap
  const { nodes, edges } = useMemo(() => {
    if (!summaries.length || !lines.length) return { nodes: [], edges: [] };
    const stressMap = Object.fromEntries(stress.map(s => [s.station_id, s.volatility_index]));
    const maxVol = Math.max(...stress.map(s => s.volatility_index), 1);
    const stationMap = Object.fromEntries(summaries.map(s => [s.station_id, s]));

    const mappedNodes = summaries.map(s => {
      const vol = stressMap[s.station_id] || 0;
      const intensity = vol / maxVol;
      return {
        id: s.station_id,
        lat: s.lat,
        lon: s.lon,
        radius: 2 + intensity * 4,
        color: intensity > 0.6 ? '#f87171' : intensity > 0.3 ? '#fbbf24' : '#34d399',
        opacity: 0.8
      };
    });

    const maxPair = Math.max(...lines.map(d => d.trip_volume), 1);
    const mappedEdges = lines.map(d => {
      const sA = stationMap[d.start_station_id];
      const sB = stationMap[d.end_station_id];
      if (!sA || !sB) return null;
      const intensity = d.trip_volume / maxPair;
      return {
        from: sA,
        to: sB,
        weight: 1 + intensity * 4,
        color: '#00c88c',
        opacity: 0.1 + intensity * 0.7
      };
    }).filter(Boolean);

    return { nodes: mappedNodes, edges: mappedEdges };
  }, [summaries, lines, stress]);

  const stationMap = Object.fromEntries(summaries.map(s => [s.station_id, s]));
  const topStress = stress.slice(0, 20).map(s => ({ ...s, info: stationMap[s.station_id] }));

  return (
    <div style={{ background:'#0a0a0f', color:'#e2e8f0', fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
        <Link href="/datos" style={{ color:'#00d2ff', textDecoration:'none', fontSize:'0.85rem' }}>Volver a Datos →</Link>
      </div>

      <h1 style={{ fontSize:'2rem', fontWeight:800, background:'linear-gradient(90deg,#ff8c00,#00c88c)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', margin:'1rem 0 0.25rem' }}>
        Corredores de Alta Fricción
      </h1>
      <p style={{ color:'#64748b', marginBottom:'1.5rem', fontSize:'0.9rem' }}>
        Líneas de Deseo inferidas + Índice de Presión Multimodal
      </p>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.5rem' }}>
        {[['desire','↗️ Líneas de Deseo'],['stress','🔥 Presión Multimodal']].map(([id,label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding:'0.5rem 1.1rem', borderRadius:'8px', border:'none', cursor:'pointer',
            background: activeTab===id ? 'linear-gradient(90deg,#ff8c00,#f59e0b)' : 'rgba(255,255,255,0.06)',
            color: activeTab===id ? '#fff' : '#94a3b8', fontWeight: activeTab===id ? 700 : 400, fontSize:'0.85rem',
          }}>{label}</button>
        ))}
      </div>

      {activeTab === 'desire' && (
        <>
          <MethodologyPanel
            question="¿Qué corredores ciclistas tiene mayor demanda potencial? ¿Dónde la infraestructura actual podría no ser suficiente para el volumen de trayectos inferido?"
            algorithm={`Sin datos OD reales (no hay bike_id), inferimos los corredores emparejando estadísticamente las estaciones con más salidas (top orígenes) con las de más llegadas (top destinos).

El volumen de cada corredor = min(taken_origen, returned_destino), representando el flujo máximo posible entre ese par.`}
            dataSource={`-- Orígenes: estaciones con más bike_taken
SELECT station_id, SUM(delta) as taken FROM events
WHERE event_type='bike_taken' GROUP BY station_id ORDER BY taken DESC LIMIT 30

-- Destinos: estaciones con más bike_returned  
SELECT station_id, SUM(delta) as returned FROM events
WHERE event_type='bike_returned' GROUP BY station_id ORDER BY returned DESC LIMIT 30`}
            howToRead="Cada arco conecta un origen (naranja) con un destino (verde). El grosor del arco es proporcional al volumen inferido del corredor. Arcos gruesos = alta demanda potencial no atendida."
            limitation="Esta es una inferencia estadística, no trayectos reales. MiBici no expone IDs de bicicleta ni de usuario en su API GBFS. Para obtener OD reales se requeriría acceso al sistema de pagos de MiBici."
          />
          <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.08)', marginBottom:'1.5rem' }}>
            <div style={{ padding:'0.75rem 1rem', fontSize:'0.75rem', color:'#64748b' }}>
              🗺️ Arcos Origen→Destino · {lines.length} corredores inferidos
            </div>
            {loading ? (
              <div style={{ height:'420px', display:'flex', alignItems:'center', justifyContent:'center', color:'#475569' }}>Cargando topología…</div>
            ) : (
              <StaticMap nodes={nodes} edges={edges} height={420} interactive={true} onNodeClick={setSelectedStationId} />
            )}
            <div style={{ display:'flex', gap:'1.5rem', padding:'0.5rem 1rem', fontSize:'0.75rem' }}>
              <span style={{ color:'#ff8c00' }}>● Origen (bike_taken)</span>
              <span style={{ color:'#00c88c' }}>● Destino (bike_returned)</span>
              <span style={{ color:'#64748b' }}>Grosor del arco = volumen de viajes inferido</span>
            </div>
          </div>
          <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.08)', padding:'1rem', overflowX:'auto' }}>
            <h3 style={{ color:'#ff8c00', marginBottom:'0.75rem', fontSize:'0.9rem' }}>Top Corredores Inferidos</h3>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8rem' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ textAlign:'left', padding:'0.4rem', color:'#64748b' }}>Origen</th>
                  <th style={{ textAlign:'left', padding:'0.4rem', color:'#64748b' }}>Destino</th>
                  <th style={{ textAlign:'right', padding:'0.4rem', color:'#64748b' }}>Volumen inferido</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding:'0.4rem', color:'#fcd34d' }}>{l.start_name}</td>
                    <td style={{ padding:'0.4rem', color:'#6ee7b7' }}>{l.end_name}</td>
                    <td style={{ padding:'0.4rem', textAlign:'right', color:'#e2e8f0', fontWeight:700 }}>{l.trip_volume}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'stress' && (
        <>
          <MethodologyPanel
            question="¿Qué estaciones sufren mayor estrés de última milla? Identifica los puntos de transferencia donde MiBici actúa como conector capilar hacia el transporte masivo, y donde la oferta es más inestable."
            algorithm={`Índice de Volatilidad = STDDEV(bikes_disponibles) agrupado por hora.
Alta volatilidad = la estación se llena y vacía constantemente = alta presión intermodal.
Las estaciones con mayor índice son candidatas a revisión de capacidad o reposición más frecuente.`}
            dataSource={`WITH hourly AS (
  SELECT station_id,
         date_trunc('hour', timestamp) as hour,
         AVG(bikes) as avg_bikes
  FROM snapshots WHERE timestamp > NOW() - INTERVAL '7 days'
  GROUP BY station_id, date_trunc('hour', timestamp)
)
SELECT station_id, STDDEV(avg_bikes) as volatility_index
FROM hourly GROUP BY station_id HAVING COUNT(*) >= 5
ORDER BY volatility_index DESC`}
            howToRead="Mayor barra = mayor volatilidad = mayor estrés. Estaciones con índice alto y cerca de nodos de transporte masivo (Tren Ligero, Mi Macro Calzada) son puntos críticos de intermodalidad."
            reference="Martens, K. (2016). Transport Justice: Designing Fair Transportation Systems. Routledge, Nueva York."
          />
          <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.08)', marginBottom:'1.5rem', padding:'0.5rem', position:'relative' }}>
            <div style={{ fontSize:'0.75rem', color:'#64748b', padding:'0.5rem 0.5rem 0', marginBottom:'0.25rem' }}>
              🗺️ Mapa de Estrés Multimodal (Volatilidad)
            </div>
            {loading ? (
              <div style={{ height:'300px', display:'flex', alignItems:'center', justifyContent:'center', color:'#475569' }}>Calculando volatilidad…</div>
            ) : (
              <StaticMap nodes={nodes} height={300} interactive={true} onNodeClick={setSelectedStationId} />
            )}
            <div style={{ display:'flex', gap:'1.5rem', padding:'0.5rem 1rem', fontSize:'0.75rem' }}>
              <span style={{ color:'#f87171' }}>● Estrés Alto (Crítico)</span>
              <span style={{ color:'#fbbf24' }}>● Estrés Medio</span>
              <span style={{ color:'#34d399' }}>● Estrés Bajo</span>
            </div>
          </div>

          <div style={{ display:'grid', gap:'0.5rem' }}>
            {loading ? (
              <div style={{ height:'200px', display:'flex', alignItems:'center', justifyContent:'center', color:'#475569' }}>Calculando volatilidad…</div>
            ) : topStress.map((s,i) => {
              const maxV = topStress[0]?.volatility_index || 1;
              const pct = (s.volatility_index / maxV) * 100;
              return (
                <div key={s.station_id} style={{ background:'rgba(255,255,255,0.03)', borderRadius:'8px', padding:'0.75rem 1rem', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.35rem' }}>
                    <span style={{ fontSize:'0.82rem', color:'#e2e8f0' }}>
                      <span style={{ color:'#64748b', marginRight:'0.5rem' }}>#{i+1}</span>
                      {s.info?.name || s.station_id}
                    </span>
                    <span style={{ fontSize:'0.75rem', color:'#f87171', fontWeight:700 }}>σ = {s.volatility_index.toFixed(2)}</span>
                  </div>
                  <div style={{ height:'6px', background:'rgba(255,255,255,0.05)', borderRadius:'3px' }}>
                    <div style={{ width:`${pct}%`, height:'100%', borderRadius:'3px', background:`linear-gradient(90deg,#7c3aed,#f87171)`, transition:'width 0.5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Station Detail Modal */}
      {selectedStationId && (
        <StationDetailModal 
          stationId={selectedStationId} 
          onClose={() => setSelectedStationId(null)} 
          moodData={(function() {
            const stressMap = Object.fromEntries(stress.map(s => [s.station_id, s.volatility_index]));
            const maxVol = Math.max(...stress.map(s => s.volatility_index), 1);
            const vol = stressMap[selectedStationId] || 0;
            const intensity = vol / maxVol;
            const color = intensity > 0.6 ? '#f87171' : intensity > 0.3 ? '#fbbf24' : '#34d399';
            return { color, emoji: '📍', label: 'Estación' };
          })()}
        />
      )}

    </div>
  );
}
