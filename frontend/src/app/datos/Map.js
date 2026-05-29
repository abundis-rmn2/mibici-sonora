'use client';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';

// Fix Leaflet icon issue in Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function StationMap({ summaries, status, onStationClick }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div style={{height: '600px', background: '#111'}}>Loading map...</div>;

  const center = [20.675, -103.347]; // Approx center of Guadalajara

  return (
    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {summaries.map(station => {
        const stat = status[station.station_id];
        return (
          <Marker key={station.station_id} position={[station.lat, station.lon]}>
            <Popup>
              <div style={{color: '#000'}}>
                <h3 style={{margin: '0 0 5px 0'}}>{station.name}</h3>
                <p style={{margin: '0 0 5px 0'}}>
                  Bikes: <b>{stat ? stat.bikes : '?'}</b><br/>
                  Docks: <b>{stat ? stat.docks : '?'}</b>
                </p>
                <button onClick={() => onStationClick(station.station_id)} style={{
                  background: '#00d2ff', border: 'none', padding: '5px 10px', 
                  color: '#fff', borderRadius: '4px', cursor: 'pointer'
                }}>
                  Ver Historial
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
