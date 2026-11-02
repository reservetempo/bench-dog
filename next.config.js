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
  // Plain HTML pages in public/: Unit Tree at /units, gate character doc at /gates
  async rewrites() {
    return [
      { source: '/units', destination: '/units/index.html' },
      { source: '/gates', destination: '/gates/index.html' },
    ];
  },
  // SAP-1 moved to its own site; keep old /sap1 links working
  async redirects() {
    return [{ source: '/sap1', destination: 'https://reservetempo.github.io/sap-computer/', permanent: true }];
  },
};

module.exports = nextConfig;