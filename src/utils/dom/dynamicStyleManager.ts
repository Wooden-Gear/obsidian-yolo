type StyleRecord = Record<string, string | number | undefined>

const STYLE_ELEMENT_ID = 'smtcmp-dynamic-style-rules'

let cachedSheet: CSSStyleSheet | null = null
let elementCounter = 0

type ElementState = {
  key: string
  className: string
  uid: string
}

const elementState = new WeakMap<HTMLElement, ElementState>()

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

function normalizeStyles(styles: StyleRecord) {
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
}

export function updateDynamicStyleClass(
  element: HTMLElement,
  prefix: string,
  styles: StyleRecord,
): void {
  const sheet = ensureStyleSheet()
  const previous = elementState.get(element)
  const normalized = normalizeStyles(styles)

  if (!normalized.key || !normalized.declarations) {
    if (sheet && previous) {
      removeRule(sheet, previous.className)
    }
    if (previous) {
      element.classList.remove(previous.className)
      elementState.delete(element)
    }
    return
  }

  if (!sheet) {
    return
  }

  let state = previous
  if (!state) {
    elementCounter += 1
    const uid = elementCounter.toString(36)
    state = { key: '', className: '', uid }
  }

  const nextClass = `${prefix}-${state.uid}-${hashString(normalized.key)}`

  if (state.key !== normalized.key || state.className !== nextClass) {
    if (state.className) {
      element.classList.remove(state.className)
      removeRule(sheet, state.className)
    }
    try {
      sheet.insertRule(
        `.${nextClass} { ${normalized.declarations} }`,
        sheet.cssRules.length,
      )
    } catch {
      // ignore insert errors (e.g., invalid CSS values)
    }
    element.classList.add(nextClass)
    elementState.set(element, {
      key: normalized.key,
      className: nextClass,
      uid: state.uid,
    })
  }
}

export function clearDynamicStyleClass(element: HTMLElement): void {
  const sheet = cachedSheet
  const state = elementState.get(element)
  if (!state) return
  if (sheet) removeRule(sheet, state.className)
  element.classList.remove(state.className)
  elementState.delete(element)
}

