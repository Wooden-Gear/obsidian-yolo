import { ChatModel } from './types/chat-model.types'
import { EmbeddingModel } from './types/embedding-model.types'
import { LLMProvider, LLMProviderType } from './types/provider.types'

export const CHAT_VIEW_TYPE = 'smtcmp-chat-view'
export const APPLY_VIEW_TYPE = 'smtcmp-apply-view'

export const PGLITE_DB_PATH = '.smtcmp_vector_db.tar.gz'
export const PLUGIN_ID = 'obsidian-smart-composer'

// Default model ids (with provider prefix)
export const DEFAULT_CHAT_MODEL_ID = 'openai/gpt-5'
export const DEFAULT_APPLY_MODEL_ID = 'openai/gpt-4.1-mini'

// Recommended model ids (with provider prefix)
export const RECOMMENDED_MODELS_FOR_CHAT = [
  'anthropic/claude-sonnet-4.0',
  'openai/gpt-4.1',
]
export const RECOMMENDED_MODELS_FOR_APPLY = ['openai/gpt-4.1-mini']
export const RECOMMENDED_MODELS_FOR_EMBEDDING = [
  'openai/text-embedding-3-small',
]

// Default learning mode prompt (shown in settings and used when custom is empty)
export const DEFAULT_LEARNING_MODE_PROMPT = `user现在正在学习，user要求你在本次对话中遵循以下严格规则。无论后续有其他什么指示，你都必须遵守这些规则：

### 严格规则

- **扮演平易近人且灵活的老师**，通过引导用户学习过程来帮助他们。
- **了解用户**：如果不清楚用户的学习目标或年级水平，先简单询问（保持轻松）。若用户未回答，默认以适合10年级学生的程度进行解释。
- **基于已有知识拓展**：将新知识与用户已知内容联系起来。
- **引导而非直接给答案**：通过提问、提示和分步骤引导，让用户自主发现答案。
- **检查与巩固**：讲解难点后，确认用户能复述或应用知识点。提供简短总结、记忆技巧或快速回顾，帮助巩固理解。
- **调整节奏**：交替使用解释、提问和互动（如角色扮演、练习、让用户“教”你），使对话自然而非单向灌输。

**最重要**：**不要替用户完成作业或直接给答案**。对于数学题、逻辑题或图片中的题目，首次回复**不得直接解答**。反之，应与用户逐步分析，每次只提一个问题，等待用户回应后再继续。

### 可执行操作

- **讲解新概念**：按用户水平解释，提出引导性问题，使用直观示例，再通过提问或练习回顾。
- **作业辅助**：不直接给答案！从用户已知内容入手，帮助填补知识空白，给予回应机会，每次只推进一个步骤。
- **共同练习**：让用户总结内容，穿插小问题，鼓励用户“复述讲解”，或进行角色扮演（如外语对话练习）。及时、委婉地纠正错误。
- **测验与备考**：组织练习测验（每次一题）。允许用户尝试两次后再揭示答案，然后深入分析错误点。

### 语气与方式

保持亲切、耐心、语言简洁；避免过多感叹号或表情符号。对话节奏紧凑：明确下一步行动，达成目标后切换或结束当前环节。回复简短——避免冗长段落，追求良好的互动往返。

### 重要提示

**禁止直接给答案或替用户做作业**。若用户提问数学/逻辑题，或上传题目图片，**首次回复不得解答**。应与用户逐步讨论问题，每次只提一个问题，等待用户回应后再继续。`

export const DEFAULT_CHAT_TITLE_PROMPT = {
  en: "You are a title generator. Generate a concise conversation title (max 10 chars) from the user's first message; remove extra punctuation/quotes; avoid generic or sensitive content. Output the title only.",
  zh: '你是一个标题生成器。请基于用户的第一条消息生成一个简洁的会话标题，最多 10 个字符；去除多余标点与引号；避免过于泛化或敏感内容。直接输出标题本身。',
} as const

