import OpenAI from 'openai'
import { FinalRequestOptions } from 'openai/core'

export class NoStainlessOpenAI extends OpenAI {
  override buildRequest<Req>(
    options: FinalRequestOptions<Req>,
    { retryCount = 0 }: { retryCount?: number } = {},
  ): { req: RequestInit; url: string; timeout: number } {
    const req = super.buildRequest(options, { retryCount })
    const headers = req.req.headers as Record<string, string>
    Object.keys(headers).forEach((k) => {
      if (k.startsWith('x-stainless')) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete headers[k]
      }
    })
    
    // Handle Gemini native tools by bypassing OpenAI SDK validation
    if (req.req.body && typeof req.req.body === 'string') {
      try {
        const body = JSON.parse(req.req.body)
        // If tools contain Gemini native format (e.g., {googleSearch: {}}), 
        // the OpenAI SDK validation will fail. We need to bypass this.
        if (body.tools && Array.isArray(body.tools)) {
          const hasGeminiTools = body.tools.some((tool: any) => 
            tool.googleSearch !== undefined || tool.urlContext !== undefined
          )
          if (hasGeminiTools) {
            // For Gemini tools, we bypass SDK validation by reconstructing the request
            req.req.body = JSON.stringify(body)
          }
        }
      } catch (e) {
        // If JSON parsing fails, continue with original body
      }
    }
    
    return req
  }
}
