export const CONFIG = {
  // Tiempos (milisegundos y segundos)
  // El loop de música dura 16 segundos.
  POLLING_INTERVAL_MS: 16000, 
  LOOP_DURATION_SECONDS: 16,

  // Paleta de Colores centralizada
  COLORS: {
    PRIMARY: '#00C9A7',       // Verde (Bicis Tomadas / Disponibilidad Alta)
    PRIMARY_RGB: '0, 201, 167',
    DANGER: '#FF6B6B',        // Rojo (Bicis Devueltas / Disponibilidad Baja)
    DANGER_RGB: '255, 107, 107',
    SECONDARY: '#FFD93D',     // Amarillo (Disponibilidad Media)
    BG_DARK: '#0A0E27',       // Fondo oscuro del mapa e interfaz
    OFFLINE: '#4A4A6A'        // Gris para estaciones sin datos
  },

  // Estado inicial de la interfaz visual (Dashboard)
  DEFAULT_UI_STATE: {
    showMarkers: false,       // Puntos estáticos en el mapa
    showRipples: true,        // Ondas animadas en el mapa
    showTimeline: true,       // Gráfica de líneas en la parte inferior
    showSequencer: false,     // Piano Roll (oculto por defecto para no saturar)
    showOscilloscope: true,   // Anillos reactivos al audio
    showFeed: false,          // Lista lateral de eventos
    showTimer: false,         // Metrónomo visual numérico
  }
};
