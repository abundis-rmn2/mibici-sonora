'use client';

export default function Header({ currentZone, setZone, audioReady, onToggleAudio }) {
  const zones = ['Todas', 'GDL', 'ZPN', 'TLQ'];

  return (
    <header className="glass-panel" style={{
      position: 'absolute',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      padding: '12px 24px',
      gap: '32px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontSize: '24px' }}>🚲</div>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, letterSpacing: '0.5px' }}>
            MiBici Sonora
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Real-time Monitoring
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {zones.map(z => (
          <button
            key={z}
            onClick={() => setZone(z)}
            style={{
              background: currentZone === z ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.1)',
              color: currentZone === z ? '#0A0E27' : 'var(--color-text)',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'all 0.2s ease'
            }}
          >
            {z}
          </button>
        ))}
      </div>
      
      <div style={{ marginLeft: 'auto' }}>
        <button
          onClick={onToggleAudio}
          style={{
            background: audioReady ? 'rgba(0, 201, 167, 0.2)' : 'rgba(255, 107, 107, 0.2)',
            color: audioReady ? '#00C9A7' : '#FF6B6B',
            border: `1px solid ${audioReady ? '#00C9A7' : '#FF6B6B'}`,
            padding: '8px 16px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          {audioReady ? '🔊 Sonido ON' : '🔇 Activar Sonido'}
        </button>
      </div>
    </header>
  );
}
