/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@veritine/shared-types', '@veritine/shared-config'],
  webpack: (config) => {
    // wagmi's bundled Base Account / Coinbase Smart Wallet connector pulls
    // in @coinbase/cdp-sdk, which in turn references optional x402 payment
    // packages we don't install (we only need standard injected/WalletConnect
    // wallets - MetaMask, Rainbow, Zerion). Aliasing these out avoids a
    // module-not-found build failure without disabling wallet connect itself.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@coinbase/cdp-sdk': false,
      '@base-org/account': false,
    };
    return config;
  },
};

module.exports = nextConfig;
