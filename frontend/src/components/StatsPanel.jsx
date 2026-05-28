'use client';

export default function StatsPanel({ stations, loading }) {
  // Calcular métricas
  const totalBikes = stations.reduce((acc, s) => acc + (s.bikes || 0), 0);
  const totalDocks = stations.reduce((acc, s) => acc + (s.docks || 0), 0);
  
  // Breakdown por región
  const gdl = stations.filter(s => s.region === 'GDL').length;
  const zpn = stations.filter(s => s.region === 'ZPN').length;
  const tlq = stations.filter(s => s.region === 'TLQ').length;

  return (
    <div className="glass-panel" style={{
      position: 'absolute',
      top: '100px',
      left: '20px',
      zIndex: 10,
      padding: '20px',
      width: '280px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      <div>
        <h2 style={{ fontSize: '14px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
          Sistema
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Bicis Dispo</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)' }}>
              {loading ? '...' : totalBikes.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Docks Libres</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-secondary)' }}>
              {loading ? '...' : totalDocks.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--color-border)' }} />

      <div>
        <h2 style={{ fontSize: '14px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
          Estaciones
        </h2>
        <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: '12px' }}>
          {loading ? '...' : stations.length}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Guadalajara (GDL)</span>
            <span style={{ fontWeight: 600 }}>{gdl}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Zapopan (ZPN)</span>
            <span style={{ fontWeight: 600 }}>{zpn}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Tlaquepaque (TLQ)</span>
            <span style={{ fontWeight: 600 }}>{tlq}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
