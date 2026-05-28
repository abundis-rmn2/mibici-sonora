'use client';

export default function WelcomeModal({ onStart }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(10, 14, 39, 0.9)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999, // Debe estar por encima de todo
      padding: '20px',
      textAlign: 'center',
      color: '#F9FAFB'
    }}>
      
      <div style={{
        maxWidth: '600px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: '40px',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <h1 style={{ 
          fontSize: '36px', 
          fontWeight: '700', 
          marginBottom: '16px',
          background: 'linear-gradient(to right, #00C9A7, #00A58E)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          MiBici Sonora
        </h1>
        
        <p style={{ fontSize: '18px', lineHeight: '1.6', marginBottom: '24px', color: '#D1D5DB' }}>
          Una instalación artística y de visualización de datos en tiempo real que transforma el sistema de bicicletas públicas del Área Metropolitana de Guadalajara en un paisaje sonoro generativo.
        </p>

        <p style={{ fontSize: '16px', lineHeight: '1.6', marginBottom: '40px', color: '#9CA3AF' }}>
          Cada vez que alguien toma o devuelve una bicicleta, el sistema genera un sonido único basado en la ubicación, convirtiendo el pulso de la ciudad en música.
        </p>

        <button 
          onClick={onStart}
          style={{
            backgroundColor: '#00C9A7',
            color: '#0A0E27',
            border: 'none',
            padding: '16px 32px',
            fontSize: '18px',
            fontWeight: '600',
            borderRadius: '50px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 10px 15px -3px rgba(0, 201, 167, 0.3)',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 15px 20px -3px rgba(0, 201, 167, 0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 201, 167, 0.3)';
          }}
        >
          🎵 Iniciar Experiencia Sonora
        </button>
      </div>

    </div>
  );
}
