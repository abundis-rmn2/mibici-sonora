'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Determina el color del marcador basado en la disponibilidad
 */
const getMarkerColor = (bikes, capacity) => {
  // Gris si la estación no tiene datos dinámicos (offline o sin polling aún)
  if (bikes === null || bikes === undefined) return '#4A4A6A';
  
  const ratio = capacity > 0 ? bikes / capacity : 0;
  
  if (ratio > 0.5) return '#00C9A7'; // Verde (>50%)
  if (ratio > 0.25) return '#FFD93D'; // Amarillo (25%-50%)
  return '#FF6B6B'; // Rojo (<25%)
};

export default function MapView({ stations, activeRipples = [], showMarkers = true, showRipples = true }) {
  // Solución para el bug de los iconos de Leaflet en React (si se usaran iconos de imagen)
  useEffect(() => {
    // Si usáramos marcadores de imagen normales:
    // L.Icon.Default.imagePath = 'images/';
  }, []);

  const gdlCenter = [20.6736, -103.3440];

  return (
    <div style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
      <MapContainer 
        center={gdlCenter} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false} // Quitamos los controles default (podemos ponerlos donde queramos)
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
                <CircleMarker
                  center={[station.lat, station.lon]}
                  radius={6}
                  pathOptions={{ 
                    color: '#FF6B6B',
                    fillOpacity: 0,
                    className: 'ripple-taken'
                  }}
                />
              )}
              {showRipples && returnedRipple && (
                <CircleMarker
                  center={[station.lat, station.lon]}
                  radius={6}
                  pathOptions={{ 
                    color: '#00C9A7',
                    fillOpacity: 0,
                    className: 'ripple-returned'
                  }}
                />
              )}
              
              {/* Marcador estático principal */}
              {showMarkers && (
                <CircleMarker
                  key={station.id}
                  center={[station.lat, station.lon]}
                  radius={6}
                  pathOptions={{ 
                    color: '#0A0E27', // Borde oscuro
                    weight: 1.5,
                    fillColor: color, 
                    fillOpacity: 0.8 
                  }}
                >
                  <Popup>
                  <div style={{ color: '#0A0E27', minWidth: '180px' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>{station.name}</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                      <span>🚲 Disponibles:</span>
                      <strong style={{ color: '#00C9A7' }}>{station.bikes ?? '?'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span>🅿️ Docks libres:</span>
                      <strong style={{ color: '#FFD93D' }}>{station.docks ?? '?'}</strong>
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
