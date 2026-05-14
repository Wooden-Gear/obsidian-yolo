import amazonBedrockLogo from '../assets/provider-icons/amazon-bedrock.svg'
import anthropicLogo from '../assets/provider-icons/anthropic.svg'
import azureOpenaiLogo from '../assets/provider-icons/azure-openai.svg'
import deepseekLogo from '../assets/provider-icons/deepseek.svg'
import geminiLogo from '../assets/provider-icons/gemini.svg'
import groqLogo from '../assets/provider-icons/groq.svg'
import lmStudioLogo from '../assets/provider-icons/lm-studio.svg'
import mistralLogo from '../assets/provider-icons/mistral.svg'
import moonshotLogo from '../assets/provider-icons/moonshot.svg'
import morphLogo from '../assets/provider-icons/morph.svg'
import ollamaLogo from '../assets/provider-icons/ollama.svg'
import openaiLogo from '../assets/provider-icons/openai.svg'
import openrouterLogo from '../assets/provider-icons/openrouter.svg'
import perplexityLogo from '../assets/provider-icons/perplexity.svg'
import qwenLogo from '../assets/provider-icons/qwen.svg'
import { LLMProviderPresetType } from '../types/provider.types'

// Picker categories from the V1-grid design. `custom` is rendered as a
// dedicated last tile, not as part of any category list.
export type ProviderPickerCategory =
  | 'main'
  | 'cn'
  | 'gw'
  | 'cloud'
  | 'local'

export type ProviderTint =
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'rose'
  | 'amber'
  | 'orange'
  | 'teal'
  | 'green'
  | 'pink'
  | 'slate'
  | 'ink'

export type ProviderCatalogEntry = {
  /** Used when `logo` is undefined or the user prefers monogram mode. */
  monogram: string
  /** Drives the monogram tile colour AND the subtle ring on logo tiles. */
  tint: ProviderTint
  category: ProviderPickerCategory
  /** OAuth flow rather than API-key auth — surfaced as a badge. */
  oauth?: boolean
  /** Inlined brand logo (data-URL via esbuild). Falls back to monogram. */
  logo?: string
}

// Keyed by `LLMProviderPresetType`, minus `openai-compatible` which is rendered
// as the dedicated "custom" tile. Using `Record<Exclude<...>>` forces TS to
// surface any new preset that has not been catalogued here.
export const PROVIDER_CATALOG: Record<
  Exclude<LLMProviderPresetType, 'openai-compatible'>,
  ProviderCatalogEntry
> = {
  openai: {
    monogram: 'OA',
    tint: 'green',
    category: 'main',
    logo: openaiLogo,
  },
  'chatgpt-oauth': {
    monogram: 'GPT',
    tint: 'green',
    category: 'main',
    oauth: true,
    logo: openaiLogo,
  },
  anthropic: {
    monogram: 'An',
    tint: 'amber',
    category: 'main',
    logo: anthropicLogo,
  },
  gemini: {
    monogram: 'Ge',
    tint: 'teal',
    category: 'main',
    logo: geminiLogo,
  },
  'gemini-oauth': {
    monogram: 'Ge',
    tint: 'teal',
    category: 'main',
    oauth: true,
    logo: geminiLogo,
  },
  mistral: {
    monogram: 'Mi',
    tint: 'rose',
    category: 'main',
    logo: mistralLogo,
  },
  perplexity: {
    monogram: 'Px',
    tint: 'teal',
    category: 'main',
    logo: perplexityLogo,
  },
  groq: {
    monogram: 'Gq',
    tint: 'orange',
    category: 'main',
    logo: groqLogo,
  },
  morph: {
    monogram: 'Mo',
    tint: 'pink',
    category: 'main',
    logo: morphLogo,
  },
  deepseek: {
    monogram: '深度',
    tint: 'blue',
    category: 'cn',
    logo: deepseekLogo,
  },
  moonshot: {
    monogram: 'Ki',
    tint: 'purple',
    category: 'cn',
    logo: moonshotLogo,
  },
  'qwen-oauth': {
    monogram: '通义',
    tint: 'indigo',
    category: 'cn',
    oauth: true,
    logo: qwenLogo,
  },
  openrouter: {
    monogram: 'OR',
    tint: 'purple',
    category: 'gw',
    logo: openrouterLogo,
  },
  'azure-openai': {
    monogram: 'Az',
    tint: 'blue',
    category: 'cloud',
    logo: azureOpenaiLogo,
  },
  'amazon-bedrock': {
    monogram: 'Br',
    tint: 'amber',
    category: 'cloud',
    logo: amazonBedrockLogo,
  },
  ollama: {
    monogram: 'Ol',
    tint: 'slate',
    category: 'local',
    logo: ollamaLogo,
  },
  'lm-studio': {
    monogram: 'LM',
    tint: 'slate',
    category: 'local',
    logo: lmStudioLogo,
  },
}

// Sort order inside each category (and across the flat list when category=all).
// Matches the visual priority in the design (mainstream first, then CN, etc.).
const FLAT_ORDER: Exclude<LLMProviderPresetType, 'openai-compatible'>[] = [
  'openai',
  'chatgpt-oauth',
  'anthropic',
  'gemini',
  'gemini-oauth',
  'deepseek',
  'moonshot',
  'qwen-oauth',
  'mistral',
  'perplexity',
  'groq',
  'morph',
  'openrouter',
  'azure-openai',
  'amazon-bedrock',
  'ollama',
  'lm-studio',
]

export const PROVIDER_PICKER_ORDER = FLAT_ORDER

export const PROVIDER_PICKER_CATEGORIES: {
  id: 'all' | ProviderPickerCategory
  labelKey: string
  fallback: string
}[] = [
  { id: 'all', labelKey: 'categoryAll', fallback: 'All' },
  { id: 'main', labelKey: 'categoryMain', fallback: 'Mainstream' },
  { id: 'cn', labelKey: 'categoryCn', fallback: 'China' },
  { id: 'gw', labelKey: 'categoryGateway', fallback: 'Gateway' },
  { id: 'cloud', labelKey: 'categoryCloud', fallback: 'Cloud' },
  { id: 'local', labelKey: 'categoryLocal', fallback: 'Local' },
]
