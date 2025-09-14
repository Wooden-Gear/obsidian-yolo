export type ConversationOverrideSettings = {
  temperature?: number | null
  top_p?: number | null
  maxContextMessages?: number | null
  stream?: boolean | null
  useVaultSearch?: boolean | null
  useWebSearch?: boolean | null
  useUrlContext?: boolean | null
}
