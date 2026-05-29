'use client';
import Link from 'next/link';

const NAV_LINKS = [
  { href: '/datos',                 label: '📊 Datos',        title: 'Dashboard Analítico' },
  { href: '/datos/metabolismo',     label: '🔴🔵 Metabolismo', title: 'Metabolismo Urbano' },
  { href: '/datos/corredores',      label: '↗️ Corredores',   title: 'Líneas de Deseo' },
  { href: '/datos/redes',           label: '🕸️ Redes',        title: 'Topología de Red' },
  { href: '/datos/transporte',      label: '♿ Transporte',    title: 'Equidad Espacial' },
  { href: '/datos/estado-de-animo', label: '🐣 Estado',        title: 'Tamagotchi Urbano' },
  { href: '/datos/ludico',          label: '🏎️ Lúdico',        title: 'Derby + Viaje del Héroe' },
];

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
      flexDirection: 'column',
      padding: '12px 24px',
      gap: '10px',
      minWidth: 'min(900px, 95vw)',
    }}>
      {/* Top row: brand + zones + audio */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
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
      </div>

      {/* Bottom row: navigation to analytical views */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '8px' }}>
        {NAV_LINKS.map(({ href, label, title }) => (
          <Link
            key={href}
            href={href}
            title={title}
            style={{
              padding: '4px 10px',
              borderRadius: '16px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.65)',
              textDecoration: 'none',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0,210,255,0.15)';
              e.currentTarget.style.color = '#00d2ff';
              e.currentTarget.style.borderColor = '#00d2ff44';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            }}
          >
            {label}
          </Link>
        ))}
      </div>
    </header>
  );
}
