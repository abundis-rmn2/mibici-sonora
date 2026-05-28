'use client';
import { useEffect, useRef } from 'react';

export default function Oscilloscope({ analyser, isFetching }) {
  const canvasRef = useRef(null);
  const requestRef = useRef();

  useEffect(() => {
    if (!analyser) return;

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

      // Obtener datos de la forma de onda
      const values = analyser.getValue();
      const bufferLength = values.length;
      
      ctx.beginPath();
      // Hacer el anillo más grueso e intenso (y cambiar el color levemente si está haciendo fetch)
      ctx.strokeStyle = isFetching ? 'rgba(0, 201, 167, 0.8)' : 'rgba(255, 255, 255, 0.6)'; // Verde al fetchear
      ctx.lineWidth = isFetching ? 8 : 6; 

      for (let i = 0; i < bufferLength; i++) {
        // Mapear el índice a un ángulo (de 0 a 2PI)
        const angle = (i / bufferLength) * Math.PI * 2;
        
        // Ruido blanco visual para movimiento continuo, mucho más intenso durante el fetch
        const noiseAmount = isFetching ? 0.15 : 0.03; 
        const noise = (Math.random() - 0.5) * (baseRadius * noiseAmount);
        
        // values[i] va de -1 a 1. Lo multiplicamos por un factor de deformación.
        const deformation = values[i] * (baseRadius * 0.5);
        
        // Sumamos el radio base, la onda de audio y el ruido constante
        const r = baseRadius + deformation + noise;
        
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

      requestRef.current = requestAnimationFrame(draw);
    };

    requestRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(requestRef.current);
    };
  }, [analyser]);

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
