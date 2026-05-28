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
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStations() {
      if (isMounted) {
        setLoading(true);
      }
      try {
        const data = await fetchStations();
        if (isMounted) {
          setStations(data);
          setLastUpdate(new Date());
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    // Carga inicial
    loadStations();

    // Iniciar polling
    const intervalId = setInterval(loadStations, pollIntervalMs);

    // Cleanup al desmontar
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [pollIntervalMs]);

  return { stations, loading, error, lastUpdate };
}
