import { TextAreaComponent } from 'obsidian'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { useObsidianSetting } from './ObsidianSetting'

type ObsidianTextAreaProps = {
  value: string
  placeholder?: string
  onChange: (value: string) => void
  style?: CSSProperties
}

export function ObsidianTextArea({
  value,
  placeholder,
  onChange,
  style,
}: ObsidianTextAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { setting } = useObsidianSetting()
  const [textAreaComponent, setTextAreaComponent] =
    useState<TextAreaComponent | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    if (setting) {
      let newTextAreaComponent: TextAreaComponent | null = null
      setting.addTextArea((component) => {
        newTextAreaComponent = component
      })
      setTextAreaComponent(newTextAreaComponent)

      return () => {
        newTextAreaComponent?.inputEl.remove()
      }
    } else if (containerRef.current) {
      const newTextAreaComponent = new TextAreaComponent(containerRef.current)
      setTextAreaComponent(newTextAreaComponent)

      return () => {
        newTextAreaComponent?.inputEl.remove()
      }
    }
  }, [setting])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!textAreaComponent) return
    textAreaComponent.onChange((v) => onChangeRef.current(v))
  }, [textAreaComponent])

  useEffect(() => {
    if (!textAreaComponent) return
    if (placeholder) textAreaComponent.setPlaceholder(placeholder)
    textAreaComponent.setValue(value)
  }, [textAreaComponent, value, placeholder])

  // Apply inline styles to the underlying textarea element if provided
  useEffect(() => {
    if (!textAreaComponent) return
    if (style) Object.assign(textAreaComponent.inputEl.style, style as any)
  }, [textAreaComponent, style])

  return <div ref={containerRef} style={{ width: '100%' }} />
}
