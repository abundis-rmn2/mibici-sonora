'use client';
import { useState, useEffect } from 'react';
import MethodologyPanel from '../../../components/MethodologyPanel';
import { fetchStationSummary, fetchCurrentStatus } from '../../../services/api';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const StaticMap = dynamic(() => import('../../../components/StaticMap'), { ssr: false });

const MOODS = [
  { max: 0.05, emoji: '😩', label: 'Muerta de hambre', color: '#dc2626', desc: 'Sin bicis. Nadie puede rentar.' },
  { max: 0.20, emoji: '😰', label: 'Hambrienta',       color: '#f87171', desc: 'Pocas bicis disponibles.' },
  { max: 0.45, emoji: '😐', label: 'Normal baja',      color: '#f59e0b', desc: 'Demanda moderada.' },
  { max: 0.65, emoji: '😊', label: 'Equilibrada',      color: '#34d399', desc: 'Buena disponibilidad.' },
  { max: 0.85, emoji: '😄', label: 'Abundante',        color: '#06b6d4', desc: 'Muchas bicis disponibles.' },
  { max: 0.95, emoji: '😤', label: 'Congestionada',    color: '#a78bfa', desc: 'Casi llena. Difícil devolver.' },
  { max: 1.01, emoji: '💥', label: '¡Saturada!',       color: '#ec4899', desc: 'Completamente llena. No se puede devolver.' },
];

function getMood(ratio) {
  return MOODS.find(m => ratio <= m.max) || MOODS[MOODS.length - 1];
}

