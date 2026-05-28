/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Evita que Leaflet se monte dos veces y cause el error "Map container is being reused"
  
  // Configuración para evitar CORS en desarrollo local.
  // Las llamadas a /api/* en el frontend serán redirigidas al backend.
  async rewrites() {
    // Tomamos la URL del backend desde variable de entorno,
    // o por defecto localhost:8000 en dev, y el de onrender en prod
    const isDev = process.env.NODE_ENV !== 'production';
    const API_URL = process.env.BACKEND_API_URL || (isDev ? 'http://localhost:8000' : 'https://mibici-api.onrender.com');
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`, // Proxy to Backend
      },
    ];
  },
};

export default nextConfig;
