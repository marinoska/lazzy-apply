// Shared Zod schemas for validation across LazyApply

import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  created_at: z.string().datetime(),
});

export const jobApplicationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  job_title: z.string().min(1),
  company: z.string().min(1),
  status: z.enum(['pending', 'applied', 'rejected', 'interview']),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Add more shared schemas here
