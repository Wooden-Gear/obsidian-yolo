import type { RequestMessage } from '../../../types/llm/request'

import type { DeferredToolCatalogInjection } from './types'

export function renderDeferredToolCatalogInjection(
  injection: DeferredToolCatalogInjection,
): RequestMessage | null {
  if (injection.tools.length === 0) {
    return null
  }

  const lines = injection.tools.map((tool) => {
    const approval =
      tool.approvalMode === 'full_access' ? 'full_access' : 'require_approval'
    return `- ${tool.name} | source: ${tool.source} | approval: ${approval} | ${tool.description}`
  })

  return {
    role: 'user',
    content: `<available-on-demand-tools>
The following enabled tools are available on demand. Their full schemas are not registered yet, so do not call them directly. To use one, first call yolo_local__tool_search with query "select:<tool_name>" or a keyword query. After tool_search returns the contract, retry with the loaded tool.

${lines.join('\n')}
</available-on-demand-tools>`,
  }
}