export default function EstadoDeAnimoPage() {
  const [summaries, setSummaries] = useState([]);
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([fetchStationSummary(), fetchCurrentStatus()])
      .then(([s, st]) => { setSummaries(s); setStatus(st); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stations = summaries.map(s => {
    const snap = status[s.station_id];
    const bikes = snap?.bikes ?? 0;
    const ratio = s.capacity > 0 ? bikes / s.capacity : 0;
    const mood = getMood(ratio);
    return { ...s, bikes, ratio, mood };
  }).filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'critical') return s.ratio <= 0.1 || s.ratio >= 0.9;
    if (filter === 'empty') return s.ratio <= 0.1;
    if (filter === 'full') return s.ratio >= 0.9;
    if (filter !== 'all') return s.mood.label === filter;
    return true;
  });

  const moodCounts = MOODS.map(m => ({
    ...m,
    count: summaries.filter(s => {
      const snap = status[s.station_id];
      const r = s.capacity > 0 ? (snap?.bikes ?? 0) / s.capacity : 0;
      return getMood(r).label === m.label;
    }).length,
  }));

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#e2e8f0', fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
        <Link href="/datos" style={{ color:'#00d2ff', textDecoration:'none', fontSize:'0.85rem' }}>Volver a Datos →</Link>
      </div>

      <h1 style={{ fontSize:'2rem', fontWeight:800, background:'linear-gradient(90deg,#f59e0b,#ec4899,#a78bfa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', margin:'1rem 0 0.25rem' }}>
        Estado de Ánimo de la Red
      </h1>
      <p style={{ color:'#64748b', marginBottom:'1.5rem', fontSize:'0.9rem' }}>
        Tamagotchi Urbano — ¿Cómo se siente MiBici en este momento?
      </p>

      <MethodologyPanel
        defaultOpen={false}
        question="¿Cuál es el estado emocional de la red de MiBici ahora mismo? Transforma métricas técnicas de ocupación en un lenguaje intuitivo y visual que cualquier ciudadano puede entender."
        algorithm={`Ratio de Ocupación = Bicis Disponibles / Capacidad Total [0 → 1]

Mapa de emojis (umbrales de ratio):
  0%–5%   😩 Muerta de hambre  — nadie puede rentar
  5%–20%  😰 Hambrienta        — pocas bicis
  20%–45% 😐 Normal baja       — demanda moderada
  45%–65% 😊 Equilibrada       — buen servicio
  65%–85% 😄 Abundante         — muchas opciones
  85%–95% 😤 Congestionada      — difícil devolver
  95%–100% 💥 ¡Saturada!       — imposible devolver

Estaciones críticas (0% o 100%) parpadean con animación pulse.`}
        dataSource={`-- Ratio calculado en tiempo real:
SELECT s.id, s.name, s.capacity,
       snap.bikes, snap.bikes::float / s.capacity AS ratio
FROM stations s
JOIN LATERAL (
  SELECT bikes FROM snapshots WHERE station_id = s.id
  ORDER BY timestamp DESC LIMIT 1
) snap ON true`}
        howToRead="Busca el emoji más frecuente: si la mayoría son 😊 o 😄, la red está saludable. Si ves muchos 😩 o 💥 agrupados en zonas, hay un problema sistémico. Los que parpadean están en estado crítico."
      />

      {/* Mood distribution bar */}
      <div style={{ marginBottom:'1.5rem' }}>
        <div style={{ fontSize:'0.75rem', color:'#64748b', marginBottom:'0.5rem' }}>Distribución de estados de ánimo</div>
        <div style={{ display:'flex', height:'32px', borderRadius:'8px', overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)' }}>
          {moodCounts.map(m => m.count > 0 && (
            <div key={m.label} title={`${m.emoji} ${m.label}: ${m.count}`} style={{
              flex: m.count, background: m.color + '99', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'0.7rem', color:'#fff', fontWeight:700, transition:'flex 0.5s',
              minWidth: m.count > 0 ? 24 : 0,
            }}>
              {m.count >= 5 ? m.emoji : ''}
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.75rem', flexWrap:'wrap' }}>
          {moodCounts.map(m => m.count > 0 && (
            <button key={m.label} onClick={() => setFilter(m.label)} style={{ 
              fontSize:'0.75rem', color: m.color, display:'flex', alignItems:'center', gap:'0.25rem',
              background: filter===m.label ? `${m.color}22` : 'rgba(255,255,255,0.03)',
              border: filter===m.label ? `1px solid ${m.color}66` : '1px solid rgba(255,255,255,0.08)',
              padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
              fontWeight: filter===m.label ? 700 : 400
            }}>
              {m.emoji} {m.label} ({m.count})
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.25rem', flexWrap:'wrap', alignItems:'center' }}>
        {[['all','Todas'],['critical','⚠️ Críticas'],['empty','😩 Vacías'],['full','💥 Saturadas']].map(([id,label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            padding:'0.4rem 0.9rem', borderRadius:'8px', border:'none', cursor:'pointer',
            background: filter===id ? 'rgba(0,210,255,0.15)' : 'rgba(255,255,255,0.04)',
            color: filter===id ? '#00d2ff' : '#64748b', fontSize:'0.8rem', fontWeight: filter===id ? 700 : 400,
            border: filter===id ? '1px solid #00d2ff40' : '1px solid transparent',
          }}>{label}</button>
        ))}
        <input
          placeholder="Buscar estación…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'0.4rem 0.75rem', color:'#e2e8f0', fontSize:'0.8rem', flex:1, minWidth:180, outline:'none' }}
        />
        <span style={{ fontSize:'0.75rem', color:'#475569' }}>{stations.length} estaciones</span>
      </div>

      {/* Map & Grid */}
      {loading ? (
        <div style={{ height:'300px', display:'flex', alignItems:'center', justifyContent:'center', color:'#475569', fontSize:'2rem' }}>🐣</div>
      ) : (
        <>
          <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.08)', marginBottom:'1.5rem', padding:'0.5rem', position:'relative' }}>
            <div style={{ fontSize:'0.75rem', color:'#64748b', padding:'0.5rem 0.5rem 0', marginBottom:'0.25rem' }}>
              🗺️ Mapa de Estado de Ánimo
            </div>
            <StaticMap 
              interactive={true}
              nodes={stations.map(s => {
                const isCritical = s.ratio <= 0.05 || s.ratio >= 0.95;
                return {
                  lat: s.lat,
                  lon: s.lon,
                  emoji: s.mood.emoji,
                  emojiSize: 22,
                  pulse: isCritical,
                  tooltip: `${s.name} - ${s.bikes} bicis (${(s.ratio*100).toFixed(0)}%)`
                };
              })} 
              height={400} 
            />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:'0.75rem' }}>
          {stations.map(s => {
            const isCritical = s.ratio <= 0.05 || s.ratio >= 0.95;
            return (
              <div
                key={s.station_id}
                style={{
                  background: `linear-gradient(135deg, ${s.mood.color}12, rgba(0,0,0,0.3))`,
                  border: `1px solid ${s.mood.color}${isCritical ? '99' : '33'}`,
                  borderRadius:'12px', padding:'0.9rem',
                  cursor:'default', transition:'transform 0.15s, box-shadow 0.15s',
                  animation: isCritical ? 'pulse 2s infinite' : 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = `0 4px 20px ${s.mood.color}44`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ fontSize:'2rem', textAlign:'center', marginBottom:'0.35rem' }}>{s.mood.emoji}</div>
                <div style={{ fontSize:'0.7rem', color:'#e2e8f0', fontWeight:600, textAlign:'center', marginBottom:'0.25rem', lineHeight:1.3, wordBreak:'break-word' }}>
                  {s.name || s.station_id}
                </div>
                <div style={{ fontSize:'0.65rem', color: s.mood.color, textAlign:'center', fontWeight:700 }}>
                  {s.mood.label}
                </div>
                {/* Ratio bar */}
                <div style={{ height:'4px', background:'rgba(255,255,255,0.08)', borderRadius:'2px', marginTop:'0.5rem' }}>
                  <div style={{
                    width:`${Math.min(s.ratio * 100, 100)}%`, height:'100%',
                    background: s.mood.color, borderRadius:'2px', transition:'width 0.5s',
                  }} />
                </div>
                <div style={{ fontSize:'0.6rem', color:'#64748b', textAlign:'center', marginTop:'0.25rem' }}>
                  {s.bikes} bicis · {(s.ratio*100).toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(248,113,113,0); }
        }
      `}</style>
    </div>
  );
}
