'use client';
import { useState, useEffect } from 'react';
import { fetchHeroJourney } from '../services/api';

export default function StationDetailModal({ stationId, onClose, moodData }) {
  const [hero, setHero] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHeroJourney(stationId)
      .then(setHero)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [stationId]);

  const color = moodData?.color || '#00d2ff';
  const emoji = moodData?.emoji || '📍';
  const label = moodData?.label || 'Historial';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div style={{
        background: '#111827', border: `1px solid ${color}88`,
        borderRadius: '20px', padding: '2.5rem', maxWidth: '600px', width: '90%',
        boxShadow: `0 20px 50px ${color}33`, position: 'relative'
      }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent',
          border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer'
        }}>×</button>
        
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '3rem', animation: 'pulse 1.5s infinite', marginBottom: '1rem' }}>⏱️</div>
            Cargando historia de la estación...
          </div>
        ) : hero && !hero.error ? (
          <>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '3.5rem' }}>{emoji}</div>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: 0 }}>{hero.name || hero.station_id}</h2>
                <div style={{ color: color, fontWeight: 700, fontSize: '0.9rem' }}>{label}</div>
              </div>
            </div>

            <div style={{
              background:'linear-gradient(135deg,rgba(255,255,255,0.02),rgba(255,255,255,0.05))',
              border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'1.5rem',
              marginBottom:'1.5rem', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', color: '#f87171', fontWeight: 800 }}>{hero.total_taken}</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Salidas</div>
              </div>
              <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '1.5rem', color: '#34d399', fontWeight: 800 }}>{hero.total_returned}</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Llegadas</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', color: '#a78bfa', fontWeight: 800 }}>{hero.rest_periods_detected}</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Descansos</div>
              </div>
            </div>

            {hero.timeline && hero.timeline.length > 0 && (
              <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.08)', padding:'1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom:'0.75rem' }}>
                  <h3 style={{ color:'#94a3b8', fontSize:'0.85rem', margin: 0 }}>📈 Línea de Tiempo</h3>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem' }}>
                     <span style={{ color: '#00d2ff' }}>— Bicis</span>
                     <span style={{ color: '#34d399' }}>-- Docks</span>
                  </div>
                </div>
                <MiniChart data={hero.timeline} />
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#f87171' }}>
            No se pudo cargar el historial.
          </div>
        )}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

function MiniChart({ data }) {
  const maxBikes = Math.max(...data.map(d => d.bikes), 1);
  const W = 100, H = 60;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:80 }} preserveAspectRatio="none">
      <polyline
        points={data.map((d,i) => `${(i/(data.length-1))*W},${H - (d.bikes/maxBikes)*H}`).join(' ')}
        fill="none" stroke="#00d2ff" strokeWidth="0.8" vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={data.map((d,i) => `${(i/(data.length-1))*W},${H - (d.docks/maxBikes)*H}`).join(' ')}
        fill="none" stroke="#34d399" strokeWidth="0.8" strokeDasharray="2,2" vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
