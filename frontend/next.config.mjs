/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración para evitar CORS en desarrollo local.
  // Las llamadas a /api/* en el frontend serán redirigidas al backend.
  async rewrites() {
    // Tomamos la URL del backend desde variable de entorno,
    // o por defecto localhost:8000
    const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`, // Proxy to Backend
      },
    ];
  },
};

export default nextConfig;
