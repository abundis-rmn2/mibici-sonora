'use client';
import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import MethodologyPanel from '../../../components/MethodologyPanel';
import { fetchStationSummary, fetchMultimodalStress } from '../../../services/api';
import Link from 'next/link';
import StationDetailModal from '../../../components/StationDetailModal';

const StaticMap = dynamic(() => import('../../../components/StaticMap'), { ssr: false });

export default function TransportePage() {
  const [summaries, setSummaries] = useState([]);
  const [stress, setStress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStationId, setSelectedStationId] = useState(null);
  useEffect(() => {
    Promise.all([fetchStationSummary(), fetchMultimodalStress()])
      .then(([s, st]) => { setSummaries(s); setStress(st); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Map nodes & areas for StaticMap
  const { nodes, areas } = useMemo(() => {
    if (!summaries.length) return { nodes: [], areas: [] };
    const stressMap = Object.fromEntries(stress.map(s => [s.station_id, s.volatility_index]));
    const maxVol = Math.max(...stress.map(s => s.volatility_index), 1);

    const mappedAreas = summaries.map(s => {
      const vol = stressMap[s.station_id] || 0;
      const intensity = vol / maxVol;
      return {
        lat: s.lat,
        lon: s.lon,
        radiusMeters: 400,
        fillColor: '#00d2ff',
        fillOpacity: 0.12 + intensity * 0.15
      };
    });

    const mappedNodes = summaries.map(s => {
      const vol = stressMap[s.station_id] || 0;
      const intensity = vol / maxVol;
      return {
        id: s.station_id,
        lat: s.lat,
        lon: s.lon,
        radius: intensity > 0.6 ? 5 : 3,
        color: intensity > 0.6 ? '#f87171' : intensity > 0.3 ? '#fbbf24' : '#34d399',
        opacity: 0.9
      };
    });

    return { nodes: mappedNodes, areas: mappedAreas };
  }, [summaries, stress]);

  const capacityTotal = summaries.reduce((a, s) => a + (s.capacity || 0), 0);
  const coverage = summaries.length;

  return (
    <div style={{ background:'#0a0a0f', color:'#e2e8f0', fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <Link href="/datos" style={{ color:'#00d2ff', textDecoration:'none', fontSize:'0.85rem' }}>← Volver a Datos</Link>

      <h1 style={{ fontSize:'2rem', fontWeight:800, background:'linear-gradient(90deg,#34d399,#06b6d4)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', margin:'1rem 0 0.25rem' }}>
        Equidad Espacial y Cobertura
      </h1>
      <p style={{ color:'#64748b', marginBottom:'1.5rem', fontSize:'0.9rem' }}>
        Catchment Areas de 400m · Accesibilidad territorial de MiBici
      </p>

      <MethodologyPanel
        defaultOpen={false}
        question="¿Qué zonas de Guadalajara tienen acceso real al sistema de MiBici? ¿La infraestructura sirve equitativamente a distintos contextos urbanos?"
        algorithm={`Catchment Area (Área de Servicio):
  Buffer circular de 400 metros alrededor de cada estación,
  equivalente a ~5 minutos caminando (velocidad peatonal = 4.8 km/h).

  El color del punto indica el estrés de la estación:
  🟢 Verde  → Baja volatilidad (servicio estable)
  🟡 Amarillo → Volatilidad media
  🔴 Rojo   → Alta volatilidad (estrés de última milla)`}
        dataSource={`-- En PostGIS (para análisis completo):
WITH buffers AS (
  SELECT id, ST_Buffer(geom::geography, 400)::geometry as catchment
  FROM stations
)
SELECT b.id, SUM(a.poblacion) * ST_Area(ST_Intersection(b.catchment, a.geom))
             / ST_Area(a.geom) as pop_served
FROM buffers b JOIN inegi_agebs a ON ST_Intersects(b.catchment, a.geom)
GROUP BY b.id

-- Actualmente: visualización con coordenadas de la API GBFS`}
        howToRead="Los círculos translúcidos muestran el área de influencia de cada estación (radio = 400m). Áreas superpuestas = mayor cobertura. Zonas sin círculos = sin acceso al sistema."
        limitation={`Para el análisis completo de equidad espacial (Justice Score) se necesitan:

1. GeoJSON de AGEBs del INEGI con campo grado_marginacion
   → Descarga: https://www.inegi.org.mx/temas/mg/default.html
   → Seleccionar: Marco Geoestadístico → Jalisco → AGEBs urbanas
   → Formato: SHP o GeoJSON

2. Tabla de Índice de Marginación por AGEB (IMU 2020)
   → Descarga: https://www.gob.mx/conapo/documentos/indices-de-marginacion-2020

3. Habilitación de extensión PostGIS para ST_Intersects, ST_Buffer
   → Ya habilitada en este sistema (se usa para puntos de estaciones)

Con estos datos se puede calcular: % de población en zonas de alta marginación con acceso a ≥1 estación de MiBici en 400m.

Referencia: Martens, K. (2016). Transport Justice: Designing Fair Transportation Systems. Routledge.`}
      />

      {/* Summary stats */}
      <div style={{ display:'flex', gap:'1rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
        {[
          { label: 'Estaciones activas', value: coverage, color: '#34d399' },
          { label: 'Capacidad total (docks)', value: capacityTotal, color: '#06b6d4' },
          { label: 'Radio de cobertura', value: '400 m', color: '#a78bfa' },
          { label: 'Tiempo caminando', value: '~5 min', color: '#fbbf24' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding:'0.75rem 1.25rem', borderRadius:'10px', background:`rgba(0,0,0,0.3)`, border:`1px solid ${color}30` }}>
            <div style={{ fontSize:'1.5rem', fontWeight:800, color }}>{loading ? '…' : value}</div>
            <div style={{ fontSize:'0.75rem', color:'#94a3b8' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Catchment map */}
      <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.08)', marginBottom:'1.5rem' }}>
        <div style={{ padding:'0.75rem 1rem', fontSize:'0.75rem', color:'#64748b' }}>
          🗺️ Catchment Areas (400m por estación) · Color = nivel de estrés de última milla
        </div>
        {loading ? (
          <div style={{ height:'420px', display:'flex', alignItems:'center', justifyContent:'center', color:'#475569' }}>Cargando datos de cobertura…</div>
        ) : (
          <StaticMap nodes={nodes} areas={areas} height={420} interactive={true} onNodeClick={setSelectedStationId} />
        )}
        <div style={{ display:'flex', gap:'1.5rem', padding:'0.5rem 1rem', fontSize:'0.75rem', flexWrap:'wrap' }}>
          <span style={{ color:'#34d399' }}>● Baja volatilidad</span>
          <span style={{ color:'#fbbf24' }}>● Volatilidad media</span>
          <span style={{ color:'#f87171' }}>● Alta volatilidad (estrés)</span>
          <span style={{ color:'#06b6d4', opacity:0.7 }}>○ Área de cobertura 400m</span>
        </div>
      </div>

      {/* INEGI call-to-action box */}
      <div style={{
        background:'linear-gradient(135deg,rgba(251,191,36,0.06),rgba(248,113,113,0.06))',
        border:'1px solid rgba(251,191,36,0.25)', borderRadius:'10px', padding:'1.25rem',
      }}>
        <h3 style={{ color:'#fbbf24', marginBottom:'0.75rem', fontSize:'0.9rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <span>📋</span> Próximo paso: Datos INEGI para análisis de equidad
        </h3>
        <p style={{ fontSize:'0.82rem', color:'#94a3b8', lineHeight:1.7, margin:0 }}>
          Para cruzar cobertura territorial con marginación socioeconómica, se necesitan los siguientes datasets del INEGI:
        </p>
        <ol style={{ fontSize:'0.82rem', color:'#cbd5e1', lineHeight:2, marginTop:'0.75rem', paddingLeft:'1.2rem' }}>
          <li><strong style={{ color:'#fbbf24' }}>Marco Geoestadístico (AGEBs):</strong>{' '}
            <a href="https://www.inegi.org.mx/temas/mg/" target="_blank" rel="noopener noreferrer" style={{ color:'#38bdf8' }}>inegi.org.mx/temas/mg/</a>
            {' '}→ Jalisco → Área Geoestadística Básica → formato GeoJSON
          </li>
          <li><strong style={{ color:'#fbbf24' }}>Índice de Marginación Urbana 2020 (CONAPO):</strong>{' '}
            <a href="https://www.gob.mx/conapo" target="_blank" rel="noopener noreferrer" style={{ color:'#38bdf8' }}>gob.mx/conapo</a>
            {' '}→ Índices de Marginación → IMU 2020 → Jalisco → campo <code style={{ color:'#6ee7b7' }}>grado_marginacion</code>
          </li>
        </ol>
        <p style={{ fontSize:'0.78rem', color:'#64748b', marginTop:'0.75rem', marginBottom:0 }}>
          Una vez descargados, coloca los archivos en <code style={{ color:'#6ee7b7' }}>backend/data/inegi/</code> y se activará automáticamente el análisis de equidad con ST_Intersects PostGIS.
        </p>
      </div>
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
