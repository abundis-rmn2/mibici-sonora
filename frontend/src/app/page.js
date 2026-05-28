'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Header from '../components/Header';
import StatsPanel from '../components/StatsPanel';
import EventFeed from '../components/EventFeed';
import StatusBar from '../components/StatusBar';
import ControlsPanel from '../components/ControlsPanel';
import TimelineChart from '../components/TimelineChart';
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
  
  // Hook de sonificación (Tone.js)
  const { isReady: audioReady, initAudio, stopAudio, playBeatAudio } = useSonification();
  
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
  const { events } = useEvents(8000, handleNewEvents);

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

      {/* UI Superpuesta */}
      <Header 
        currentZone={currentZone} 
        setZone={setZone} 
        audioReady={audioReady}
        onToggleAudio={audioReady ? stopAudio : initAudio}
      />
      <StatsPanel stations={filteredStations} loading={loadingStations} />
      
      <ControlsPanel 
        showMarkers={showMarkers} 
        setShowMarkers={setShowMarkers}
        showRipples={showRipples}
        setShowRipples={setShowRipples}
        showTimeline={showTimeline}
        setShowTimeline={setShowTimeline}
        showFeed={showFeed}
        setShowFeed={setShowFeed}
      />

      {showTimeline && <TimelineChart events={filteredEvents} />}

      {showFeed && <EventFeed events={filteredEvents} stations={stations} />}
      <StatusBar lastUpdate={lastUpdate} connected={!stationError} />

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
