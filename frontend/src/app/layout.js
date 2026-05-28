import './globals.css';

export const metadata = {
  title: 'MiBici Sonora',
  description: 'Sistema de monitoreo y sonificación en tiempo real de MiBici Guadalajara.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <div className="app-container">
          {children}
        </div>
      </body>
    </html>
  );
}
