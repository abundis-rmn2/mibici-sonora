'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  fetchStationSummary,
  fetchCurrentStatus,
  fetchHistory,
  fetchAnalyticsEvents,
  fetchFlow,
  fetchBalance,
  fetchMovement
} from '../../services/api';
import './styles.css';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Import Map dynamically to avoid SSR window errors
const MapWithNoSSR = dynamic(() => import('./Map'), { ssr: false });

export default function DatosPage() {
  const [activeTab, setActiveTab] = useState('resumen');
  const [summaries, setSummaries] = useState([]);
  const [status, setStatus] = useState({});
  const [events, setEvents] = useState([]);
  const [flows, setFlows] = useState([]);
  const [balanceBest, setBalanceBest] = useState([]);
  const [balanceWorst, setBalanceWorst] = useState([]);
  const [movementsMore, setMovementsMore] = useState([]);
  const [movementsLess, setMovementsLess] = useState([]);
  
  const [selectedStation, setSelectedStation] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [timeWindow, setTimeWindow] = useState('24h');

  // Helper to get start date based on timeWindow
  const getStartDate = () => {
    const d = new Date();
    if (timeWindow === '24h') d.setHours(d.getHours() - 24);
    else if (timeWindow === '7d') d.setDate(d.getDate() - 7);
    else return null; // all time
    return d.toISOString();
  };

  useEffect(() => {
    // Load base data
    fetchStationSummary().then(setSummaries).catch(console.error);
    fetchCurrentStatus().then(setStatus).catch(console.error);
  }, []);

  useEffect(() => {
    const start = getStartDate();
    if (activeTab === 'eventos') {
      fetchAnalyticsEvents(100).then(setEvents).catch(console.error);
    } else if (activeTab === 'flujo') {
      fetchFlow(20, start).then(setFlows).catch(console.error);
    } else if (activeTab === 'balance') {
      fetchBalance(25, start).then(res => {
        setBalanceBest(res.best);
        setBalanceWorst(res.worst);
      }).catch(console.error);
    } else if (activeTab === 'movimientos') {
      fetchMovement(8, start).then(res => {
        setMovementsMore(res.more);
        setMovementsLess(res.less);
      }).catch(console.error);
    }
  }, [activeTab, timeWindow]);

  useEffect(() => {
    if (selectedStation) {
      const start = getStartDate();
      fetchHistory(selectedStation, 100, start).then(data => {
        // Reverse because history is desc by default
        const reversed = [...data].reverse();
        setHistoryData({
          labels: reversed.map(s => new Date(s.timestamp).toLocaleTimeString()),
          datasets: [
            {
              label: 'Bikes',
              data: reversed.map(s => s.bikes),
              borderColor: '#00d2ff',
              backgroundColor: '#00d2ff',
            },
            {
              label: 'Docks',
              data: reversed.map(s => s.docks),
              borderColor: '#3a7bd5',
              backgroundColor: '#3a7bd5',
            }
          ]
        });
      }).catch(console.error);
    }
  }, [selectedStation, timeWindow]);

  const renderTabs = () => {
    const tabs = [
      { id: 'resumen', label: 'Resumen' },
      { id: 'estado', label: 'Estado Actual' },
      { id: 'mapa', label: 'Mapa Interactivo' },
      { id: 'eventos', label: 'Eventos' },
      { id: 'flujo', label: 'Flujo (Origins/Dest)' },
      { id: 'balance', label: 'Balance y Dispo.' },
      { id: 'movimientos', label: 'Movimientos Masivos' }
    ];
    return (
      <div className="tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  };

  const renderResumen = () => (
    <div className="card table-wrapper">
      <div className="info-box">
        <strong>Resumen de Estaciones</strong>
        ¿Qué información proporciona?: La información estática (maestra) de la red de MiBici.<br/>
        ¿Cómo se obtuvo?: Se extrae del feed estático oficial y se guarda como el registro primario en PostgreSQL.
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Capacidad</th>
            <th>Región</th>
            <th>Ubicación</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map(s => (
            <tr key={s.station_id} onClick={() => setSelectedStation(s.station_id)} style={{cursor: 'pointer'}}>
              <td>{s.station_id}</td>
              <td>{s.name}</td>
              <td>{s.capacity}</td>
              <td>{s.region}</td>
              <td>{s.lat.toFixed(4)}, {s.lon.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderEstado = () => (
    <div className="card table-wrapper">
      <div className="info-box">
        <strong>Estado Actual (Tiempo Real)</strong>
        ¿Qué pregunta responde?: ¿Cuántas bicicletas y puertos libres hay en este instante en cada estación?<br/>
        ¿Cómo se calcula?: Cruzando todas las estaciones con su snapshot más reciente en la base de datos a través de un eficiente "LATERAL JOIN".
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Bikes</th>
            <th>Docks</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map(s => {
            const st = status[s.station_id];
            return (
              <tr key={s.station_id} onClick={() => setSelectedStation(s.station_id)} style={{cursor: 'pointer'}}>
                <td>{s.station_id}</td>
                <td>{s.name}</td>
                <td>{st?.bikes ?? '-'}</td>
                <td>{st?.docks ?? '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderEventos = () => (
    <div className="card table-wrapper">
      <div className="info-box">
        <strong>Eventos Individuales Detectados</strong>
        ¿Qué pregunta responde?: ¿Qué movimientos exactos ocurrieron y cuándo se tomó o regresó una bicicleta?<br/>
        ¿Cómo se detecta?: Un proceso en segundo plano (job) compara iterativamente el último snapshot con el anterior. Si las bicis suben, es llegada; si bajan, es salida.
      </div>
      <table>
        <thead>
          <tr>
            <th>Icono</th>
            <th>Tipo</th>
            <th>Estación</th>
            <th>Delta</th>
            <th>Hora</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => {
            const st = summaries.find(s => s.station_id === e.station_id);
            return (
              <tr key={i}>
                <td>{e.event_type === 'bike_taken' ? '🚲⬆️' : '🚲⬇️'}</td>
                <td>{e.event_type}</td>
                <td>{st?.name || e.station_id}</td>
                <td>{e.delta}</td>
                <td>{new Date(e.timestamp).toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderFlujo = () => (
    <div className="card table-wrapper">
      <div className="info-box">
        <strong>Flujo de la Ciudad (Orígenes y Destinos)</strong>
        ¿Qué pregunta responde?: ¿De dónde se sacan más bicis y dónde terminan en el transcurso del día?<br/>
        ¿Cómo se infiere?: Dado que no hay "ID de bicicleta" o de "usuario", asociamos estadísticamente las estaciones con más salidas (orígenes) con las que tienen más llegadas (destinos) durante la ventana de tiempo.
      </div>
      <h3>Top Rutas Inferidas (Orígenes → Destinos)</h3>
      <table>
        <thead>
          <tr>
            <th>Origen (Top Taken)</th>
            <th>Destino (Top Returned)</th>
            <th>Flujo Proporcional</th>
          </tr>
        </thead>
        <tbody>
          {flows.map((f, i) => {
            const o = summaries.find(s => s.station_id === f.origin_id);
            const d = summaries.find(s => s.station_id === f.destination_id);
            return (
              <tr key={i}>
                <td>{o?.name || f.origin_id}</td>
                <td>{d?.name || f.destination_id}</td>
                <td>{f.bike_count} bicis</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderBalance = () => (
    <div>
      <div className="info-box">
        <strong>Mejor y Peor Balance de Disponibilidad</strong>
        ¿Qué pregunta responde?: ¿Cuáles son las estaciones mejor atendidas y cuáles sufren de desabasto/saturación?<br/>
        ¿Cómo se calcula?: A través de la fórmula <code>Llegadas - Salidas</code>. Se evalúa el "neto" de bicicletas que gana o pierde una estación y se cruza con su capacidad máxima actual para encontrar su nivel de "salud" en la red.
      </div>
      <div className="grid-2">
        <div className="card table-wrapper">
        <h3 style={{color: '#00d2ff'}}>Mejor Balance (Top 25)</h3>
        <table>
          <thead>
            <tr>
              <th>Estación</th>
              <th>Balance</th>
              <th>Av. Docks</th>
              <th>Av. Bikes</th>
            </tr>
          </thead>
          <tbody>
            {balanceBest.map(b => (
              <tr key={b.station_id} onClick={() => setSelectedStation(b.station_id)}>
                <td>{b.name}</td>
                <td style={{color: '#00ff88'}}>+{b.balance}</td>
                <td>{(b.availability_free * 100).toFixed(1)}%</td>
                <td>{(b.availability_bikes * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card table-wrapper">
        <h3 style={{color: '#ff4b4b'}}>Peor Balance (Top 25)</h3>
        <table>
          <thead>
            <tr>
              <th>Estación</th>
              <th>Balance</th>
              <th>Av. Docks</th>
              <th>Av. Bikes</th>
            </tr>
          </thead>
          <tbody>
            {balanceWorst.map(b => (
              <tr key={b.station_id} onClick={() => setSelectedStation(b.station_id)}>
                <td>{b.name}</td>
                <td style={{color: '#ff4b4b'}}>{b.balance}</td>
                <td>{(b.availability_free * 100).toFixed(1)}%</td>
                <td>{(b.availability_bikes * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );

  const renderMovimientos = () => (
    <div>
      <div className="info-box">
        <strong>Movimientos Masivos (Servicio de Camiones)</strong>
        ¿Qué pregunta responde?: ¿Cuáles estaciones están siendo balanceadas manualmente por el personal de MiBici?<br/>
        ¿Cómo se descubre?: A través de análisis de anomalías. Si en una ventana de 16 segundos el cambio (delta) supera las ±8 bicicletas, descartamos uso humano y deducimos matemáticamente que fue un camión logístico actuando en la estación.
      </div>
      <div className="grid-2">
        <div className="card table-wrapper">
        <h3 style={{color: '#00d2ff'}}>Más Atendida (Llegada {'>'} 8)</h3>
        <table>
          <thead><tr><th>Estación</th><th>Movimiento</th></tr></thead>
          <tbody>
            {movementsMore.map((m, i) => (
              <tr key={i} onClick={() => setSelectedStation(m.station_id)}>
                <td>{m.name}</td><td style={{color: '#00ff88'}}>+{m.movement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card table-wrapper">
        <h3 style={{color: '#ff4b4b'}}>Menos Atendida (Salida {'<'} -8)</h3>
        <table>
          <thead><tr><th>Estación</th><th>Movimiento</th></tr></thead>
          <tbody>
            {movementsLess.map((m, i) => (
              <tr key={i} onClick={() => setSelectedStation(m.station_id)}>
                <td>{m.name}</td><td style={{color: '#ff4b4b'}}>{m.movement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );

  return (
    <div className="container" style={{padding: 0}}>
      <div className="header">
        <h1>Datos Analíticos</h1>
        <p>Dashboard de inteligencia para MiBici Sonora</p>
        <div style={{marginTop: '1rem'}}>
          <label style={{marginRight: '1rem'}}>Ventana de tiempo:</label>
          <select 
            value={timeWindow} 
            onChange={e => setTimeWindow(e.target.value)}
            style={{background: '#222', color: '#fff', padding: '0.5rem', borderRadius: '4px', border: '1px solid #444'}}
          >
            <option value="24h">Últimas 24 horas</option>
            <option value="7d">Últimos 7 días</option>
            <option value="all">Todo el tiempo</option>
          </select>
        </div>
      </div>

      {renderTabs()}

      <div style={{minHeight: '400px'}}>
        {activeTab === 'resumen' && renderResumen()}
        {activeTab === 'estado' && renderEstado()}
        {activeTab === 'eventos' && renderEventos()}
        {activeTab === 'flujo' && renderFlujo()}
        {activeTab === 'balance' && renderBalance()}
        {activeTab === 'movimientos' && renderMovimientos()}
        {activeTab === 'mapa' && (
          <div>
            <div className="info-box">
              <strong>Mapa Geográfico Interactivo</strong>
              ¿Qué pregunta responde?: ¿Dónde están las estaciones en la ciudad y cuál fue su comportamiento histórico reciente?<br/>
              ¿Cómo funciona?: Integra latitud y longitud con <em>Leaflet</em>. Al hacer clic en un pin, viaja a la base de datos por todos sus snapshots para pintar la gráfica Chart.js dinámica de su uso temporal.
            </div>
            <div className="card map-container" style={{padding: 0}}>
              <MapWithNoSSR summaries={summaries} status={status} onStationClick={setSelectedStation} />
            </div>
          </div>
        )}
      </div>

      {selectedStation && (
        <div className="modal-overlay" onClick={() => setSelectedStation(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedStation(null)}>&times;</button>
            <h2 style={{marginTop: 0}}>Historial Estación {selectedStation}</h2>
            {historyData ? (
              <Line 
                data={historyData} 
                options={{
                  responsive: true,
                  plugins: { legend: { position: 'top' }, title: { display: false } }
                }} 
              />
            ) : (
              <p>Cargando datos...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
