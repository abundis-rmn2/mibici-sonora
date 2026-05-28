'use client';

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Header from '../components/Header';
import StatsPanel from '../components/StatsPanel';
import EventFeed from '../components/EventFeed';
import StatusBar from '../components/StatusBar';
import ControlsPanel from '../components/ControlsPanel';
import TimelineChart from '../components/TimelineChart';
import VisualSequencer from '../components/VisualSequencer';
import Oscilloscope from '../components/Oscilloscope';
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
  const [showMarkers, setShowMarkers] = useState(false); 
  const [showRipples, setShowRipples] = useState(true); // Ondas expansivas por defecto
  const [showTimeline, setShowTimeline] = useState(true); // Gráfica de línea de tiempo por defecto
  const [showSequencer, setShowSequencer] = useState(false); // Secuenciador oculto por defecto
  const [showOscilloscope, setShowOscilloscope] = useState(true); // Osciloscopio por defecto
  const [showFeed, setShowFeed] = useState(false); 
  const [activeRipples, setActiveRipples] = useState([]);
  const [showWelcome, setShowWelcome] = useState(true); // Modal inicial
  const [showMobileMenu, setShowMobileMenu] = useState(false); // Menú responsivo
  const [showTimer, setShowTimer] = useState(false); // Timer visual al centro
  const [scheduledEventsList, setScheduledEventsList] = useState([]); // Eventos programados para el loop actual
  
  // Hook de sonificación (Tone.js)
  const { 
    isReady: audioReady, 
    initAudio, 
    stopAudio, 
    scheduleEvents, 
    playTick,
    setOnRipple,
    analyser,
    getTransportSeconds
  } = useSonification();
  
  // Registrar el callback de ripples sincronizado con Tone.Draw
  useEffect(() => {
    setOnRipple((event) => {
      // Limpiar ripples viejos y añadir el nuevo
      setActiveRipples(prev => {
        const filtered = prev.filter(r => Date.now() - r.timestampMs < 1500);
        return [...filtered, { ...event, timestampMs: Date.now() }];
      });
    });
  }, [setOnRipple]);

  // Polling de estaciones cada 28s para que los datos lleguen antes de terminar el compás de 32s
  const { stations, loading: loadingStations, error: stationError, lastUpdate } = useStations(28000);
  
  // Secuenciador maestro
  const handleNewEvents = (newEvents) => {
    // Limpiar las animaciones de ripples que quedaron del compás anterior
    setActiveRipples([]);
    
    // Enriquecer eventos con la zona (municipio) leyendo de stations
    const enrichedEvents = newEvents.map(e => {
       const station = stations.find(s => s.id === e.station_id);
       return { ...e, zone: station ? station.region : 'GDL' }; // Por defecto GDL
    });

    // Delegamos la programación de audio y animación a Tone.js
    if (audioReady) {
      const scheduled = scheduleEvents(enrichedEvents);
      setScheduledEventsList(scheduled || []);
    }
  };

  // Polling de eventos cada 28s (justo antes de que termine el compás de 32s)
  const { events, cycleCount } = useEvents(28000, handleNewEvents);

  // Efecto para simular el metrónomo visual si showTimer está activo
  useEffect(() => {
    if (!showTimer || !audioReady) return;
    const interval = setInterval(() => {
      // Asumimos que playTick usa Tone.now() interno.
      const beat = Math.floor(Date.now() / 1000) % 32;
      playTick(beat);
    }, 1000);
    return () => clearInterval(interval);
  }, [showTimer, audioReady, playTick]);

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
          showSequencer={showSequencer}
          setShowSequencer={setShowSequencer}
          showOscilloscope={showOscilloscope}
          setShowOscilloscope={setShowOscilloscope}
          showFeed={showFeed}
          setShowFeed={setShowFeed}
          showTimer={showTimer}
          setShowTimer={setShowTimer}
        />
      </div>

      {/* Timer visual en el centro */}
      {showTimer && <PollingTimer cycleCount={cycleCount} />}

      {/* Osciloscopio full page (pointer-events: none) */}
      {showOscilloscope && audioReady && analyser && (
        <Oscilloscope analyser={analyser} isFetching={loadingStations} />
      )}

      {/* Secuenciador Visual (Piano Roll) */}
      {showSequencer && audioReady && (
        <VisualSequencer scheduledEvents={scheduledEventsList} getTransportSeconds={getTransportSeconds} />
      )}

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
