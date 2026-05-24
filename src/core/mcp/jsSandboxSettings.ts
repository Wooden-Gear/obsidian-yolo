import type {
  JsSandboxSettings,
  YoloSettings,
} from '../../settings/schema/setting.types'

import {
  JS_SANDBOX_FETCH_DEFAULT_MAX_CONCURRENT,
  JS_SANDBOX_FETCH_DEFAULT_MAX_RESPONSE_KB,
  JS_SANDBOX_FETCH_HARD_MAX_CONCURRENT,
  JS_SANDBOX_VAULT_READ_DEFAULT_MAX_KB,
  resolveJsSandboxOutputMaxBytes,
} from './jsSandboxTool'

export const JS_SANDBOX_BASE_DESCRIPTION =
  'Execute JavaScript in an isolated classic Worker and return JSON. Each call uses a fresh Worker; re-import/recreate state inside the same call. Single expressions are auto-returned; multi-statement code needs an explicit return. All YOLO host APIs are async and MUST be awaited: $vault.*, $db.*, $fetch, $loadScript. No DOM/document/Image; use Worker APIs (Blob, Response, Request, OffscreenCanvas, createImageBitmap, etc.). crypto.subtle is undefined.' +
  ' Errors: every await can reject — do NOT swallow with `?? null` or empty `catch { return null }`. Let exceptions propagate so the host returns `{ error, stack }`. `$vault.readText/readBinary` return `null` only when the file truly does not exist; folder paths and read failures throw. `$db.search/find` return `[]` for no matches; throw when the vault has no index.' +
  ' Injected variables: $now (Date object), $isoDate ("YYYY-MM-DD" string), $note ({path:string,basename:string,frontmatter:Record}|null — null in Quick Ask or when no note is open), $content (string|null — full text of the active note), $selection (string|null — user\'s current text selection), $vault ({name:string, adapter:{basePath:string|null}}), $links (string[] — outgoing wiki-link targets from current note), $tags (string[] — tags from current note).' +
  ' $utils helpers — json: flatten(v), groupBy(items,key), countBy(items,key); text: markdownHeadings(md)->[{level,text,line}], tasks(md)->[{checked,status,text,indent,line}], wikilinks(md)->[{target,alias}]; stats: sum/mean/median/percentile(vals,p)/stdev(vals,sample?); matrix: identity(n)/multiply(a,b)/pow(m,exp); date: addDays(isoDate,days), diffDays(a,b), today().'

export type { JsSandboxSettings } from '../../settings/schema/setting.types'

/**
 * Single source of truth for the global JS sandbox configuration. Every
 * consumer (LLM-facing description, capability gate, proxy handler, approval
 * mode resolver) reads through this helper so the model's view of `js_eval`
 * cannot drift from what the host actually executes.
 */
export function getJsSandboxSettings(
  settings: Pick<YoloSettings, 'jsSandbox'> | null | undefined,
): JsSandboxSettings {
  return settings?.jsSandbox ?? {}
}

/**
 * Whether any extension capability (network / vault read / $db / external
 * scripts) is enabled. When true the host forces `require_approval` for
 * every agent that has `js_eval` enabled.
 */
export function hasAnyJsSandboxCapEnabled(s: JsSandboxSettings): boolean {
  return Boolean(
    s.allowFetch ||
      s.allowVaultRead ||
      s.allowDbQuery ||
      s.allowExternalScripts,
  )
}

/**
 * Build the LLM-facing description, conditionally listing the exact API
 * surface that's actually enabled. When no caps are on (the default), the
 * description explicitly says "no network, no vault read, no $db, no
 * external scripts" so the model doesn't waste tokens trying APIs that
 * don't exist. When caps are on, each one's precise signature is included.
 */
