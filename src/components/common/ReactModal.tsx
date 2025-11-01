import { App, Modal } from 'obsidian'
import React from 'react'
import { Root, createRoot } from 'react-dom/client'

import { LanguageProvider } from '../../contexts/language-context'
import { PluginProvider } from '../../contexts/plugin-context'

type ModalProps<T> = {
  app: App
  Component: React.ComponentType<T>
  props: Omit<T, 'onClose'>
  options?: { title?: string }
  plugin?: any // Add plugin prop for context providers
}

export class ReactModal<T> extends Modal {
  private root: Root | null = null
  private Component: React.ComponentType<T>
  private props: Omit<T, 'onClose'>
  private options?: { title?: string }
  private plugin?: any

  constructor({ app, Component, props, options, plugin }: ModalProps<T>) {
    super(app)
    this.Component = Component
    this.props = props
    this.options = options
    this.plugin = plugin
  }

  onOpen() {
    if (this.options?.title) this.titleEl.setText(this.options.title)
    this.root = createRoot(this.contentEl)

    const ComponentWithContext = () =>
      this.plugin ? (
        <PluginProvider plugin={this.plugin}>
          <LanguageProvider>
            <this.Component
              {...(this.props as T)}
              onClose={() => this.close()}
            />
          </LanguageProvider>
        </PluginProvider>
      ) : (
        <this.Component {...(this.props as T)} onClose={() => this.close()} />
      )

    this.root.render(<ComponentWithContext />)
  }

  onClose() {
    if (this.root) {
      this.root.unmount()
      this.root = null
    }
    this.contentEl.empty()
  }
}
