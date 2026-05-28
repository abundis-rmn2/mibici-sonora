'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Header from '../components/Header';
import StatsPanel from '../components/StatsPanel';
import EventFeed from '../components/EventFeed';
import StatusBar from '../components/StatusBar';
import ControlsPanel from '../components/ControlsPanel';
import TimelineChart from '../components/TimelineChart';
import PollingTimer from '../components/PollingTimer';
import { useStations } from '../hooks/useStations';
import { useEvents } from '../hooks/useEvents';
import { useSonification } from '../hooks/useSonification';
import WelcomeModal from '../components/WelcomeModal';

// Leaflet debe importarse dinámicamente porque usa `window` y rompe SSR
const MapView = dynamic(() => import('../components/MapView'), { 
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0E27' }}>
      <div style={{ color: '#00C9A7', fontSize: '18px' }}>Cargando mapa...</div>
    </div>
  )
});

export default function Dashboard() {
  const [currentZone, setZone] = useState('Todas');
  const [showMarkers, setShowMarkers] = useState(false); // Por default oculto
  const [showRipples, setShowRipples] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showFeed, setShowFeed] = useState(false); // Por default oculto
  const [activeRipples, setActiveRipples] = useState([]);
  const [showWelcome, setShowWelcome] = useState(true); // Modal inicial
  const [showMobileMenu, setShowMobileMenu] = useState(false); // Menú responsivo
  const [showTimer, setShowTimer] = useState(false); // Timer visual al centro
  
  
  // Hook de sonificación (Tone.js)
  const { isReady: audioReady, initAudio, stopAudio, playBeatAudio, playTick } = useSonification();
  
  // Polling de estaciones cada 8s para sincronizar con el colector y actualizar la hora
  const { stations, loading: loadingStations, error: stationError, lastUpdate } = useStations(8000);
  
  // Secuenciador maestro
  const handleNewEvents = (newEvents) => {
    // Enriquecer eventos con la zona (municipio) leyendo de stations
    const enrichedEvents = newEvents.map(e => {
       const station = stations.find(s => s.id === e.station_id);
       return { ...e, zone: station ? station.region : 'GDL' }; // Por defecto GDL
    });

    // 1. Crear una partitura (score) de 8 tiempos (0 a 7)
    const score = Array.from({ length: 8 }, () => []);
    enrichedEvents.forEach(e => {
       const beat = e.beat !== undefined ? e.beat : Math.floor(Math.random() * 8);
       score[beat].push(e);
    });

    // 2. Ejecutar la partitura usando setTimeouts precisos
    score.forEach((eventsInBeat, beat) => {
      setTimeout(() => {
        // Sonar el metrónomo (tick) si el timer visual está activo
        if (showTimer) {
          playTick(beat);
        }

        // A. Sonar (Tone.js usa su propio reloj de alta precisión, pero lo disparamos aquí)
        if (eventsInBeat.length > 0) {
           playBeatAudio(eventsInBeat, beat);
        }
        
        // B. Visualizar (El mapa reacciona inmediatamente al state)
        // Solo guardamos los ripples de este segundo exacto
        setActiveRipples(eventsInBeat);
      }, beat * 1000); // 1000ms = 1 segundo por beat
    });
  };

  // Polling de eventos cada 8s (sincronizado con el collector)
  const { events, cycleCount } = useEvents(8000, handleNewEvents);

  // Filtrar estaciones por zona
  const filteredStations = useMemo(() => {
    if (currentZone === 'Todas') return stations;
    return stations.filter(s => s.region === currentZone);
  }, [stations, currentZone]);

  // Filtrar eventos por zona
  const filteredEvents = useMemo(() => {
    const enriched = events.map(e => {
       if (e.zone) return e;
       const station = stations.find(s => s.id === e.station_id);
       return { ...e, zone: station ? station.region : 'GDL' };
    });
    if (currentZone === 'Todas') return enriched;
    return enriched.filter(e => e.zone === currentZone);
  }, [events, currentZone, stations]);

  return (
    <main style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Modal Inicial para activar Audio */}
      {showWelcome && (
        <WelcomeModal onStart={() => {
          initAudio();
          setShowWelcome(false);
        }} />
      )}

      {/* Botón flotante solo para móviles para abrir las opciones */}
      {!showWelcome && (
        <button 
          className="mobile-only glass-panel"
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            padding: '0 24px',
            height: '48px',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#F3F4F6',
            fontSize: '16px',
            fontWeight: '600',
            display: 'flex', // Necesario para gap y centrado
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            gap: '8px'
          }}
        >
          {showMobileMenu ? '✕ Cerrar' : '⚙️ Opciones'}
        </button>
      )}

      {/* Elementos ocultos permanentemente en móvil para ahorrar espacio */}
      <div className="mobile-hidden">
        <Header 
          currentZone={currentZone} 
          setZone={setZone} 
          audioReady={audioReady}
          onToggleAudio={audioReady ? stopAudio : initAudio}
        />
        <StatsPanel stations={filteredStations} loading={loadingStations} />
        {showFeed && <EventFeed events={filteredEvents} stations={stations} />}
        <StatusBar lastUpdate={lastUpdate} connected={!stationError} />
      </div>
        
      {/* Panel de Controles (Visible en desktop siempre, en móvil solo si el menú está abierto) */}
      <div className={showMobileMenu ? '' : 'mobile-hidden'}>
        <ControlsPanel 
          showMarkers={showMarkers} 
          setShowMarkers={setShowMarkers}
          showRipples={showRipples}
          setShowRipples={setShowRipples}
          showTimeline={showTimeline}
          setShowTimeline={setShowTimeline}
          showFeed={showFeed}
          setShowFeed={setShowFeed}
          showTimer={showTimer}
          setShowTimer={setShowTimer}
        />
      </div>

      {/* Timer visual en el centro */}
      {showTimer && <PollingTimer cycleCount={cycleCount} />}

      {/* Gráfica aislada: Siempre visible si está activada, tanto en móvil como desktop */}
      {showTimeline && <TimelineChart events={filteredEvents} />}

      {/* Mapa en el fondo */}
      <MapView 
        stations={filteredStations} 
        activeRipples={activeRipples} 
        showMarkers={showMarkers}
        showRipples={showRipples}
      />
    </main>
  );
}
