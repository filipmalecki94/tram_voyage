import { z } from 'zod';
import type { Result } from '@/shared/socket-events';

export const roomCreateSchema = z.object({
  nick: z.string().min(1).max(20),
});

export const roomJoinSchema = z.object({
  code: z.string().length(6),
  nick: z.string().min(1).max(20),
});

export const roomRejoinSchema = z.object({
  token: z.string().uuid(),
});

export const tableSubscribeSchema = z.object({
  code: z.string().length(6),
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
