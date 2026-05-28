'use client';

export default function StatusBar({ lastUpdate, connected }) {
  const formatTime = (date) => {
    if (!date) return '--:--:--';
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="glass-panel" style={{
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
      padding: '8px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      fontSize: '12px',
      color: 'var(--color-text-muted)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ 
          width: '8px', 
          height: '8px', 
          borderRadius: '50%', 
          background: connected ? 'var(--color-primary)' : 'var(--color-danger)'
        }} />
        <span>{connected ? 'Conectado (Live)' : 'Desconectado'}</span>
      </div>
      
      <div style={{ width: '1px', height: '12px', background: 'var(--color-border)' }} />
      
      <div>
        Auto-refresh: 8s
      </div>
      
      <div style={{ width: '1px', height: '12px', background: 'var(--color-border)' }} />
      
      <div>
        Última act: <span style={{ color: 'var(--color-text)' }}>{formatTime(lastUpdate)}</span>
      </div>
    </div>
  );
}
