'use client';
import { useEffect, useState } from 'react';
import { CONFIG } from '../config/constants';

export default function PollingTimer({ cycleCount }) {
  // El key será directamente el cycleCount que viene desde useEvents
  // Cada vez que cambia (basado en POLLING_INTERVAL_MS),
  // el SVG se vuelve a montar y la animación CSS 'fillTimer' inicia de nuevo exactamente sincronizada
  const key = cycleCount || 0;

  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 5,
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <svg 
        width={size} 
        height={size} 
        viewBox={`0 0 ${size} ${size}`} 
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Fondo del círculo */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Círculo animado */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: circumference,
            animation: `fillTimer ${CONFIG.POLLING_INTERVAL_MS / 1000}s linear infinite`
          }}
        />
      </svg>
      <div style={{
        position: 'absolute',
        color: 'var(--color-primary)',
        fontSize: '14px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '1px'
      }}>
        {CONFIG.POLLING_INTERVAL_MS / 1000}s
      </div>
      
      <style jsx>{`
        @keyframes fillTimer {
          0% {
            stroke-dashoffset: ${circumference};
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}