export function buildJsSandboxToolDescription(s: JsSandboxSettings): string {
  const enabled: string[] = []
  const disabled: string[] = []

  if (s.allowVaultRead) {
    const vaultCapKb =
      typeof s.vaultReadMaxKb === 'number' && s.vaultReadMaxKb > 0
        ? s.vaultReadMaxKb
        : JS_SANDBOX_VAULT_READ_DEFAULT_MAX_KB
    enabled.push(
      `await $vault.readText(path) -> string|null (text above ${vaultCapKb} KB is truncated); await $vault.readBinary(path) -> {base64,mimeType,byteLength}|null (files above ${vaultCapKb} KB are refused; for Blob: \`new Blob([Uint8Array.from(atob(base64), c=>c.charCodeAt(0))], {type:mimeType})\`)`,
    )
  } else {
    disabled.push('vault file reads')
  }

  if (s.allowFetch || s.allowExternalScripts) {
    const fetchCapKb =
      typeof s.fetchMaxResponseKb === 'number' && s.fetchMaxResponseKb > 0
        ? s.fetchMaxResponseKb
        : JS_SANDBOX_FETCH_DEFAULT_MAX_RESPONSE_KB
    const fetchMaxConcurrent =
      typeof s.fetchMaxConcurrent === 'number' &&
      Number.isFinite(s.fetchMaxConcurrent) &&
      s.fetchMaxConcurrent > 0
        ? Math.min(
            JS_SANDBOX_FETCH_HARD_MAX_CONCURRENT,
            Math.floor(s.fetchMaxConcurrent),
          )
        : JS_SANDBOX_FETCH_DEFAULT_MAX_CONCURRENT
    enabled.push(
      `Network: fetch/XMLHttpRequest/WebSocket are browser-native and still obey CORS/CSP. For cross-origin reads use await $fetch(url,{method?,headers?,body?,contentType?}) -> Response; it uses Obsidian host networking, buffers the response, is capped at ${fetchCapKb} KB, and allows at most ${fetchMaxConcurrent} concurrent $fetch calls per execution (excess calls throw)`,
    )
  } else {
    disabled.push('browser fetch / XHR / WebSocket and $fetch')
  }

  if (s.allowDbQuery) {
    const dbLimit =
      typeof s.dbQueryMaxLimit === 'number' &&
      Number.isFinite(s.dbQueryMaxLimit) &&
      s.dbQueryMaxLimit > 0
        ? Math.min(100, Math.floor(s.dbQueryMaxLimit))
        : 20
    enabled.push(
      `Text index only. await $db.search(query, limit?) -> [{path,content,similarity,...}] (semantic/vector search; \`content\` is the matched chunk excerpt, not the full file; requires vault index; up to ${dbLimit} results). await $db.find(keyword, limit?) -> [{path,excerpt}] (full-text keyword search; up to ${dbLimit} results). await $db.get(path) -> {content,frontmatter}|null. Do not use $db for images/PDF/audio/binary; use await $vault.readBinary(path) when vault read is enabled`,
    )
  } else {
    disabled.push('$db')
  }

  if (s.allowExternalScripts) {
    enabled.push(
      'External scripts: `importScripts(url, ...)` loads AND executes remote classic scripts into the worker — synchronous (no await), registers globals (e.g. `Tesseract`, `tf`). `$loadScript(url)` only FETCHES source text; use it for inspection or patching, NOT to load libraries. Worker/SharedWorker unblocked. Network implicitly enabled',
    )
  } else {
    disabled.push('external scripts, importScripts, nested Worker')
  }

  const enabledLine =
    enabled.length > 0 ? ` Capabilities enabled: ${enabled.join('; ')}.` : ''
  const disabledLine =
    disabled.length > 0
      ? ` NOT available (do not call): ${disabled.join(', ')}.`
      : ''

  // When both $vault and $db are on, the model needs picker logic — otherwise
  // it tends to default to $db (lossy excerpts) even for tasks that demand
  // exact bytes (path-keyed reads, line-aligned diffs, missing-file checks,
  // exhaustive scans over a known date/path set).
  const vaultVsDbLine =
    s.allowVaultRead && s.allowDbQuery
      ? ' $vault vs $db: use $vault.readText(path) for exact bytes at known paths (raw text, missing-file checks, exhaustive scans); use $db.find/$db.search to discover files by keyword/similarity. Compose: $db locates, $vault reads.'
      : ''

  const outputCapBytes = resolveJsSandboxOutputMaxBytes(s.outputMaxKb)
  const outputCapKb = Math.floor(outputCapBytes / 1024)
  const returnLine = ` Output is JSON and truncated above ~${outputCapKb} KB; return aggregates + small samples, not raw collected data.`

  return `${JS_SANDBOX_BASE_DESCRIPTION}${enabledLine}${disabledLine}${vaultVsDbLine}${returnLine}`
}
