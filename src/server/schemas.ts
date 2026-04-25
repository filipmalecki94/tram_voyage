import { z } from 'zod';
import type { Result } from '@/shared/socket-events';

export const roomCreateSchema = z.object({
  nick: z.string().min(1).max(30),
});

export const roomJoinSchema = z.object({
  code: z.string().length(6),
  nick: z.string().min(1).max(30),
});

export const roomRejoinSchema = z.object({
  token: z.string().uuid(),
});

export const tableSubscribeSchema = z.object({
  code: z.string().length(6),
});

export const collectingGuessSchema = z.object({
  answer: z.union([
    z.literal('black'),
    z.literal('red'),
    z.literal('higher'),
    z.literal('lower'),
    z.literal('inside'),
    z.literal('outside'),
    z.literal('spades'),
    z.literal('clubs'),
    z.literal('diamonds'),
    z.literal('hearts'),
  ]),
});

export const pyramidAssignSchema = z.object({
  toPlayerId: z.string().min(1),
  sips: z.number().int().min(1).max(20),
});

export const pyramidNextSchema = z.object({}).strict();

export const tramGuessSchema = z.object({
  answer: z.union([
    z.literal('higher'),
    z.literal('lower'),
    z.literal('reference'),
  ]),
});

export const confirmDrinkSchema = z.object({}).strict();

export const collectingConfirmSchema = z.object({}).strict();

export const roomReorderPlayersSchema = z.object({
  playerIds: z.array(z.string()).min(2).max(12),
});

export const roomKickPlayerSchema = z.object({
  targetPlayerId: z.string().min(1),
});

export function validate<T>(
  schema: z.ZodSchema<T>,
  payload: unknown,
  cb: (res: { ok: false; error: string }) => void,
): T | null {
  const result = schema.safeParse(payload);
  if (!result.success) {
    cb({ ok: false, error: 'invalid_payload' });
    return null;
  }
  return result.data;
}
