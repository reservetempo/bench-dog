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
  // Unit Tree is a plain HTML/JS app in public/units; serve it at /units
  async rewrites() {
    return [{ source: '/units', destination: '/units/index.html' }];
  },
  // SAP-1 moved to its own site; keep old /sap1 links working
  async redirects() {
    return [{ source: '/sap1', destination: 'https://reservetempo.github.io/sap-computer/', permanent: true }];
  },
};

module.exports = nextConfig;