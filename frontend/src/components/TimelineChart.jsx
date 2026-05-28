'use client';
import { useMemo } from 'react';

export default function TimelineChart({ events }) {
  const pointsCount = 100;
  
  const { takenPath, returnedPath } = useMemo(() => {
    const emptyPath = `M0,100 L1000,100 Z`;
    if (!events || events.length < 2) {
      return { takenPath: emptyPath, returnedPath: emptyPath };
    }
    
    const now = Date.now();
    
    // Para usar todo el ancho de la pantalla, en lugar de 5 minutos fijos,
    // calculamos la distancia de tiempo entre "Ahora" y el evento más antiguo que tenemos.
    const oldestTimestamp = new Date(events[events.length - 1].timestamp).getTime();
    let timeWindowMs = now - oldestTimestamp;
    
    // Dar un mínimo de 30 segundos para que no se vea deforme al arrancar la app
    if (timeWindowMs < 30000) timeWindowMs = 30000;

    const bucketSize = timeWindowMs / pointsCount;
    const takenBuckets = Array(pointsCount).fill(0);
    const returnedBuckets = Array(pointsCount).fill(0);
    
    events.forEach(e => {
      const timeDiff = now - new Date(e.timestamp).getTime();
      if (timeDiff >= 0 && timeDiff < timeWindowMs) {
         const bucketIndex = (pointsCount - 1) - Math.floor(timeDiff / bucketSize);
         if (bucketIndex >= 0 && bucketIndex < pointsCount) {
            if (e.event_type === 'bike_taken') {
               takenBuckets[bucketIndex] += e.delta || 1;
            } else {
               returnedBuckets[bucketIndex] += e.delta || 1;
            }
         }
      }
    });
    
    // El máximo debe considerar ambos para que la escala visual tenga sentido conjunto
    const max = Math.max(...takenBuckets, ...returnedBuckets, 1);
    
    // Función helper para generar el path SVG
    const createPath = (buckets, maxHeightPercent) => {
      const coords = buckets.map((val, i) => {
        const x = (i / (pointsCount - 1)) * 1000;
        const y = 100 - ((val / max) * maxHeightPercent);
        return `${x},${y}`;
      });
      return `M0,100 L${coords.join(' L')} L1000,100 Z`;
    };
    
    // Hacemos que ocupen máximo el 90% del alto
    return {
      takenPath: createPath(takenBuckets, 90),
      returnedPath: createPath(returnedBuckets, 90)
    };
  }, [events]);

  return (
    <div style={{
      position: 'absolute',
      bottom: '36px', // Justo arriba del status bar
      left: 0,
      width: '100vw',
      height: '100px',
      zIndex: 5, // Detrás de los paneles, encima del mapa
      pointerEvents: 'none',
    }}>
      <svg width="100%" height="100%" viewBox="0 0 1000 100" preserveAspectRatio="none" style={{ mixBlendMode: 'screen' }}>
        <defs>
          <linearGradient id="returnedGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#00C9A7" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#00C9A7" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="takenGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#FF6B6B" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        
        {/* Línea Verde: Bicis Devueltas */}
        <path 
          d={returnedPath} 
          fill="url(#returnedGradient)" 
          stroke="#00C9A7" 
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          style={{ transition: 'd 0.5s ease-out' }}
        />
        
        {/* Línea Roja: Bicis Tomadas */}
        <path 
          d={takenPath} 
          fill="url(#takenGradient)" 
          stroke="#FF6B6B" 
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          style={{ transition: 'd 0.5s ease-out' }}
        />
      </svg>
    </div>
  );
}
