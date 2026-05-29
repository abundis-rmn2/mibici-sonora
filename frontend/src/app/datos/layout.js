'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/datos',                 label: 'Resumen General',       icon: '📊', desc: 'Dashboard principal' },
  { href: '/datos/metabolismo',     label: 'Metabolismo Urbano',    icon: '🔴🔵', desc: 'Fuentes vs Sumideros' },
  { href: '/datos/corredores',      label: 'Corredores',            icon: '↗️', desc: 'Líneas de Deseo + Estrés' },
  { href: '/datos/redes',           label: 'Topología de Red',      icon: '🕸️', desc: 'Centralidad + LISA' },
  { href: '/datos/transporte',      label: 'Equidad Espacial',      icon: '♿', desc: 'Catchment Areas' },
  { href: '/datos/estado-de-animo', label: 'Estado de Ánimo',       icon: '🐣', desc: 'Tamagotchi Urbano' },
  { href: '/datos/ludico',          label: 'Zona Lúdica',           icon: '🏎️', desc: 'Derby + Viaje del Héroe' },
];

const EXTERNAL_LINKS = [
  { href: '/mibici-se-siente',      label: 'MiBici Se Siente',      icon: '🎭', desc: 'Visualización Full-Page' },
  { href: '/',                      label: 'Instalación Sonora',    icon: '🎵', desc: 'MiBici Sonora' },
];

export default function DatosLayout({ children }) {
  const pathname = usePathname();

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#0a0a0f',
      color: '#e2e8f0',
      fontFamily: "'Inter','Segoe UI',sans-serif",
      overflow: 'hidden',
    }}>
      {/* ── Sidebar nav ── */}
      <aside style={{
        width: '220px',
        flexShrink: 0,
        background: 'rgba(255,255,255,0.03)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        padding: '1.25rem 0',
      }}>
        {/* Brand */}
        <div style={{ padding: '0 1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#00d2ff', lineHeight: 1.2 }}>🚲</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#00d2ff', letterSpacing: '0.04em' }}>MiBici Sonora</div>
            <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '0.1rem' }}>Panel Analítico</div>
          </Link>
        </div>

        {/* Datos section */}
        <nav style={{ padding: '0.75rem 0', flex: 1 }}>
          <div style={{ padding: '0 1rem 0.4rem', fontSize: '0.6rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Análisis Urbano
          </div>
          {NAV_ITEMS.map(({ href, label, icon, desc }) => {
            const isActive = pathname === href;
            return (
              <Link key={href} href={href} style={{
                display: 'block',
                padding: '0.55rem 1rem',
                textDecoration: 'none',
                background: isActive ? 'rgba(0,210,255,0.1)' : 'transparent',
                borderLeft: isActive ? '2px solid #00d2ff' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; } }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: isActive ? 700 : 500, color: isActive ? '#00d2ff' : '#cbd5e1' }}>
                  {icon} {label}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '0.1rem' }}>{desc}</div>
              </Link>
            );
          })}

          <div style={{ padding: '0.75rem 1rem 0.4rem', fontSize: '0.6rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            Otras Vistas
          </div>
          {EXTERNAL_LINKS.map(({ href, label, icon, desc }) => (
            <Link key={href} href={href} style={{
              display: 'block',
              padding: '0.5rem 1rem',
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{icon} {label}</div>
              <div style={{ fontSize: '0.63rem', color: '#374151' }}>{desc}</div>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.62rem', color: '#374151' }}>
          <div>Datos: API GBFS MiBici · PostgreSQL</div>
          <div style={{ marginTop: '0.4rem' }}>
            <a href="https://abundis.com.mx" target="_blank" rel="noopener noreferrer" style={{ color: '#475569', textDecoration: 'none', transition: 'color 0.2s' }}
               onMouseEnter={e => e.currentTarget.style.color = '#00d2ff'}
               onMouseLeave={e => e.currentTarget.style.color = '#475569'}
            >
              Javi Abundis · abundis.com.mx
            </a>
          </div>
        </div>
      </aside>

      {/* ── Main scrollable content ── */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        height: '100vh',
        padding: '2rem',
      }}>
        {children}
      </main>
    </div>
  );
}
