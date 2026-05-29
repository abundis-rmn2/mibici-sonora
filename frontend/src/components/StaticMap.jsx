'use client';
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Circle, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function StaticMap({ nodes = [], edges = [], areas = [], height = 420, interactive = false, onNodeClick }) {
  const gdlCenter = [20.6736, -103.3440];

  return (
    <div style={{ height: typeof height === 'number' ? `${height}px` : height, width: '100%', borderRadius: '0 0 12px 12px', overflow: 'hidden', position: 'relative', zIndex: 0 }}>
      <MapContainer
        center={gdlCenter}
        zoom={13}
        style={{ height: '100%', width: '100%', background: '#0A0E27' }}
        zoomControl={interactive}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        keyboard={interactive}
        boxZoom={interactive}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {/* Draw catchments/buffers (meters) */}
        {areas.map((a, i) => (
          <Circle
            key={`area-${i}`}
            center={[a.lat, a.lon]}
            radius={a.radiusMeters}
            pathOptions={{ color: a.color || 'transparent', fillColor: a.fillColor, fillOpacity: a.fillOpacity || 0.2 }}
          />
        ))}

        {/* Draw edges (lines) */}
        {edges.map((e, i) => (
          <Polyline 
            key={`edge-${i}`} 
            positions={[[e.from.lat, e.from.lon], [e.to.lat, e.to.lon]]} 
            pathOptions={{ color: e.color, weight: e.weight || 1, opacity: e.opacity || 0.5 }} 
          />
        ))}

        {/* Draw nodes (stations/points) */}
        {nodes.map((n, i) => {
          if (n.emoji) {
            const icon = L.divIcon({
              html: `<div style="font-size: ${n.emojiSize || 20}px; text-align: center; line-height: 1; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.8)); animation: ${n.pulse ? 'pulse 2s infinite' : 'none'};">${n.emoji}</div>`,
              className: 'custom-emoji-icon',
              iconSize: [30, 30],
              iconAnchor: [15, 15]
            });
            return (
              <Marker key={`node-${i}`} position={[n.lat, n.lon]} icon={icon} eventHandlers={{ click: () => onNodeClick && onNodeClick(n.id) }}>
                {n.tooltip && <Tooltip direction="top" offset={[0, -10]} opacity={1}>{n.tooltip}</Tooltip>}
              </Marker>
            );
          }
          return (
            <CircleMarker 
              key={`node-${i}`} 
              center={[n.lat, n.lon]} 
              radius={n.radius || 3} 
              pathOptions={{ color: '#1a1a2e', weight: 1, fillColor: n.color || '#fff', fillOpacity: n.opacity || 0.8 }} 
              eventHandlers={{ click: () => onNodeClick && onNodeClick(n.id) }}
            >
              {n.tooltip && <Tooltip direction="top" opacity={1}>{n.tooltip}</Tooltip>}
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