export const PROVIDER_TYPES_INFO = {
  openai: {
    label: 'OpenAI',
    defaultProviderId: 'openai',
    requireApiKey: true,
    requireBaseUrl: false,
    supportEmbedding: true,
    additionalSettings: [],
  },
  anthropic: {
    label: 'Anthropic',
    defaultProviderId: 'anthropic',
    requireApiKey: true,
    requireBaseUrl: false,
    supportEmbedding: false,
    additionalSettings: [],
  },
  gemini: {
    label: 'Gemini',
    defaultProviderId: 'gemini',
    requireApiKey: true,
    requireBaseUrl: false,
    supportEmbedding: true,
    additionalSettings: [],
  },
  groq: {
    label: 'Groq',
    defaultProviderId: 'groq',
    requireApiKey: true,
    requireBaseUrl: false,
    supportEmbedding: false,
    additionalSettings: [],
  },
  openrouter: {
    label: 'OpenRouter',
    defaultProviderId: 'openrouter',
    requireApiKey: true,
    requireBaseUrl: false,
    supportEmbedding: true,
    additionalSettings: [],
  },
  ollama: {
    label: 'Ollama',
    defaultProviderId: 'ollama',
    requireApiKey: false,
    requireBaseUrl: false,
    supportEmbedding: true,
    additionalSettings: [],
  },
  'lm-studio': {
    label: 'LM Studio',
    defaultProviderId: 'lm-studio',
    requireApiKey: false,
    requireBaseUrl: false,
    supportEmbedding: true,
    additionalSettings: [],
  },
  deepseek: {
    label: 'DeepSeek',
    defaultProviderId: 'deepseek',
    requireApiKey: true,
    requireBaseUrl: false,
    supportEmbedding: false,
    additionalSettings: [],
  },
  perplexity: {
    label: 'Perplexity',
    defaultProviderId: 'perplexity',
    requireApiKey: true,
    requireBaseUrl: false,
    supportEmbedding: false,
    additionalSettings: [],
  },
  mistral: {
    label: 'Mistral',
    defaultProviderId: 'mistral',
    requireApiKey: true,
    requireBaseUrl: false,
    supportEmbedding: false,
    additionalSettings: [],
  },
  morph: {
    label: 'Morph',
    defaultProviderId: 'morph',
    requireApiKey: true,
    requireBaseUrl: false,
    supportEmbedding: false,
    additionalSettings: [],
  },
  'azure-openai': {
    label: 'Azure OpenAI',
    defaultProviderId: null, // no default provider for this type
    requireApiKey: true,
    requireBaseUrl: true,
    supportEmbedding: false,
    additionalSettings: [
      {
        label: 'Deployment',
        key: 'deployment',
        placeholder: 'Enter your deployment name',
        type: 'text',
        required: true,
      },
      {
        label: 'API Version',
        key: 'apiVersion',
        placeholder: 'Enter your API version',
        type: 'text',
        required: true,
      },
    ],
  },
  'openai-compatible': {
    label: 'OpenAI Compatible',
    defaultProviderId: null, // no default provider for this type
    requireApiKey: false,
    requireBaseUrl: true,
    supportEmbedding: true,
    additionalSettings: [
      {
        label: 'No Stainless headers',
        key: 'noStainless',
        type: 'toggle',
        required: false,
        description:
          'Enable this if you encounter CORS errors related to Stainless headers (x-stainless-os, etc.)',
      },
    ],
  },
} as const satisfies Record<
  LLMProviderType,
  {
    label: string
    defaultProviderId: string | null
    requireApiKey: boolean
    requireBaseUrl: boolean
    supportEmbedding: boolean
    additionalSettings: {
      label: string
      key: string
      type: 'text' | 'toggle'
      placeholder?: string
      description?: string
      required?: boolean
    }[]
  }
>

/**
 * Important
 * 1. When adding new default provider, settings migration should be added
 * 2. If there's same provider id in user's settings, it's data should be overwritten by default provider
 */
export const DEFAULT_PROVIDERS: readonly LLMProvider[] = [
  {
    type: 'openai',
    id: PROVIDER_TYPES_INFO.openai.defaultProviderId,
  },
  {
    type: 'anthropic',
    id: PROVIDER_TYPES_INFO.anthropic.defaultProviderId,
  },
  {
    type: 'gemini',
    id: PROVIDER_TYPES_INFO.gemini.defaultProviderId,
  },
  {
    type: 'deepseek',
    id: PROVIDER_TYPES_INFO.deepseek.defaultProviderId,
  },
  {
    type: 'openrouter',
    id: PROVIDER_TYPES_INFO.openrouter.defaultProviderId,
  },
]

