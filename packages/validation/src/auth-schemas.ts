import { z } from 'zod';

const evmAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid EVM-style address (0x + 40 hex chars)');

export const requestNonceSchema = z.object({
  address: evmAddress,
});
export type RequestNonceInput = z.infer<typeof requestNonceSchema>;

export const verifySignInSchema = z.object({
  address: evmAddress,
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Signature must be 0x-prefixed hex'),
  nonce: z.string().min(1),
  issuedAt: z.string().datetime(),
});
export type VerifySignInInput = z.infer<typeof verifySignInSchema>;
