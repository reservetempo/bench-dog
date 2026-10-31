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
};

module.exports = nextConfig;