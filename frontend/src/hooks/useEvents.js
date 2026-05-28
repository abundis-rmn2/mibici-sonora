import { useState, useEffect, useRef } from 'react';
import { fetchLatestEvents } from '../services/api';

/**
 * Hook para obtener y mantener el log de eventos.
 * Acumula nuevos eventos sin duplicados.
 * 
 * @param {number} pollIntervalMs Intervalo de actualización en milisegundos
 */
export function useEvents(pollIntervalMs = 15000, onNewEvents = null) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cycleCount, setCycleCount] = useState(0); // Para sincronizar animaciones
  
  // Guardar la última referencia de onNewEvents para evitar stale closures
  const onNewEventsRef = useRef(onNewEvents);
  useEffect(() => {
    onNewEventsRef.current = onNewEvents;
  }, [onNewEvents]);

  // Usamos un ref para mantener un Set de IDs y evitar O(N) en comprobaciones de duplicados
  const eventIdsRef = useRef(new Set());

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      try {
        if (isMounted) setCycleCount(prev => prev + 1); // Disparamos el ciclo del compás
        
        // Pedimos más eventos (usamos el default o máximo del backend) para no perder actividades
        const data = await fetchLatestEvents(200);
        
        if (isMounted) {
          setEvents(prevEvents => {
            // Filtrar eventos que ya tenemos para no duplicar
            const newEvents = data.filter(e => {
              // El ID único del evento podemos simularlo combinando station_id + timestamp
              const id = `${e.station_id}-${e.timestamp}-${e.event_type}`;
              if (eventIdsRef.current.has(id)) return false;
              eventIdsRef.current.add(id);
              return true;
            });
            
            // Asignar un beat aleatorio (0-7) a cada evento nuevo
            // para que tanto el audio como el mapa se sincronicen en el mismo segundo exacto
            const fetchTimestamp = new Date().toISOString(); // Identificador del lote (llamada)
            newEvents.forEach(e => {
              e.beat = Math.floor(Math.random() * 8);
              e.fetchTimestamp = fetchTimestamp;
            });

            if (newEvents.length === 0) {
              // Si no hay eventos nuevos, llamamos al callback con un arreglo vacío
              // para que el secuenciador y el motor de audio limpien el compás y quede en silencio.
              if (prevEvents.length > 0 && onNewEventsRef.current && isMounted) {
                const callback = onNewEventsRef.current;
                setTimeout(() => callback([]), 0);
              }
              return prevEvents;
            }
            
            // Llamar al callback SOLAMENTE si no es la carga inicial
            // (Para evitar sonificar 200 eventos de golpe y saturar Tone.js)
            if (prevEvents.length > 0 && onNewEventsRef.current && isMounted) {
              console.log(`⚡ [useEvents] Detectados ${newEvents.length} eventos NUEVOS. Enviando al callback.`);
              // Se usa setTimeout para no bloquear el renderizado de React actual
              const callback = onNewEventsRef.current;
              setTimeout(() => callback(newEvents), 0);
            }
            
            // Retornar los anteriores + los nuevos al principio, sin límite (abierto a todas las actividades)
            const combined = [...newEvents, ...prevEvents];
            return combined;
          });
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
    loadEvents();

    // Iniciar polling
    const intervalId = setInterval(loadEvents, pollIntervalMs);

    // Cleanup al desmontar
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [pollIntervalMs]);

  return { events, loading, error, cycleCount };
}
