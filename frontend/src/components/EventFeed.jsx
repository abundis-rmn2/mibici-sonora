'use client';
import { useMemo } from 'react';

export default function EventFeed({ events, stations }) {
  // Función helper para formatear hora
  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Función helper para obtener el short_name de una estación
  const getStationName = (stationId) => {
    const s = stations.find(s => s.id === stationId);
    return s ? s.short_name : `ID:${stationId}`;
  };

  return (
    <div className="glass-panel" style={{
      position: 'absolute',
      bottom: '60px', // Espacio para status bar
      right: '20px',
      zIndex: 10,
      width: '320px',
      maxHeight: '400px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden' // El scroll va en el contenedor interior
    }}>
      <div style={{ padding: '16px 20px', borderBottom: 'var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '14px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
          Actividad Reciente
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-danger)', animation: 'pulse 2s infinite' }} />
        </div>
      </div>

      <div style={{ padding: '12px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {events.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            Esperando eventos...
          </div>
        ) : (
          events.map((e, i) => {
            const isTaken = e.event_type === 'bike_taken';
            const color = isTaken ? 'var(--color-danger)' : 'var(--color-primary)';
            const icon = isTaken ? '↗' : '↙';
            const action = isTaken ? 'tomada' : 'devuelta';
            const plural = e.delta > 1 ? 's' : '';
            
            // Usamos el ID único (station + timestamp + type) generado en el hook como key si es posible, 
            // o un fallback compuesto
            const key = `${e.station_id}-${e.timestamp}-${e.event_type}`;

            return (
              <div key={key} className="animate-slide-in" style={{
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                animationDelay: `${Math.min(i * 0.05, 0.5)}s` // Staggered animation
              }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  background: `${color}20`, // 20% opacity
                  color: color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  {icon}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{getStationName(e.station_id)}</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{formatTime(e.timestamp)}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    <span style={{ color: 'var(--color-text)' }}>{e.delta}</span> bici{plural} {action}{plural}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 107, 107, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(255, 107, 107, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 107, 107, 0); }
        }
      `}</style>
    </div>
  );
}
