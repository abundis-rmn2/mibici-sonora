import { useState, useEffect } from 'react';
import { fetchStations } from '../services/api';

/**
 * Hook para obtener y mantener actualizadas las estaciones.
 * Hace polling cada N segundos.
 * 
 * @param {number} pollIntervalMs Intervalo de actualización en milisegundos
 */
export function useStations(pollIntervalMs = 30000) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    let isMounted = true;
    
    // 1. Cargar de caché inmediatamente al montar para disponibilidad casi instantánea
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('mibici_stations');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (isMounted) {
            setStations(parsed);
            setLoading(false);
          }
        } catch (e) {}
      }
    }

    async function loadStations() {
      // Solo mostramos estado de carga si de verdad no hay nada
      if (isMounted) {
        setIsFetching(true);
        // Si loading era true, lo mantenemos true SOLO si tampoco tenemos datos aún en stations
        setLoading(prevLoading => prevLoading && stations.length === 0);
      }
      try {
        const data = await fetchStations();
        if (isMounted) {
          // Reemplazamos la info solo cuando el nuevo fetch es exitoso,
          // mientras tanto se dejó la info anterior en pantalla.
          setStations(data);
          setLastUpdate(new Date());
          setError(null);
          // Guardamos en caché para la próxima vez
          sessionStorage.setItem('mibici_stations', JSON.stringify(data));
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setIsFetching(false);
        }
      }
    }

    // Carga inicial (actualiza en background si ya había caché)
    loadStations();

    // Iniciar polling
    const intervalId = setInterval(loadStations, pollIntervalMs);

    // Cleanup al desmontar
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [pollIntervalMs]); // Quitamos stations de las dependencias para evitar reiniciar el polling

  return { stations, loading, error, lastUpdate, isFetching };
}
