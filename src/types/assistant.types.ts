import { z } from 'zod'

// Assistant type definition
export const assistantSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name cannot be empty'),
  description: z.string().optional(),
  systemPrompt: z.string().min(1, 'System prompt cannot be empty'),
  icon: z.string().optional(),
  // Per-assistant override: number of chat context messages to include (takes precedence over global setting)
  maxContextMessages: z.number().int().min(0).optional(),
})

export type Assistant = z.infer<typeof assistantSchema>
