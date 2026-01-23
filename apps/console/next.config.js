/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@appfy/shared'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;
