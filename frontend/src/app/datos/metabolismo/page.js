'use client';
import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import MethodologyPanel from '../../../components/MethodologyPanel';
import { fetchUrbanMetabolism, fetchStationSummary } from '../../../services/api';
import Link from 'next/link';
import StationDetailModal from '../../../components/StationDetailModal';

const StaticMap = dynamic(() => import('../../../components/StaticMap'), { ssr: false });

const WINDOWS = [
  { id: 'morning',   label: '🌅 Mañana',   range: '07:00–10:00' },
  { id: 'afternoon', label: '🌆 Tarde',    range: '17:00–20:00' },
  { id: 'night',     label: '🌙 Noche',    range: '20:00–24:00' },
];

const ROLE_META = {
  source:  { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   label: 'FUENTE',   emoji: '🔴', desc: 'Se vacía' },
  sink:    { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  label: 'SUMIDERO', emoji: '🔵', desc: 'Se llena' },
  neutral: { color: '#6b7280', bg: 'rgba(107,114,128,0.10)', label: 'NEUTRAL',  emoji: '⚪', desc: 'Estable'  },
};

export default function MetabolismoPage() {
  const [window, setWindow] = useState('morning');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedStationId, setSelectedStationId] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchUrbanMetabolism(window)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [window]);

  // Map nodes for StaticMap
  const { nodes } = useMemo(() => {
    if (!data.length) return { nodes: [] };
    const maxFlow = Math.max(...data.map(d => Math.abs(d.net_flow)), 1);
    
    const mappedNodes = data.map(d => {
      const isSource = d.urban_role === 'source';
      const isSink = d.urban_role === 'sink';
      const intensity = Math.min(Math.abs(d.net_flow) / maxFlow, 1);
      return {
        id: d.station_id,
        lat: d.lat,
        lon: d.lon,
        radius: 2 + intensity * 6,
        color: isSource ? '#f87171' : isSink ? '#60a5fa' : '#475569',
        opacity: isSource || isSink ? 0.3 + intensity * 0.7 : 0.5
      };
    });

    return { nodes: mappedNodes };
  }, [data]);

  const sources  = data.filter(d => d.urban_role === 'source').sort((a,b) => a.net_flow - b.net_flow).slice(0,10);
  const sinks    = data.filter(d => d.urban_role === 'sink').sort((a,b) => b.net_flow - a.net_flow).slice(0,10);
  const totals   = { source: data.filter(d => d.urban_role==='source').length, sink: data.filter(d => d.urban_role==='sink').length, neutral: data.filter(d => d.urban_role==='neutral').length };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      {/* Back nav */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
        <Link href="/datos" style={{ color: '#00d2ff', textDecoration: 'none', fontSize: '0.85rem' }}>Volver a Datos →</Link>
      </div>

      <h1 style={{ fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(90deg,#ef4444,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.25rem' }}>
        Metabolismo Urbano
      </h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Estaciones Fuente vs. Sumidero — la respiración de la ciudad por franjas horarias
      </p>

      <MethodologyPanel
        defaultOpen={false}
        question="¿Qué zonas de la ciudad 'expulsan' ciclistas por la mañana y cuáles los 'absorben'? Revela la segregación espacial de usos de suelo: residencial vs. comercial/oficinas."
        algorithm={`Flujo neto = Σ(bike_returned) − Σ(bike_taken) en la ventana horaria.\n> +5 → Sumidero (acumula bicis: zona de destino laboral)\n< −5 → Fuente (pierde bicis: zona residencial de origen)\n[−5, +5] → Neutral`}
        dataSource={`SELECT station_id, lat, lon,
  SUM(CASE WHEN event_type='bike_returned' THEN delta
           WHEN event_type='bike_taken'    THEN -delta
           ELSE 0 END) AS net_flow
FROM events
WHERE EXTRACT(HOUR FROM timestamp) BETWEEN h_start AND h_end
GROUP BY station_id, lat, lon`}
        howToRead="Círculos ROJOS grandes = zonas residenciales que se vacían (fuentes de ciclistas). Círculos AZULES grandes = corredores o centros que se saturan (sumideros). El tamaño del círculo es proporcional a la intensidad del flujo neto."
        reference="Concepto de Metabolismo Urbano: Kennedy, C. et al. (2007). The changing metabolism of cities. Journal of Industrial Ecology, 11(2), 43-59."
      />

      {/* Time window selector */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {WINDOWS.map(w => (
          <button key={w.id} onClick={() => setWindow(w.id)} style={{
            padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: window === w.id ? 'linear-gradient(90deg,#3b82f6,#00d2ff)' : 'rgba(255,255,255,0.06)',
            color: window === w.id ? '#fff' : '#94a3b8',
            fontWeight: window === w.id ? 700 : 400,
            fontSize: '0.85rem', transition: 'all 0.2s',
          }}>
            {w.label} <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>{w.range}</span>
          </button>
        ))}
      </div>

      {/* Summary counters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { key: 'source',  label: 'Fuentes',   color: '#ef4444' },
          { key: 'sink',    label: 'Sumideros',  color: '#3b82f6' },
          { key: 'neutral', label: 'Neutrales',  color: '#6b7280' },
        ].map(({ key, label, color }) => (
          <div key={key} style={{
            padding: '0.75rem 1.25rem', borderRadius: '10px',
            background: `rgba(${key==='source'?'239,68,68':key==='sink'?'59,130,246':'107,114,128'},0.1)`,
            border: `1px solid ${color}40`,
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{loading ? '…' : totals[key]}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Static Map */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.5rem', padding: '0.5rem', position: 'relative' }}>
        <div style={{ fontSize: '0.75rem', color: '#64748b', padding: '0.5rem 0.5rem 0', marginBottom: '0.25rem' }}>
          🗺️ Mapa de dispersión espacial · {data.length} estaciones
        </div>
        {loading ? (
          <div style={{ height:'400px', display:'flex', alignItems:'center', justifyContent:'center', color:'#475569' }}>Cargando datos espaciales…</div>
        ) : (
          <StaticMap nodes={nodes} height={400} interactive={true} onNodeClick={setSelectedStationId} />
        )}
        {/* Legend */}
        <div style={{ display: 'flex', gap: '1.25rem', padding: '0.5rem 0.75rem', flexWrap: 'wrap' }}>
          {Object.values(ROLE_META).map(m => (
            <span key={m.label} style={{ fontSize: '0.75rem', color: m.color, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
              {m.label} — {m.desc}
            </span>
          ))}
        </div>
      </div>

      {/* Top tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', flexWrap: 'wrap' }}>
        <RoleTable title="🔴 Top Fuentes (se vacían)" rows={sources} color="#ef4444" flowSign="-" />
        <RoleTable title="🔵 Top Sumideros (se llenan)" rows={sinks} color="#3b82f6" flowSign="+" />
      </div>

      {/* Station Detail Modal */}
      {selectedStationId && (
        <StationDetailModal 
          stationId={selectedStationId} 
          onClose={() => setSelectedStationId(null)} 
          moodData={(function() {
            const d = data.find(x => x.station_id === selectedStationId);
            if (!d) return null;
            return {
              color: d.urban_role === 'source' ? '#f87171' : d.urban_role === 'sink' ? '#60a5fa' : '#94a3b8',
              emoji: ROLE_META[d.urban_role]?.emoji || '📍',
              label: ROLE_META[d.urban_role]?.label || 'Estación'
            };
          })()}
        />
      )}

    </div>
  );
}

function RoleTable({ title, rows, color, flowSign }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}30`, borderRadius: '10px', padding: '1rem', overflowX: 'auto' }}>
      <h3 style={{ color, marginBottom: '0.75rem', fontSize: '0.9rem' }}>{title}</h3>
      {rows.length === 0 ? (
        <p style={{ color: '#475569', fontSize: '0.8rem' }}>Sin datos en esta ventana horaria.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ textAlign: 'left', padding: '0.4rem', color: '#64748b' }}>Estación</th>
              <th style={{ textAlign: 'right', padding: '0.4rem', color: '#64748b' }}>Flujo Neto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.station_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.4rem', color: '#e2e8f0' }}>{r.name || r.station_id}</td>
                <td style={{ padding: '0.4rem', textAlign: 'right', color, fontWeight: 700 }}>
                  {flowSign}{Math.abs(r.net_flow)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
