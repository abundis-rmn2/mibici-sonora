'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { fetchStationSummary, fetchCurrentStatus } from '../../services/api';
import Link from 'next/link';
import StationDetailModal from '../../components/StationDetailModal';

const StaticMap = dynamic(() => import('../../components/StaticMap'), { ssr: false });

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

export default function MiBiciSeSientePage() {
  const [summaries, setSummaries] = useState([]);
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'grid'
  const [showModal, setShowModal] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [filter, setFilter] = useState('all');

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

  const nodes = stations.map(s => {
    const isCritical = s.ratio <= 0.05 || s.ratio >= 0.95;
    return {
      id: s.station_id,
      lat: s.lat,
      lon: s.lon,
      emoji: s.mood.emoji,
      emojiSize: 26, // Ligeramente más grande para fullscreen
      pulse: isCritical,
      tooltip: `${s.name} - ${s.bikes} bicis (${(s.ratio*100).toFixed(0)}%)`
    };
  });

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0f', color: '#e2e8f0', fontFamily: "'Inter','Segoe UI',sans-serif", position: 'relative', overflow: viewMode === 'grid' ? 'auto' : 'hidden' }}>
      
      {/* Botones flotantes (Header) */}
      <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', zIndex: 1000, display: 'flex', gap: '1rem' }}>
        <Link href="/" style={{
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', color: '#fff', 
          textDecoration: 'none', padding: '0.6rem 1rem', borderRadius: '8px', 
          fontSize: '0.85rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)'
        }}>← Inicio</Link>
      </div>

      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 1000, display: 'flex', gap: '1rem' }}>
        <button onClick={() => setShowModal(true)} style={{
          background: 'linear-gradient(135deg, rgba(0,210,255,0.2) 0%, rgba(58,123,213,0.3) 100%)',
          border: '1px solid rgba(0,210,255,0.4)', borderRadius: '8px',
          color: '#fff', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
          padding: '0.6rem 1.2rem', backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 15px rgba(0,210,255,0.2)'
        }}>
          ℹ️ Metodología
        </button>
      </div>

      {/* Distribution bar and filters (Top Center) */}
      <div style={{ position: 'absolute', top: '1.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: '100%', maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', height: '14px', width: '100%', borderRadius: '7px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
          {moodCounts.map(m => m.count > 0 && (
            <div key={m.label} title={`${m.emoji} ${m.label}: ${m.count}`} style={{
              flex: m.count, background: m.color, transition: 'flex 0.5s'
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => setFilter('all')} style={{
              fontSize:'0.75rem', color: '#e2e8f0', display:'flex', alignItems:'center', gap:'0.25rem',
              background: filter === 'all' ? `rgba(255,255,255,0.15)` : 'rgba(0,0,0,0.6)',
              border: filter === 'all' ? `1px solid rgba(255,255,255,0.3)` : '1px solid rgba(255,255,255,0.1)',
              padding: '0.3rem 0.7rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
              fontWeight: filter === 'all' ? 700 : 400, backdropFilter: 'blur(10px)'
          }}>
             🌎 Todas
          </button>
          {moodCounts.map(m => m.count > 0 && (
            <button key={m.label} onClick={() => setFilter(m.label)} style={{ 
              fontSize:'0.75rem', color: m.color, display:'flex', alignItems:'center', gap:'0.25rem',
              background: filter === m.label ? `${m.color}33` : 'rgba(0,0,0,0.6)',
              border: filter === m.label ? `1px solid ${m.color}` : '1px solid rgba(255,255,255,0.1)',
              padding: '0.3rem 0.7rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
              fontWeight: filter === m.label ? 700 : 400, backdropFilter: 'blur(10px)'
            }}>
              {m.emoji} {m.label} ({m.count})
            </button>
          ))}
        </div>
      </div>

      {/* Control flotante: Toggle */}
      <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', borderRadius: '30px', padding: '0.4rem', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        <button onClick={() => setViewMode('map')} style={{
          padding: '0.6rem 1.5rem', borderRadius: '25px', border: 'none', cursor: 'pointer',
          background: viewMode === 'map' ? 'linear-gradient(90deg,#00d2ff,#3a7bd5)' : 'transparent',
          color: viewMode === 'map' ? '#fff' : '#94a3b8', fontSize: '0.85rem', fontWeight: 700, transition: 'all 0.3s'
        }}>
          🗺️ Mapa interactivo
        </button>
        <button onClick={() => setViewMode('grid')} style={{
          padding: '0.6rem 1.5rem', borderRadius: '25px', border: 'none', cursor: 'pointer',
          background: viewMode === 'grid' ? 'linear-gradient(90deg,#f59e0b,#ec4899)' : 'transparent',
          color: viewMode === 'grid' ? '#fff' : '#94a3b8', fontSize: '0.85rem', fontWeight: 700, transition: 'all 0.3s'
        }}>
          🎛️ Tablero
        </button>
      </div>

      {/* Contenido Principal */}
      {loading ? (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ fontSize: '4rem', animation: 'pulse 1.5s infinite' }}>🐣</div>
          <div style={{ color: '#94a3b8' }}>Calculando estados de ánimo...</div>
        </div>
      ) : viewMode === 'map' ? (
        <StaticMap nodes={nodes} interactive={true} height="100vh" onNodeClick={setSelectedStationId} />
      ) : (
        <div style={{ padding: '6rem 2rem 6rem 2rem', maxWidth: '1400px', margin: '0 auto', minHeight: '100vh' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.25rem' }}>
            {stations.map(s => {
              const isCritical = s.ratio <= 0.05 || s.ratio >= 0.95;
              return (
                <div
                  key={s.station_id}
                  onClick={() => setSelectedStationId(s.station_id)}
                  style={{
                    background: `linear-gradient(135deg, ${s.mood.color}15, rgba(0,0,0,0.5))`,
                    border: `1px solid ${s.mood.color}${isCritical ? '99' : '33'}`,
                    borderRadius: '16px', padding: '1.25rem',
                    animation: isCritical ? 'pulse 2s infinite' : 'none',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = `0 10px 20px ${s.mood.color}33`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: '0.5rem' }}>{s.mood.emoji}</div>
                  <div style={{ fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 600, textAlign: 'center', marginBottom: '0.25rem', lineHeight: 1.3 }}>
                    {s.name || s.station_id}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: s.mood.color, textAlign: 'center', fontWeight: 700, marginBottom: '0.75rem' }}>
                    {s.mood.label}
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                    <div style={{
                      width: `${Math.min(s.ratio * 100, 100)}%`, height: '100%',
                      background: s.mood.color, borderRadius: '3px'
                    }} />
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', marginTop: '0.5rem' }}>
                    {s.bikes} bicis · {(s.ratio*100).toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Metodológico */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#111827', border: '1px solid rgba(0,210,255,0.3)',
            borderRadius: '20px', padding: '2.5rem', maxWidth: '600px', width: '90%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)', position: 'relative'
          }}>
            <button onClick={() => setShowModal(false)} style={{
              position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent',
              border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer'
            }}>×</button>
            
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(90deg,#00d2ff,#3a7bd5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '1rem' }}>
              MiBici Se Siente
            </h2>
            <p style={{ color: '#cbd5e1', lineHeight: 1.6, marginBottom: '2rem' }}>
              Transformamos métricas técnicas de ocupación en un lenguaje intuitivo. Cada estación es un pequeño tamagotchi urbano que refleja el balance de la red en tiempo real.
            </p>

            <div style={{ display: 'grid', gap: '0.8rem' }}>
              {MOODS.map(m => (
                <div key={m.label} style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                  <span style={{ fontSize: '2rem' }}>{m.emoji}</span>
                  <div>
                    <div style={{ color: m.color, fontWeight: 700, fontSize: '0.9rem' }}>{m.label}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{m.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
              Las estaciones en estado crítico parpadean para llamar la atención operativa.
            </div>
          </div>
        </div>
      )}

      {/* Station Detail Modal */}
      {selectedStationId && (
        <StationDetailModal 
          stationId={selectedStationId} 
          onClose={() => setSelectedStationId(null)} 
          moodData={stations.find(s => s.station_id === selectedStationId)?.mood}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,0.5); transform: scale(1); }
          50% { box-shadow: 0 0 0 15px rgba(248,113,113,0); transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

