import { z } from 'zod'

// Assistant icon type definition
export const assistantIconSchema = z.object({
  type: z.enum(['lucide', 'emoji']),
  value: z.string(),
})

export type AssistantIcon = z.infer<typeof assistantIconSchema>

export const agentPersonaSchema = z.enum(['balanced', 'precise', 'creative'])

export type AgentPersona = z.infer<typeof agentPersonaSchema>

export const assistantSkillLoadModeSchema = z.enum(['always', 'lazy'])
export type AssistantSkillLoadMode = z.infer<
  typeof assistantSkillLoadModeSchema
>

export const assistantSkillPreferenceSchema = z.object({
  enabled: z.boolean().optional(),
  loadMode: assistantSkillLoadModeSchema.optional(),
})

export type AssistantSkillPreference = z.infer<
  typeof assistantSkillPreferenceSchema
>

export const assistantToolApprovalModeSchema = z.enum([
  'full_access',
  'require_approval',
])

export type AssistantToolApprovalMode = z.infer<
  typeof assistantToolApprovalModeSchema
>

export const assistantToolDisclosureModeSchema = z.enum(['always', 'on_demand'])

export type AssistantToolDisclosureMode = z.infer<
  typeof assistantToolDisclosureModeSchema
>

export const assistantToolPreferenceSchema = z.object({
  enabled: z.boolean().optional(),
  approvalMode: assistantToolApprovalModeSchema.optional(),
  disclosureMode: assistantToolDisclosureModeSchema.optional(),
})

export type AssistantToolPreference = z.infer<
  typeof assistantToolPreferenceSchema
>

export const assistantWorkspaceScopeSchema = z.object({
  enabled: z.boolean().default(false),
  include: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
})

export type AssistantWorkspaceScope = z.infer<
  typeof assistantWorkspaceScopeSchema
>

export const assistantJsSandboxConfigSchema = z.object({
  allowDbQuery: z.boolean().optional(),
  allowFetch: z.boolean().optional(),
  fetchMode: z.enum(['whitelist', 'blacklist']).optional(),
  fetchDomains: z.array(z.string()).optional(),
  fetchMaxConcurrent: z.number().optional(),
  fetchMaxResponseKb: z.number().optional(),
  allowVaultRead: z.boolean().optional(),
  // Maximum size (in KB) returned by $vault.readText / $vault.readBinary.
  // Files exceeding this are truncated (text) or refused (binary). Range
  // mirrors fetchMaxResponseKb.
  vaultReadMaxKb: z.number().optional(),
  allowExternalScripts: z.boolean().optional(),
  // Per-agent execution timeout cap, in milliseconds. The LLM may pass a
  // smaller timeoutMs in its tool args, but the host clamps the effective
  // value to this cap. Undefined means use the built-in default.
  timeoutMs: z.number().optional(),
  // Maximum rows returned by $db.search / $db.find. The LLM may request a
  // smaller limit per call but never larger. Undefined falls back to a
  // built-in default.
  dbQueryMaxLimit: z.number().optional(),
  // Maximum size (in KB) of the tool's serialized JSON result returned to
  // the model. Output above this is truncated with a prefix. Undefined uses
  // the built-in default. Host enforces a hard ceiling.
  outputMaxKb: z.number().optional(),
})

export type AssistantJsSandboxConfig = z.infer<
  typeof assistantJsSandboxConfigSchema
>

// Assistant type definition
export const assistantSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name cannot be empty'),
  description: z.string().optional(),
  systemPrompt: z.string().default(''),
  icon: assistantIconSchema.optional(),
  persona: agentPersonaSchema.optional(),
  modelId: z.string().optional(),
  enableTools: z.boolean().optional(),
  includeBuiltinTools: z.boolean().optional(),
  enabledToolNames: z.array(z.string()).optional(),
  toolPreferences: z
    .record(z.string(), assistantToolPreferenceSchema)
    .optional(),
  enabledSkills: z.array(z.string()).optional(),
  skillPreferences: z
    .record(z.string(), assistantSkillPreferenceSchema)
    .optional(),
  workspaceScope: assistantWorkspaceScopeSchema.optional(),
  jsSandboxConfig: assistantJsSandboxConfigSchema.optional(),
  enableProjectInstructions: z.boolean().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
})

export type Assistant = z.infer<typeof assistantSchema>
