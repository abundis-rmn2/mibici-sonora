'use client';
import { useEffect, useRef } from 'react';
import { CONFIG } from '../config/constants';

export default function Oscilloscope({ analyserReturned, analyserTaken, isFetching }) {
  const canvasRef = useRef(null);
  const requestRef = useRef();

  useEffect(() => {
    if (!analyserReturned || !analyserTaken) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const dpr = window.devicePixelRatio || 1;
    
    // Función para redimensionar el canvas manteniendo proporciones cuadradas
    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height) * 0.8; // Ocupar 80% del lado más corto
      
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      
      // Ajustar tamaño visual con CSS
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      
      ctx.scale(dpr, dpr);
    };

    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = width * 0.3; // Radio base del círculo

      ctx.clearRect(0, 0, width, height);

      // Función para dibujar un anillo analizador
      const drawRing = (analyser, color, sizeRatio) => {
        const values = analyser.getValue();
        const bufferLength = values.length;
        
        ctx.beginPath();
        // Durante el fetch, podemos engrosar la línea en lugar de usar ruido
        ctx.strokeStyle = color; 
        ctx.lineWidth = isFetching ? 6 : 4; 

        const ringRadius = baseRadius * sizeRatio;

        for (let i = 0; i < bufferLength; i++) {
          const angle = (i / bufferLength) * Math.PI * 2;
          
          // Multiplicamos por 1.5 para hacerlo mucho más sensible y dinámico
          const deformation = values[i] * (ringRadius * 1.5);
          
          const r = ringRadius + deformation;
          
          const x = centerX + r * Math.cos(angle);
          const y = centerY + r * Math.sin(angle);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.closePath();
        ctx.stroke();
      };

      // Dibujar Anillo Verde: Bicis Tomadas (Arpegios) - Tamaño Actual (100%)
      drawRing(analyserTaken, `rgba(${CONFIG.COLORS.PRIMARY_RGB}, 0.9)`, 1.0);

      // Dibujar Anillo Rojo: Bicis Devueltas (Batería) - Tamaño 66%
      drawRing(analyserReturned, `rgba(${CONFIG.COLORS.DANGER_RGB}, 0.9)`, 0.66);

      requestRef.current = requestAnimationFrame(draw);
    };

    requestRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(requestRef.current);
    };
  }, [analyserReturned, analyserTaken, isFetching]);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 5, // Detrás de paneles, encima del mapa
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
