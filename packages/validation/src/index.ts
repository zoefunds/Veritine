// Shared request-validation schemas used by both the frontend forms
// (client-side UX validation only - never treated as proof of anything)
// and the backend API (authoritative validation before any contract
// interaction is prepared).

import { z } from 'zod';

/** A positive integer amount expressed as a decimal string (u256-safe: no floats). */
const weiAmount = z
  .string()
  .regex(/^[1-9][0-9]*$/, 'Amount must be a positive integer string (no decimals)');

export const createDisputeSchema = z.object({
  question: z
    .string()
    .min(10, 'Question must be at least 10 characters')
    .max(300, 'Question must be at most 300 characters'),
  description: z.string().max(5000).optional().default(''),
  category: z.enum([
    'CLIMATE',
    'GOVERNANCE',
    'TECH',
    'MEDIA',
    'FINANCE',
    'PUBLIC_HEALTH',
    'OTHER',
  ]),
  positionLabels: z
    .array(z.string().min(1).max(120))
    .min(2, 'A dispute needs at least two competing positions')
    .max(6, 'A dispute may have at most six competing positions'),
  participationDeadline: z.string().datetime(),
  evidenceDeadline: z.string().datetime(),
  minPositionStakeWei: weiAmount,
  minEvidenceStakeWei: weiAmount,
});

export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;

export const submitEvidenceSchema = z.object({
  disputeId: z.string().uuid(),
  positionId: z.string().uuid(),
  sourceUrl: z.string().url('Source URL must be a valid, well-formed URL'),
  sourceTitle: z.string().min(3).max(300),
  publisher: z.string().min(1).max(200),
  publicationDate: z.string().datetime().optional(),
  summary: z
    .string()
    .min(20, 'Summary must be at least 20 characters')
    .max(2000, 'Summary must be at most 2000 characters'),
  stakeWei: weiAmount,
});

export type SubmitEvidenceInput = z.infer<typeof submitEvidenceSchema>;

export const stakePositionSchema = z.object({
  disputeId: z.string().uuid(),
  positionId: z.string().uuid(),
  stakeWei: weiAmount,
});

export type StakePositionInput = z.infer<typeof stakePositionSchema>;
