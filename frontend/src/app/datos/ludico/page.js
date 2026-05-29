'use client';
import { useState, useEffect } from 'react';
import MethodologyPanel from '../../../components/MethodologyPanel';
import { fetchBikeDerby, fetchHeroJourney, fetchStationSummary } from '../../../services/api';
import Link from 'next/link';

export default function LudicoPage() {
  const [activeTab, setActiveTab] = useState('derby');
  const [derby, setDerby] = useState([]);
  const [hero, setHero] = useState(null);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState('');

  useEffect(() => {
    fetchBikeDerby().then(setDerby).catch(console.error);
    fetchHeroJourney().then(setHero).catch(console.error);
    fetchStationSummary().then(setSummaries).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleHeroChange = (sid) => {
    setSelectedStation(sid);
    setLoading(true);
    fetchHeroJourney(sid || undefined)
      .then(setHero)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const cyclists = derby.filter(d => d.category === 'cyclist');
  const logistics = derby.filter(d => d.category === 'logistics');

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#e2e8f0', fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <Link href="/" style={{ color:'#00d2ff', textDecoration:'none', fontSize:'0.85rem' }}>← Inicio</Link>

      <h1 style={{ fontSize:'2rem', fontWeight:800, background:'linear-gradient(90deg,#f59e0b,#ec4899)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', margin:'1rem 0 0.25rem' }}>
        Zona Lúdica
      </h1>
      <p style={{ color:'#64748b', marginBottom:'1.5rem', fontSize:'0.9rem' }}>
        Derby de Movilidad · Viaje del Héroe — datos que cuentan historias
      </p>

      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.5rem' }}>
        {[['derby','🏎️ Derby de Movilidad'],['hero','📖 Viaje del Héroe']].map(([id,label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding:'0.5rem 1.1rem', borderRadius:'8px', border:'none', cursor:'pointer',
            background: activeTab===id ? 'linear-gradient(90deg,#f59e0b,#ec4899)' : 'rgba(255,255,255,0.06)',
            color: activeTab===id ? '#fff' : '#94a3b8', fontWeight: activeTab===id ? 700 : 400, fontSize:'0.85rem',
          }}>{label}</button>
        ))}
      </div>

      {activeTab === 'derby' && (
        <>
          <MethodologyPanel
            question="¿Qué corredores tienen la mayor velocidad de rotación de bicicletas? ¿Podemos detectar cuándo es un camión de redistribución y no un ciclista?"
            algorithm={`La velocidad se INFIERE estadísticamente (no hay GPS en las bicicletas).

Fórmula:
  distancia = Haversine(lat1,lon1 → lat2,lon2)  [km]
  duración_media = (volumen_par / vol_origen) × 4 min  [estimado]
  velocidad_inferida = distancia / duración_media  [km/h]

Clasificación:
  < 30 km/h → Ciclista legítimo (rango humano realista)
  > 30 km/h → Redistribución logística (camión MiBici)`}
            dataSource={`-- Haversine en Python (sin PostGIS en este cálculo):
R = 6371  # km
a = sin(Δlat/2)² + cos(lat1)·cos(lat2)·sin(Δlon/2)²
dist = R × 2 × atan2(√a, √(1-a))

-- Volumen de pares inferido:
vol = min(SUM(taken)_origen, SUM(returned)_destino)`}
            howToRead="La tabla muestra pares estación-a-estación ordenados por velocidad inferida. Verde = trayecto plausible de ciclista. Rojo/naranja = anomalía logística (camión de redistribución). La velocidad es un proxy estadístico, no GPS real."
            limitation="Sin identificadores de bicicleta ni timestamps de inicio/fin por viaje, la duración es una estimación basada en la tasa de rotación promedio. Los valores son indicativos, no exactos."
          />

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.5rem' }}>
            <DerbyTable title="🚲 Ciclistas" rows={cyclists} color="#34d399" />
            <DerbyTable title="🚛 Redistribución Logística" rows={logistics} color="#f87171" />
          </div>
        </>
      )}

      {activeTab === 'hero' && (
        <>
          <MethodologyPanel
            question="¿Cómo fue el día de la estación más activa de la red? Seguimos a UNA estación como protagonista para narrar la vida urbana que pasó por ella."
            algorithm={`Adaptación metodológica (sin bike_id):
  El dataset GBFS de MiBici no expone identificadores de bicicleta
  ni de usuario — solo snapshots de disponibilidad por estación.

  La unidad de análisis se adapta: la ESTACIÓN actúa como protagonista.
  Su historia revela cuántos usuarios anónimos la eligieron como punto
  de la ciudad, cuándo "durmió" (períodos sin cambio en bikes > 30 min)
  y cuándo trabajó más (picos de eventos acumulados).

  Selección automática: se elige la estación con mayor Σ(eventos) total.
  También puedes seleccionar cualquier estación manualmente.`}
            dataSource={`-- Selección de la estación protagonista:
SELECT station_id, COUNT(*) as total_events
FROM events GROUP BY station_id ORDER BY total_events DESC LIMIT 1

-- Cronología de la protagonista:
SELECT timestamp, bikes, docks FROM snapshots
WHERE station_id = :target ORDER BY timestamp ASC

-- Períodos de descanso (gap > 30 min sin cambio):
Calculado en Python comparando timestamps consecutivos`}
            howToRead="La línea de tiempo muestra bicicletas disponibles (azul) y docks libres (verde) a lo largo del día. Pendientes bruscas = actividad intensa. Segmentos planos = la estación 'durmió' (sin uso). Los contadores muestran cuántas 'vidas urbanas' pasaron por ella."
          />

          {/* Station selector */}
          <div style={{ marginBottom:'1.25rem', display:'flex', gap:'1rem', alignItems:'center', flexWrap:'wrap' }}>
            <label style={{ fontSize:'0.85rem', color:'#94a3b8' }}>Estación protagonista:</label>
            <select
              value={selectedStation}
              onChange={e => handleHeroChange(e.target.value)}
              style={{ background:'#1e1e2e', color:'#e2e8f0', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', padding:'0.4rem 0.75rem', fontSize:'0.85rem', cursor:'pointer' }}
            >
              <option value="">🏆 Más activa (automático)</option>
              {summaries.map(s => <option key={s.station_id} value={s.station_id}>{s.name}</option>)}
            </select>
          </div>

          {loading ? (
            <div style={{ height:'200px', display:'flex', alignItems:'center', justifyContent:'center', color:'#475569' }}>Cargando historia…</div>
          ) : hero && !hero.error ? (
            <HeroCard hero={hero} />
          ) : (
            <div style={{ padding:'2rem', textAlign:'center', color:'#475569' }}>
              {hero?.error || 'Sin datos de eventos aún. Espera a que el recolector acumule más actividad.'}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DerbyTable({ title, rows, color }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${color}30`, borderRadius:'10px', padding:'1rem', overflowX:'auto' }}>
      <h3 style={{ color, marginBottom:'0.75rem', fontSize:'0.9rem' }}>{title}</h3>
      {rows.length === 0 ? (
        <p style={{ color:'#475569', fontSize:'0.8rem' }}>Sin datos suficientes.</p>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.78rem' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ textAlign:'left', padding:'0.35rem', color:'#64748b' }}>Origen</th>
              <th style={{ textAlign:'left', padding:'0.35rem', color:'#64748b' }}>Destino</th>
              <th style={{ textAlign:'right', padding:'0.35rem', color:'#64748b' }}>Dist.</th>
              <th style={{ textAlign:'right', padding:'0.35rem', color:'#64748b' }}>Vel.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i) => (
              <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding:'0.35rem', color:'#fcd34d', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.origin}</td>
                <td style={{ padding:'0.35rem', color:'#6ee7b7', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.destination}</td>
                <td style={{ padding:'0.35rem', textAlign:'right', color:'#94a3b8' }}>{r.dist_km} km</td>
                <td style={{ padding:'0.35rem', textAlign:'right', color, fontWeight:700 }}>{r.inferred_speed_kmh} km/h</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function HeroCard({ hero }) {
  const occupancy = hero.capacity ? ((hero.current_bikes / hero.capacity) * 100).toFixed(0) : null;

  return (
    <div>
      {/* Header card */}
      <div style={{
        background:'linear-gradient(135deg,rgba(245,158,11,0.1),rgba(236,72,153,0.1))',
        border:'1px solid rgba(245,158,11,0.25)', borderRadius:'12px', padding:'1.5rem',
        marginBottom:'1rem', display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'1rem',
      }}>
        <Stat icon="🏆" label="Protagonista" value={hero.name || hero.station_id} big />
        <Stat icon="🚲" label="Total salidas" value={hero.total_taken} color="#f87171" />
        <Stat icon="🔄" label="Total llegadas" value={hero.total_returned} color="#34d399" />
        <Stat icon="⚡" label="Total eventos" value={hero.total_events} color="#f59e0b" />
        <Stat icon="😴" label="Períodos de descanso" value={hero.rest_periods_detected} color="#a78bfa" />
        <Stat icon="🚲" label="Bicis ahora" value={hero.current_bikes ?? '—'} color="#00d2ff" />
        <Stat icon="🅿️" label="Docks ahora" value={hero.current_docks ?? '—'} color="#34d399" />
        <Stat icon="📊" label="Ocupación actual" value={occupancy ? `${occupancy}%` : '—'} color="#fbbf24" />
      </div>

      {/* Methodology note */}
      <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'8px', padding:'0.75rem 1rem', marginBottom:'1rem', fontSize:'0.78rem', color:'#64748b', fontStyle:'italic' }}>
        💡 {hero.methodology_note}
      </div>

      {/* Timeline mini-chart */}
      {hero.timeline && hero.timeline.length > 0 && (
        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.08)', padding:'1rem' }}>
          <h3 style={{ color:'#f59e0b', marginBottom:'0.75rem', fontSize:'0.85rem' }}>📈 Línea de Tiempo (últimas 48 mediciones)</h3>
          <MiniChart data={hero.timeline} />
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, color, big }) {
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:big ? '0.85rem' : '1.4rem', color: color || '#e2e8f0', fontWeight:800, lineHeight:1.2, wordBreak:'break-word' }}>
        {big ? `${icon} ${value}` : value}
      </div>
      {!big && <div style={{ fontSize:'0.65rem', color:'#64748b', marginTop:'0.25rem' }}>{icon} {label}</div>}
      {big && <div style={{ fontSize:'0.65rem', color:'#64748b', marginTop:'0.25rem' }}>{label}</div>}
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
