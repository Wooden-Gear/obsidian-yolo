import { useEffect, useMemo, useRef, useState } from 'react'

type StyleRecord = Record<string, string | number | undefined>

const STYLE_ELEMENT_ID = 'smtcmp-dynamic-style-rules'

let cachedSheet: CSSStyleSheet | null = null
let instanceCounter = 0

function ensureStyleSheet(): CSSStyleSheet | null {
  if (typeof document === 'undefined') return null
  if (cachedSheet) return cachedSheet
  let styleEl = document.getElementById(STYLE_ELEMENT_ID) as
    | HTMLStyleElement
    | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = STYLE_ELEMENT_ID
    document.head.appendChild(styleEl)
  }
  cachedSheet = styleEl.sheet as CSSStyleSheet | null
  return cachedSheet
}

function hashString(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  if (hash === 0) return '0'
  return (hash < 0 ? `n${Math.abs(hash).toString(36)}` : hash.toString(36))
}

function toKebabCase(property: string): string {
  if (property.startsWith('--')) return property
  return property
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}

function removeRule(sheet: CSSStyleSheet, className: string) {
  const selector = `.${className}`
  for (let i = sheet.cssRules.length - 1; i >= 0; i -= 1) {
    const rule = sheet.cssRules[i]
    const isStyleRule =
      typeof CSSStyleRule !== 'undefined'
        ? rule instanceof CSSStyleRule
        : 'selectorText' in rule
    const maybeStyleRule = rule as CSSStyleRule
    if (
      isStyleRule &&
      typeof maybeStyleRule.selectorText === 'string' &&
      maybeStyleRule.selectorText.includes(selector)
    ) {
      sheet.deleteRule(i)
      break
    }
  }
}

export function useDynamicStyleClass(
  baseClassName: string,
  prefix: string,
  styles: StyleRecord,
): string {
  const [dynamicClass, setDynamicClass] = useState<string>('')
  const recordRef = useRef<{ className: string; key: string } | null>(null)
  const instanceIdRef = useRef<string>('')

  if (!instanceIdRef.current) {
    instanceCounter += 1
    instanceIdRef.current = instanceCounter.toString(36)
  }

  const normalized = useMemo(() => {
    const entries = Object.entries(styles)
      .filter(([, value]) => value !== undefined && value !== null)
      .sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0))

    if (entries.length === 0) {
      return { key: '', declarations: '' }
    }

    const declarations = entries
      .map(([property, value]) => {
        const propName = toKebabCase(property)
        const propValue =
          typeof value === 'number' ? `${value}px` : String(value)
        return `${propName}: ${propValue};`
      })
      .join(' ')

    const key = entries
      .map(([property, value]) => `${property}:${value}`)
      .join(';')

    return { key, declarations }
  }, [styles])

  useEffect(() => {
    const sheet = ensureStyleSheet()
    const previous = recordRef.current

    if (!normalized.key || !normalized.declarations) {
      if (sheet && previous) {
        removeRule(sheet, previous.className)
      }
      recordRef.current = null
      setDynamicClass('')
      return
    }

    if (!sheet) {
      // Environment without DOM (tests); fall back to base class only
      setDynamicClass('')
      return
    }

    const nextClass = `${prefix}-${instanceIdRef.current}-${hashString(normalized.key)}`

    if (previous?.key !== normalized.key) {
      if (previous) {
        removeRule(sheet, previous.className)
      }
      try {
        sheet.insertRule(
          `.${nextClass} { ${normalized.declarations} }`,
          sheet.cssRules.length,
        )
      } catch {
        // ignore insertRule failures
      }
      recordRef.current = { className: nextClass, key: normalized.key }
    } else if (previous.className !== nextClass) {
      // Key unchanged but hashed class differs (hash collision unlikely). Reinstate rule.
      removeRule(sheet, previous.className)
      try {
        sheet.insertRule(
          `.${nextClass} { ${normalized.declarations} }`,
          sheet.cssRules.length,
        )
      } catch {
        // ignore insertRule failures
      }
      recordRef.current = { className: nextClass, key: normalized.key }
    }

    setDynamicClass(nextClass)

    return () => {
      if (!recordRef.current || !sheet) return
      removeRule(sheet, recordRef.current.className)
      recordRef.current = null
    }
  }, [normalized, prefix])

  if (dynamicClass) {
    return `${baseClassName} ${dynamicClass}`.trim()
  }

  return baseClassName
}
