'use client';
import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import MethodologyPanel from '../../../components/MethodologyPanel';
import { fetchNetworkCentrality, fetchLisaClusters } from '../../../services/api';
import Link from 'next/link';
import StationDetailModal from '../../../components/StationDetailModal';

const StaticMap = dynamic(() => import('../../../components/StaticMap'), { ssr: false });

const LISA_META = {
  HH: { color: '#dc2626', label: 'Alto-Alto', desc: 'Zona con muchas bicis rodeada de zonas con muchas bicis (sobreoferta clúster)' },
  LH: { color: '#3b82f6', label: 'Bajo-Alto',  desc: 'Zona vacía rodeada de zonas llenas (outlier: escasez localizada)' },
  LL: { color: '#1e40af', label: 'Bajo-Bajo',  desc: 'Zona vacía rodeada de zonas vacías (clúster de escasez/desabasto)' },
  HL: { color: '#f59e0b', label: 'Alto-Bajo',  desc: 'Zona llena rodeada de zonas vacías (isla de disponibilidad)' },
};

export default function RedesPage() {
  const [centrality, setCentrality] = useState([]);
  const [lisa, setLisa] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('centrality');
  const [tooltip, setTooltip] = useState(null);
  const [selectedStationId, setSelectedStationId] = useState(null);
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchNetworkCentrality(), fetchLisaClusters()])
      .then(([c, l]) => { setCentrality(c); setLisa(l); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Map nodes and edges for StaticMap
  const { nodes, edges } = useMemo(() => {
    if (!centrality.length) return { nodes: [], edges: [] };
    const maxC = Math.max(...centrality.map(c => c.centrality_score || 0), 1);
    const lisaMap = Object.fromEntries(lisa.map(l => [l.station_id, l]));

    const mappedNodes = centrality.map(c => {
      const intensity = (c.centrality_score || 0) / maxC;
      const l = lisaMap[c.station_id];
      let color = '#475569';
      if (l) {
        if (l.cluster_label === 'HH') color = '#f472b6'; // hot spot
        if (l.cluster_label === 'LL') color = '#818cf8'; // cold spot
        if (l.cluster_label === 'HL' || l.cluster_label === 'LH') color = '#a78bfa'; // outlier
      } else if (c.is_critical) {
        color = '#fcd34d';
      }

      return {
        id: c.station_id,
        lat: c.lat,
        lon: c.lon,
        radius: 3 + intensity * 7,
        color,
        opacity: 0.9
      };
    });

    const mappedEdges = [];
    for (let i = 0; i < centrality.length; i++) {
      for (let j = i + 1; j < centrality.length; j++) {
        const c1 = centrality[i], c2 = centrality[j];
        if (c1.is_critical && c2.is_critical && Math.hypot(c1.lon - c2.lon, c1.lat - c2.lat) < 0.02) {
          mappedEdges.push({
            from: { lat: c1.lat, lon: c1.lon },
            to: { lat: c2.lat, lon: c2.lon },
            weight: 2,
            color: 'rgba(252,211,77,0.3)'
          });
        }
      }
    }

    return { nodes: mappedNodes, edges: mappedEdges };
  }, [centrality, lisa]);

  const criticalNodes = centrality.filter(d => d.is_critical).slice(0, 10);

  return (
    <div style={{ background:'#0a0a0f', color:'#e2e8f0', fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
        <Link href="/datos" style={{ color:'#00d2ff', textDecoration:'none', fontSize:'0.85rem' }}>Volver a Datos →</Link>
      </div>

      <h1 style={{ fontSize:'2rem', fontWeight:800, background:'linear-gradient(90deg,#a78bfa,#f472b6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', margin:'1rem 0 0.25rem' }}>
        Topología de Red
      </h1>
      <p style={{ color:'#64748b', marginBottom:'1.5rem', fontSize:'0.9rem' }}>
        Centralidad de Intermediación · Clústeres LISA
      </p>

      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.5rem' }}>
        {[['centrality','🕸️ Betweenness Centrality'],['lisa','🗺️ Clústeres LISA']].map(([id,label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding:'0.5rem 1.1rem', borderRadius:'8px', border:'none', cursor:'pointer',
            background: activeTab===id ? 'linear-gradient(90deg,#7c3aed,#a78bfa)' : 'rgba(255,255,255,0.06)',
            color: activeTab===id ? '#fff' : '#94a3b8', fontWeight: activeTab===id ? 700 : 400, fontSize:'0.85rem',
          }}>{label}</button>
        ))}
      </div>

      {activeTab === 'centrality' && (
        <>
          <MethodologyPanel
            question="¿Qué estaciones son 'puentes críticos' de la red? No necesariamente las más usadas, sino las que, si fallan (sin bicis o sin docks), fragmentan la conectividad de toda la red."
            algorithm={`Se construye un grafo dirigido G(V,E) donde:
  V = estaciones de MiBici
  E = corredores O/D inferidos con peso = 1/volumen
     (mayor volumen → menor costo → mayor preferencia)

La Centralidad de Intermediación (CB) de un nodo v:
  CB(v) = Σ_{s≠v≠t} [σ(s,t|v) / σ(s,t)]
donde σ(s,t) = número de caminos más cortos entre s y t.

Se normaliza a [0,1]. Nodos con CB > 0.05 = CRÍTICOS.`}
            dataSource={`import networkx as nx
G = nx.DiGraph()
for origen, destino, volumen in od_pairs:
    G.add_edge(origen, destino, weight=1.0/volumen)
centrality = nx.betweenness_centrality(G, weight='weight', normalized=True)`}
            howToRead="Círculos ROSAS grandes = nodos puente críticos (centralidad > 5%). Si una estación rosa se queda sin bicis, muchos trayectos de la red deben redirigirse. Círculos grises pequeños = nodos periféricos."
            reference="Porta, S., Crucitti, P., & Latora, V. (2006). The network analysis of urban streets: A primal approach. Environment and Planning B: Planning and Design, 33(5), 705-725."
          />
          <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.08)', marginBottom:'1.5rem' }}>
            <div style={{ padding:'0.75rem 1rem', fontSize:'0.75rem', color:'#64748b' }}>
              🕸️ Grafo de centralidad · {centrality.length} nodos · <span style={{ color:'#f472b6' }}>{criticalNodes.length} críticos</span>
            </div>
            {loading ? (
              <div style={{ height:'420px', display:'flex', alignItems:'center', justifyContent:'center', color:'#475569' }}>Cargando topología…</div>
            ) : (
              <StaticMap nodes={nodes} edges={edges} height={420} interactive={true} onNodeClick={setSelectedStationId} />
            )}
            <div style={{ display:'flex', gap:'1.5rem', padding:'0.5rem 1rem', fontSize:'0.75rem' }}>
              <span style={{ color:'#f472b6' }}>● Nodo crítico (CB &gt; 5%) — riesgo de fragmentación</span>
              <span style={{ color:'#94a3b8' }}>● Nodo periférico</span>
            </div>
          </div>
          <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'10px', border:'1px solid rgba(167,139,250,0.2)', padding:'1rem', overflowX:'auto' }}>
            <h3 style={{ color:'#a78bfa', marginBottom:'0.75rem', fontSize:'0.9rem' }}>Top 10 Nodos Puente Críticos</h3>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8rem' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ textAlign:'left', padding:'0.4rem', color:'#64748b' }}>#</th>
                  <th style={{ textAlign:'left', padding:'0.4rem', color:'#64748b' }}>Estación</th>
                  <th style={{ textAlign:'right', padding:'0.4rem', color:'#64748b' }}>Centralidad</th>
                  <th style={{ textAlign:'center', padding:'0.4rem', color:'#64748b' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {criticalNodes.map((n,i) => (
                  <tr key={n.station_id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding:'0.4rem', color:'#64748b' }}>{i+1}</td>
                    <td style={{ padding:'0.4rem', color:'#e2e8f0' }}>{n.name || n.station_id}</td>
                    <td style={{ padding:'0.4rem', textAlign:'right', color:'#f472b6', fontWeight:700 }}>{(n.centrality_index*100).toFixed(2)}%</td>
                    <td style={{ padding:'0.4rem', textAlign:'center' }}>
                      <span style={{ background:'rgba(244,114,182,0.15)', color:'#f472b6', padding:'0.15rem 0.5rem', borderRadius:'4px', fontSize:'0.7rem', fontWeight:600 }}>CRÍTICO</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'lisa' && (
        <>
          <MethodologyPanel
            question="¿La escasez o abundancia de bicicletas es aleatoria o hay un patrón espacial contagioso? LISA identifica clústeres donde varias estaciones vecinas comparten el mismo estado de disponibilidad."
            algorithm={`I de Moran Local (Anselin, 1995):
  I_i = z_i × Σ_j(w_ij × z_j)
donde z_i = ratio_i estandarizado, w_ij = peso espacial.

Cuadrantes (basados en la posición en el diagrama de Moran):
  HH (1): I_i > 0, z_i > 0  → Zona llena en vecindario lleno
  LH (2): I_i < 0, z_i < 0  → Zona vacía en vecindario lleno
  LL (3): I_i > 0, z_i < 0  → Zona vacía en vecindario vacío
  HL (4): I_i < 0, z_i > 0  → Zona llena en vecindario vacío

Solo se muestran resultados con p < 0.05 (99 permutaciones).`}
            dataSource={`from libpysal.weights import DistanceBand
from esda.moran import Moran_Local

coords = array([[lon, lat] for each station])
y = array([bikes/capacity for each station])
w = DistanceBand(coords, threshold=0.0072, binary=True)  # ~800m
w.transform = 'r'
lisa = Moran_Local(y, w, permutations=99)
# Filtrar: lisa.p_sim < 0.05`}
            howToRead="Cada punto coloreado = estación con patrón espacial significativo. HH (rojo) = zona de sobreoferta contigua. LL (azul oscuro) = zona de escasez sistémica. LH/HL = anomalías espaciales donde una estación 'rompe' el patrón de su vecindario."
            reference="Anselin, L. (1995). Local Indicators of Spatial Association — LISA. Geographical Analysis, 27(2), 93-115."
          />
          <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.08)', marginBottom:'1.5rem' }}>
            <div style={{ padding:'0.75rem 1rem', fontSize:'0.75rem', color:'#64748b' }}>
              🗺️ Clústeres LISA significativos (p &lt; 0.05) · {lisa.length} estaciones clasificadas
            </div>
            {loading ? (
              <div style={{ height:'400px', display:'flex', alignItems:'center', justifyContent:'center', color:'#475569' }}>Calculando LISA (libpysal + esda)…</div>
            ) : lisa.length === 0 ? (
              <div style={{ height:'200px', display:'flex', alignItems:'center', justifyContent:'center', color:'#475569', flexDirection:'column', gap:'0.5rem' }}>
                <span style={{ fontSize:'2rem' }}>📊</span>
                <span>Sin clústeres significativos con los datos actuales.</span>
                <span style={{ fontSize:'0.75rem' }}>Se necesitan más días de recolección para patrones estadísticos robustos.</span>
              </div>
            ) : (
              <StaticMap nodes={nodes} height={420} interactive={true} onNodeClick={setSelectedStationId} />
            )}
            <div style={{ display:'flex', gap:'1rem', padding:'0.5rem 1rem', flexWrap:'wrap' }}>
              {Object.entries(LISA_META).map(([k,m]) => (
                <span key={k} style={{ fontSize:'0.7rem', color:m.color, display:'flex', alignItems:'center', gap:'0.3rem' }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:m.color, display:'inline-block' }} />
                  {k}: {m.label}
                </span>
              ))}
            </div>
          </div>
          {/* LISA table */}
          {lisa.length > 0 && (
            <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'10px', padding:'1rem', overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ textAlign:'left', padding:'0.4rem', color:'#64748b' }}>Estación</th>
                    <th style={{ textAlign:'center', padding:'0.4rem', color:'#64748b' }}>Clúster</th>
                    <th style={{ textAlign:'right', padding:'0.4rem', color:'#64748b' }}>p-valor</th>
                    <th style={{ textAlign:'right', padding:'0.4rem', color:'#64748b' }}>Disponibilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {lisa.map(r => {
                    const meta = LISA_META[r.cluster_label] || {};
                    return (
                      <tr key={r.station_id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding:'0.4rem', color:'#e2e8f0' }}>{r.name || r.station_id}</td>
                        <td style={{ padding:'0.4rem', textAlign:'center' }}>
                          <span style={{ background:`${meta.color}22`, color:meta.color, padding:'0.15rem 0.5rem', borderRadius:'4px', fontSize:'0.7rem', fontWeight:700 }}>{r.cluster_label}</span>
                        </td>
                        <td style={{ padding:'0.4rem', textAlign:'right', color:'#94a3b8' }}>{r.p_value}</td>
                        <td style={{ padding:'0.4rem', textAlign:'right', color:'#e2e8f0' }}>{(r.availability_ratio*100).toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Station Detail Modal */}
      {selectedStationId && (
        <StationDetailModal 
          stationId={selectedStationId} 
          onClose={() => setSelectedStationId(null)} 
          moodData={(function() {
            return { color: '#f472b6', emoji: '📍', label: 'Estación' };
          })()}
        />
      )}

    </div>
  );
}
