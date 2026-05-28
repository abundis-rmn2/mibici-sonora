'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CONFIG } from '../config/constants';

/**
 * Determina el color del marcador basado en la disponibilidad
 */
const getMarkerColor = (bikes, capacity) => {
  // Gris si la estación no tiene datos dinámicos (offline o sin polling aún)
  if (bikes === null || bikes === undefined) return CONFIG.COLORS.OFFLINE;
  
  const ratio = capacity > 0 ? bikes / capacity : 0;
  
  if (ratio > 0.5) return CONFIG.COLORS.PRIMARY; // Verde (>50%)
  if (ratio > 0.25) return CONFIG.COLORS.SECONDARY; // Amarillo (25%-50%)
  return CONFIG.COLORS.DANGER; // Rojo (<25%)
};

export default function MapView({ stations, activeRipples = [], showMarkers = true, showRipples = true }) {
  // Solución para el bug de los iconos de Leaflet en React (si se usaran iconos de imagen)
  useEffect(() => {
    // L.Icon.Default.imagePath = 'images/';
  }, []);

  const gdlCenter = [20.6736, -103.3440];
  const zoomLevel = typeof window !== 'undefined' && window.innerWidth < 768 ? 12 : 13;

  return (
    <div style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
      <MapContainer 
        center={gdlCenter} 
        zoom={zoomLevel} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false} // Quitamos controles default
        dragging={false} // Evitar arrastre
        scrollWheelZoom={false} // Evitar zoom con rueda
        doubleClickZoom={false} // Evitar zoom con doble clic
        touchZoom={false} // Evitar zoom táctil
        keyboard={false} // Evitar mover con teclado
        boxZoom={false} // Evitar zoom con caja
      >
        {/* Usamos un base map oscuro para combinar con el Dark Mode y hacer resaltar los marcadores */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {stations.map(station => {
          const color = getMarkerColor(station.bikes, station.capacity);
          
          // Buscar si hay ripples activos para esta estación que el secuenciador maestro nos haya enviado
          const stationRipples = activeRipples.filter(r => r.station_id === station.id);
          
          // Si hay varios, tomamos el más reciente o simplemente mostramos uno por tipo
          const takenRipple = stationRipples.find(r => r.event_type === 'bike_taken');
          const returnedRipple = stationRipples.find(r => r.event_type === 'bike_returned');
          
          return (
            <React.Fragment key={`container-${station.id}`}>
              {/* Si hay un evento reciente, dibujamos un marcador extra debajo que hace la animación de onda */}
              {showRipples && takenRipple && (
                <Marker
                  position={[station.lat, station.lon]}
                  icon={L.divIcon({
                    className: 'custom-ripple',
                    html: '<div class="ripple-ring taken"></div>',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                  })}
                />
              )}
              {showRipples && returnedRipple && (
                <Marker
                  position={[station.lat, station.lon]}
                  icon={L.divIcon({
                    className: 'custom-ripple',
                    html: '<div class="ripple-ring returned"></div>',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                  })}
                />
              )}
              
              {/* Marcador estático principal */}
              {showMarkers && (
                <CircleMarker
                  key={station.id}
                  center={[station.lat, station.lon]}
                  radius={3}
                  pathOptions={{ 
                    color: CONFIG.COLORS.BG_DARK, // Borde oscuro
                    weight: 1,
                    fillColor: color, 
                    fillOpacity: 0.8 
                  }}
                >
                  <Popup>
                  <div style={{ color: CONFIG.COLORS.BG_DARK, minWidth: '180px' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>{station.name}</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                      <span>🚲 Disponibles:</span>
                      <strong style={{ color: CONFIG.COLORS.PRIMARY }}>{station.bikes ?? '?'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span>🅿️ Docks libres:</span>
                      <strong style={{ color: CONFIG.COLORS.SECONDARY }}>{station.docks ?? '?'}</strong>
                    </div>
                    <div style={{ 
                      width: '100%', 
                      height: '6px', 
                      background: '#E5E7EB',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: `${station.capacity > 0 ? ((station.bikes || 0) / station.capacity) * 100 : 0}%`, 
                        height: '100%', 
                        background: color
                      }} />
                    </div>
                    <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '8px', textAlign: 'right' }}>
                      Capacidad: {station.capacity}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
              )}
          </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
