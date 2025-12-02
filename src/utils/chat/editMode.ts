/**
 * Edit mode for Quick Ask - generates SEARCH/REPLACE blocks for document editing.
 */

import { TFile } from 'obsidian'

import { BaseLLMProvider } from '../../core/llm/base'
import { ChatModel } from '../../types/chat-model.types'
import { RequestMessage } from '../../types/llm/request'
import { LLMProvider } from '../../types/provider.types'

const EDIT_MODE_SYSTEM_PROMPT = `You are an intelligent document editor. Your task is to modify a markdown document based on user instructions.

**Output Format:**
Use SEARCH/REPLACE blocks to specify changes. Each block has this exact format:

<<<<<<< SEARCH
[exact text to find in the document]
=======
[new text to replace it with]
>>>>>>> REPLACE

**Critical Rules:**
1. The SEARCH section must contain EXACT text from the document, including all whitespace, line breaks, and punctuation
2. You can use multiple SEARCH/REPLACE blocks for multiple changes
3. Output ONLY SEARCH/REPLACE blocks, no explanations or other text
4. If deleting content, leave the REPLACE section empty (but keep the markers)
5. Keep changes minimal - only modify what's necessary to fulfill the instruction
6. For each change, include enough surrounding context in SEARCH to ensure unique matching
7. Process changes in document order (top to bottom)

**Example:**
To change "Hello world" to "Hello universe":

<<<<<<< SEARCH
Hello world
=======
Hello universe
>>>>>>> REPLACE`

/**
 * Generate edit content using SEARCH/REPLACE format.
 *
 * @param params - Parameters for generating edit content
 * @returns The raw model response containing SEARCH/REPLACE blocks
 */
export async function generateEditContent({
  instruction,
  currentFile,
  currentFileContent,
  providerClient,
  model,
}: {
  instruction: string
  currentFile: TFile
  currentFileContent: string
  providerClient: BaseLLMProvider<LLMProvider>
  model: ChatModel
}): Promise<string> {
  const isBaseModel = Boolean(model.isBaseModel)
  const requestMessages: RequestMessage[] = []

  if (!isBaseModel) {
    requestMessages.push({
      role: 'system',
      content: EDIT_MODE_SYSTEM_PROMPT,
    })
  }

  const userPrompt = generateEditPrompt(
    instruction,
    currentFile,
    currentFileContent,
  )

  requestMessages.push({
    role: 'user',
    content: userPrompt,
  })

  const response = await providerClient.generateResponse(model, {
    model: model.model,
    messages: requestMessages,
    stream: false,
  })

  return response.choices[0].message.content ?? ''
}

/**
 * Generate the user prompt for edit mode.
 */
function generateEditPrompt(
  instruction: string,
  currentFile: TFile,
  currentFileContent: string,
): string {
  return `# Document to Edit

**File:** ${currentFile.path}

**Content:**
\`\`\`markdown
${currentFileContent}
\`\`\`

# Instruction

${instruction}

# Your Task

Output SEARCH/REPLACE blocks to apply the requested changes. Remember:
- Match text EXACTLY as it appears in the document
- Include enough context for unique matching
- Output only SEARCH/REPLACE blocks, no explanations`
}
