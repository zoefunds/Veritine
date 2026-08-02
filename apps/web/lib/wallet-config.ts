'use client';

import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { buildGenLayerChain } from './genlayer-chain';

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
if (!projectId) {
  throw new Error('NEXT_PUBLIC_REOWN_PROJECT_ID is required to initialize wallet connect');
}

// Falls back to a placeholder chain id (0) until NEXT_PUBLIC_GENLAYER_CHAIN_ID
// is set post-deployment - the app still renders, but write transactions
// should be gated on a real chain id being configured.
const chainIdDecimal = process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID
  ? Number(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID)
  : 0;
// Placeholder public RPC endpoint until the deployed contract's exact
// StudioNet RPC URL is confirmed post-deployment; writes go through the
// wallet provider regardless, this is only used for read fallback.
const genLayerStudioNet = buildGenLayerChain(chainIdDecimal || 61999, 'https://studio.genlayer.com/api');

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [genLayerStudioNet],
});

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [genLayerStudioNet],
  projectId,
  metadata: {
    name: 'Veritine',
    description: 'A Staked Knowledge War - evidence-staking disputes adjudicated by GenLayer.',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://veritine.app',
    icons: ['/logo.svg'],
  },
  features: {
    analytics: false,
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
