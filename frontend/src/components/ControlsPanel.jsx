'use client';
import { CONFIG } from '../config/constants';

export default function ControlsPanel({ 
  showMarkers, setShowMarkers, 
  showRipples, setShowRipples,
  showTimeline, setShowTimeline,
  showSequencer, setShowSequencer,
  showOscilloscope, setShowOscilloscope,
  showFeed, setShowFeed,
  showTimer, setShowTimer,
  testSound
}) {
  return (
    <div className="glass-panel" style={{
      position: 'absolute',
      top: '320px', // Debajo del StatsPanel
      left: '20px',
      zIndex: 10,
      padding: '16px 20px',
      width: '280px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <h2 style={{ fontSize: '14px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px 0' }}>
        Opciones Visuales
      </h2>
      
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
        <input 
          type="checkbox" 
          checked={showMarkers} 
          onChange={e => setShowMarkers(e.target.checked)} 
          style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
        />
        Red de MiBici
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
        <input 
          type="checkbox" 
          checked={showRipples} 
          onChange={e => setShowRipples(e.target.checked)} 
          style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
        />
        Actividad de estaciones
      </label>
      
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
        <input 
          type="checkbox" 
          checked={showTimeline} 
          onChange={e => setShowTimeline(e.target.checked)} 
          style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
        />
        Gráfica de Línea de Tiempo
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
        <input 
          type="checkbox" 
          checked={showSequencer} 
          onChange={e => setShowSequencer(e.target.checked)} 
          style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
        />
        Partitura de Eventos
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
        <input 
          type="checkbox" 
          checked={showOscilloscope} 
          onChange={e => setShowOscilloscope(e.target.checked)} 
          style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
        />
        Osciloscopio (Circular)
      </label>
      
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
        <input 
          type="checkbox" 
          checked={showFeed} 
          onChange={e => setShowFeed(e.target.checked)} 
          style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
        />
        Registro de actividad en Estaciones
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
        <input 
          type="checkbox" 
          checked={showTimer} 
          onChange={e => setShowTimer(e.target.checked)} 
          style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
        />
        Metrónomo ({CONFIG.LOOP_DURATION_SECONDS} Segundos)
      </label>

      {testSound && (
        <>
          <div style={{ height: '1px', background: 'var(--glass-border)', margin: '8px 0' }} />
          <h2 style={{ fontSize: '14px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px 0' }}>
            Audición
          </h2>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button 
              onClick={() => testSound('arp')}
              style={{ flex: 1, padding: '6px 4px', background: 'rgba(0, 201, 167, 0.2)', border: `1px solid ${CONFIG.COLORS.PRIMARY}`, color: 'var(--color-text)', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
              Arpegio
            </button>
            <button 
              onClick={() => testSound('kick')}
              style={{ flex: 1, padding: '6px 4px', background: 'rgba(255, 107, 107, 0.2)', border: `1px solid ${CONFIG.COLORS.DANGER}`, color: 'var(--color-text)', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
              Kick
            </button>
            <button 
              onClick={() => testSound('snare')}
              style={{ flex: 1, padding: '6px 4px', background: 'rgba(255, 107, 107, 0.2)', border: `1px solid ${CONFIG.COLORS.DANGER}`, color: 'var(--color-text)', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
              Snare
            </button>
            <button 
              onClick={() => testSound('hihat')}
              style={{ flex: 1, padding: '6px 4px', background: 'rgba(255, 107, 107, 0.2)', border: `1px solid ${CONFIG.COLORS.DANGER}`, color: 'var(--color-text)', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
              Hi-Hat
            </button>
            <button 
              onClick={() => testSound('crash')}
              style={{ flex: 1, padding: '6px 4px', background: 'rgba(255, 217, 61, 0.2)', border: `1px solid ${CONFIG.COLORS.SECONDARY}`, color: 'var(--color-text)', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
              Crash
            </button>
          </div>
        </>
      )}
    </div>
  );
}