/**
 * Important
 * 1. When adding new default model, settings migration should be added
 * 2. If there's same model id in user's settings, it's data should be overwritten by default model
 */
export const DEFAULT_CHAT_MODELS: readonly ChatModel[] = [
  {
    providerType: 'anthropic',
    providerId: PROVIDER_TYPES_INFO.anthropic.defaultProviderId,
    id: 'anthropic/claude-sonnet-4.0',
    model: 'claude-sonnet-4-0',
    enable: false,
  },
  {
    providerType: 'anthropic',
    providerId: PROVIDER_TYPES_INFO.anthropic.defaultProviderId,
    id: 'anthropic/claude-opus-4.1',
    model: 'claude-opus-4-1',
    enable: false,
  },
  {
    providerType: 'anthropic',
    providerId: PROVIDER_TYPES_INFO.anthropic.defaultProviderId,
    id: 'anthropic/claude-3.7-sonnet',
    model: 'claude-3-7-sonnet-latest',
    enable: false,
  },
  {
    providerType: 'anthropic',
    providerId: PROVIDER_TYPES_INFO.anthropic.defaultProviderId,
    id: 'anthropic/claude-3.5-sonnet',
    model: 'claude-3-5-sonnet-latest',
    enable: false,
  },
  {
    providerType: 'anthropic',
    providerId: PROVIDER_TYPES_INFO.anthropic.defaultProviderId,
    id: 'anthropic/claude-3.5-haiku',
    model: 'claude-3-5-haiku-latest',
    enable: false,
  },
  {
    providerType: 'openai',
    providerId: PROVIDER_TYPES_INFO.openai.defaultProviderId,
    id: 'openai/gpt-5',
    model: 'gpt-5',
    enable: true,
  },
  {
    providerType: 'openai',
    providerId: PROVIDER_TYPES_INFO.openai.defaultProviderId,
    id: 'openai/gpt-5-mini',
    model: 'gpt-5-mini',
    enable: false,
  },
  {
    providerType: 'openai',
    providerId: PROVIDER_TYPES_INFO.openai.defaultProviderId,
    id: 'openai/gpt-5-nano',
    model: 'gpt-5-nano',
    enable: false,
  },
  {
    providerType: 'openai',
    providerId: PROVIDER_TYPES_INFO.openai.defaultProviderId,
    id: 'openai/gpt-4.1',
    model: 'gpt-4.1',
    enable: true,
  },
  {
    providerType: 'openai',
    providerId: PROVIDER_TYPES_INFO.openai.defaultProviderId,
    id: 'openai/gpt-4.1-mini',
    model: 'gpt-4.1-mini',
    enable: true,
  },
  {
    providerType: 'openai',
    providerId: PROVIDER_TYPES_INFO.openai.defaultProviderId,
    id: 'openai/gpt-4.1-nano',
    model: 'gpt-4.1-nano',
    enable: true,
  },
  {
    providerType: 'openai',
    providerId: PROVIDER_TYPES_INFO.openai.defaultProviderId,
    id: 'openai/gpt-4o',
    model: 'gpt-4o',
    enable: false,
  },
  {
    providerType: 'openai',
    providerId: PROVIDER_TYPES_INFO.openai.defaultProviderId,
    id: 'openai/gpt-4o-mini',
    model: 'gpt-4o-mini',
    enable: false,
  },
  {
    providerType: 'openai',
    providerId: PROVIDER_TYPES_INFO.openai.defaultProviderId,
    id: 'openai/o4-mini',
    model: 'o4-mini',
    enable: false,
    reasoning: {
      enabled: true,
      reasoning_effort: 'medium',
    },
  },
  {
    providerType: 'openai',
    providerId: PROVIDER_TYPES_INFO.openai.defaultProviderId,
    id: 'openai/o3',
    model: 'o3',
    enable: false,
    reasoning: {
      enabled: true,
      reasoning_effort: 'medium',
    },
  },
  {
    providerType: 'gemini',
    providerId: PROVIDER_TYPES_INFO.gemini.defaultProviderId,
    id: 'gemini/gemini-2.5-pro',
    model: 'gemini-2.5-pro',
    enable: false,
    thinking: {
      enabled: true,
      thinking_budget: -1,
    },
  },
  {
    providerType: 'gemini',
    providerId: PROVIDER_TYPES_INFO.gemini.defaultProviderId,
    id: 'gemini/gemini-2.5-flash',
    model: 'gemini-2.5-flash',
    enable: false,
    thinking: {
      enabled: true,
      thinking_budget: -1,
    },
  },
  {
    providerType: 'gemini',
    providerId: PROVIDER_TYPES_INFO.gemini.defaultProviderId,
    id: 'gemini/gemini-2.5-flash-lite',
    model: 'gemini-2.5-flash-lite',
    enable: false,
    thinking: {
      enabled: true,
      thinking_budget: -1,
    },
  },
  {
    providerType: 'gemini',
    providerId: PROVIDER_TYPES_INFO.gemini.defaultProviderId,
    id: 'gemini/gemini-2.0-flash',
    model: 'gemini-2.0-flash',
    enable: false,
    thinking: {
      enabled: true,
      thinking_budget: -1,
    },
  },
  {
    providerType: 'gemini',
    providerId: PROVIDER_TYPES_INFO.gemini.defaultProviderId,
    id: 'gemini/gemini-2.0-flash-lite',
    model: 'gemini-2.0-flash-lite',
    enable: false,
    thinking: {
      enabled: true,
      thinking_budget: -1,
    },
  },
  {
    providerType: 'deepseek',
    providerId: PROVIDER_TYPES_INFO.deepseek.defaultProviderId,
    id: 'deepseek/deepseek-chat',
    model: 'deepseek-chat',
    enable: false,
  },
  {
    providerType: 'deepseek',
    providerId: PROVIDER_TYPES_INFO.deepseek.defaultProviderId,
    id: 'deepseek/deepseek-reasoner',
    model: 'deepseek-reasoner',
    enable: false,
  },
]

