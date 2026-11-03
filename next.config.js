/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enables Next.js Image component to optimize images from Cloudinary
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/YOUR_CLOUDINARY_CLOUD_NAME/image/upload/**',
      },
    ],
  },
  // Plain HTML pages in public/: Unit Tree at /units, character style dump at /dump
  async rewrites() {
    return [
      { source: '/units', destination: '/units/index.html' },
      { source: '/dump', destination: '/dump/index.html' },
    ];
  },
  // SAP-1 and the gates game (Lords & Logicians) moved to their own sites;
  // keep old /sap1, /gates (design doc) and /gates/play links working
  async redirects() {
    return [
      { source: '/sap1', destination: 'https://reservetempo.github.io/sap-computer/', permanent: true },
      { source: '/gates', destination: 'https://reservetempo.github.io/logic-king/design/', permanent: true },
      { source: '/gates/play', destination: 'https://reservetempo.github.io/logic-king/', permanent: true },
    ];
  },
};

module.exports = nextConfig;