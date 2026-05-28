'use client';
import { useEffect, useRef } from 'react';
import { CONFIG } from '../config/constants';

export default function VisualSequencer({ scheduledEvents = [], getTransportSeconds }) {
  const canvasRef = useRef(null);
  const requestRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Configurar alta resolución para pantallas retina
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      const width = rect.width;
      const height = rect.height;
      const currentSeconds = getTransportSeconds() % CONFIG.LOOP_DURATION_SECONDS; // 0 a LOOP_DURATION

      // Limpiar canvas
      ctx.clearRect(0, 0, width, height);

      // Dibujar cuadrícula y fondo (opcional)
      ctx.fillStyle = 'rgba(10, 14, 39, 0.4)';
      ctx.fillRect(0, 0, width, height);
      
      // Líneas de los compases (cada 4 segundos, es decir, cada 4 beats a 60bpm)
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= CONFIG.LOOP_DURATION_SECONDS; i += 4) {
        const x = (i / CONFIG.LOOP_DURATION_SECONDS) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Dibujar eventos programados para este ciclo de 8 segundos
      scheduledEvents.forEach(item => {
        const { event: e, time } = item;
        
        // Pseudo-random but deterministic position based on station_id for visual variation
        const pseudoRand = parseInt(e.station_id || '0') % 100 / 100; 
        
        const isDrum = e.event_type === 'bike_returned'; // Ahora las devueltas son la batería
        
        // La posición X es exactamente el tiempo programado en el compás
        let x = (time / CONFIG.LOOP_DURATION_SECONDS) * width;
        let y = 0;

        if (isDrum) {
          // Cuantizado abajo (batería)
          y = height - 15 - (pseudoRand * 10); // Ligera variación en altura
          ctx.fillStyle = `rgba(${CONFIG.COLORS.DANGER_RGB}, 0.9)`; // Rojo para batería/devueltas
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2); // Bolitas
          ctx.fill();
        } else {
          // Arpegios arriba (melodía)
          y = 15 + (pseudoRand * (height / 2 - 20)); // Mitad superior
          ctx.fillStyle = `rgba(${CONFIG.COLORS.PRIMARY_RGB}, 0.9)`; // Verde para arpegios/sacadas
          ctx.fillRect(x - 6, y, 12, 4); // Línea/Rayita horizontal centrada en X
        }
      });

      // Dibujar Playhead
      const playheadX = (currentSeconds / CONFIG.LOOP_DURATION_SECONDS) * width;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      
      // Sombra del playhead
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(playheadX - 20, 0, 20, height);

      requestRef.current = requestAnimationFrame(draw);
    };

    requestRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(requestRef.current);
    };
  }, [scheduledEvents, getTransportSeconds]);

  return (
    <div style={{
      position: 'absolute',
      bottom: '140px', // Justo arriba del TimelineChart (que está en bottom 36 y height 100)
      left: '5vw',
      width: '90vw',
      height: '120px',
      zIndex: 6,
      pointerEvents: 'none',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.1)'
    }}>
      <canvas 
        ref={canvasRef} 
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