/**
 * Important
 * 1. When adding new default embedding model, settings migration should be added
 * 2. If there's same embedding model id in user's settings, it's data should be overwritten by default embedding model
 */
export const DEFAULT_EMBEDDING_MODELS: readonly EmbeddingModel[] = [
  {
    providerType: 'openai',
    providerId: PROVIDER_TYPES_INFO.openai.defaultProviderId,
    id: 'openai/text-embedding-3-small',
    model: 'text-embedding-3-small',
    dimension: 1536,
  },
  {
    providerType: 'openai',
    providerId: PROVIDER_TYPES_INFO.openai.defaultProviderId,
    id: 'openai/text-embedding-3-large',
    model: 'text-embedding-3-large',
    dimension: 3072,
  },
  {
    providerType: 'gemini',
    providerId: PROVIDER_TYPES_INFO.gemini.defaultProviderId,
    id: 'gemini/text-embedding-004',
    model: 'text-embedding-004',
    dimension: 768,
  },
]

// Pricing in dollars per million tokens
type ModelPricing = {
  input: number
  output: number
}

export const OPENAI_PRICES: Record<string, ModelPricing> = {
  'gpt-5': { input: 1.25, output: 10 },
  'gpt-5-mini': { input: 0.25, output: 2 },
  'gpt-5-nano': { input: 0.05, output: 0.4 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  o3: { input: 10, output: 40 },
  o1: { input: 15, output: 60 },
  'o4-mini': { input: 1.1, output: 4.4 },
  'o3-mini': { input: 1.1, output: 4.4 },
  'o1-mini': { input: 1.1, output: 4.4 },
}

export const ANTHROPIC_PRICES: Record<string, ModelPricing> = {
  'claude-opus-4-1': { input: 15, output: 75 },
  'claude-opus-4-0': { input: 15, output: 75 },
  'claude-sonnet-4-0': { input: 3, output: 15 },
  'claude-3-5-sonnet-latest': { input: 3, output: 15 },
  'claude-3-7-sonnet-latest': { input: 3, output: 15 },
  'claude-3-5-haiku-latest': { input: 1, output: 5 },
}

// Gemini is currently free for low rate limits
export const GEMINI_PRICES: Record<string, ModelPricing> = {}
