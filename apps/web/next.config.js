/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@veritine/shared-types', '@veritine/shared-config'],
};

module.exports = nextConfig;
