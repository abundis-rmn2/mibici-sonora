'use client';
import { useMemo, useState } from 'react';
import { CONFIG } from '../config/constants';

// Componente extraído para evitar que se desmonte/monte en cada re-render del padre
const AccordionGroup = ({ group, groupIndex, formatTime, getStationName }) => {
  const [isOpen, setIsOpen] = useState(false); // Todo cerrado por defecto
  const resultado = group.entradas - group.salidas;
  const isAlternate = groupIndex % 2 === 1;
  const bgGroup = isAlternate ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.2)';
  
  return (
    <div className="animate-slide-in" style={{
      background: bgGroup,
      borderRadius: '8px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      borderLeft: resultado > 0 ? `3px solid ${CONFIG.COLORS.PRIMARY}` : resultado < 0 ? `3px solid ${CONFIG.COLORS.DANGER}` : '3px solid var(--color-text-muted)',
      animationDelay: `${Math.min(groupIndex * 0.05, 0.5)}s`,
      transition: 'all 0.3s ease'
    }}>
      {/* Header del grupo (Estadísticas y Botón Acordeón) */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          borderBottom: isOpen ? '1px solid rgba(255,255,255,0.1)' : 'none', 
          paddingBottom: isOpen ? '8px' : '0',
          cursor: 'pointer'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', transition: 'transform 0.3s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            ▶
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>{formatTime(group.timestamp)}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
          <span style={{ color: CONFIG.COLORS.PRIMARY }}>+{group.entradas}</span>
          <span style={{ color: CONFIG.COLORS.DANGER }}>-{group.salidas}</span>
          <span style={{ color: 'var(--color-text)', fontWeight: 'bold' }}>Net: {resultado > 0 ? `+${resultado}` : resultado}</span>
        </div>
      </div>
      
      {/* Eventos del grupo (Contenido del Acordeón) */}
      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
          {group.events.map((e, i) => {
            const isTaken = e.event_type === 'bike_taken';
            // Invertido: Bicis tomadas = verde (primary), devueltas = rojo (danger)
            const color = isTaken ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.DANGER;
            const icon = isTaken ? '↗' : '↙';
            const action = isTaken ? 'tomada' : 'devuelta';
            const plural = e.delta > 1 ? 's' : '';
            const key = `${e.station_id}-${e.timestamp}-${e.event_type}-${i}`;

            return (
              <div key={key} style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                padding: '4px 0'
              }}>
                <div style={{ 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '50%', 
                  background: `${color}20`,
                  color: color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  {icon}
                </div>
                
                <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500 }}>{getStationName(e.station_id)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    <span style={{ color: 'var(--color-text)' }}>{e.delta}</span> {action}{plural}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
          Registro de Actividad
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
          (() => {
            // Agrupar eventos por timestamp
            const groups = [];
            let currentGroup = null;
            
            events.forEach(e => {
              // Agrupar por la "llamada nueva" (lote de eventos) usando fetchTimestamp
              const groupKey = e.fetchTimestamp || e.timestamp;
              
              if (!currentGroup || currentGroup.key !== groupKey) {
                currentGroup = {
                  key: groupKey,
                  timestamp: groupKey, // Tiempo en que llegó el lote
                  events: [],
                  entradas: 0,
                  salidas: 0
                };
                groups.push(currentGroup);
              }
              
              currentGroup.events.push(e);
              if (e.event_type === 'bike_returned') {
                currentGroup.entradas += e.delta;
              } else {
                currentGroup.salidas += e.delta;
              }
            });

            return groups.map((group, groupIndex) => (
              <AccordionGroup 
                key={group.key} 
                group={group} 
                groupIndex={groupIndex} 
                formatTime={formatTime} 
                getStationName={getStationName} 
              />
            ));
          })()
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
