jest.mock('react', () => {
  const actual = jest.requireActual('react')
  return {
    ...actual,
    useLayoutEffect: actual.useEffect,
  }
})

jest.mock('../../contexts/app-context', () => ({
  useApp: () => ({}),
}))

jest.mock('../../contexts/settings-context', () => ({
  useSettings: () => ({ settings: {} }),
}))

jest.mock('../../database/json/chat/timelineHeightCacheStore', () => ({
  flushPersistedTimelineHeightCache: jest.fn(),
  hydratePersistedTimelineHeightCache: jest.fn().mockResolvedValue(undefined),
  schedulePersistedTimelineHeightCacheFlush: jest.fn(),
}))

// Mock react-virtuoso so we can assert that the Footer component is rendered
// in the virtualized branch without depending on real DOM layout / measurement.
jest.mock('react-virtuoso', () => {
  const React = jest.requireActual('react')
  type MockProps = {
    data?: unknown[]
    itemContent?: (index: number, item: unknown) => React.ReactNode
    components?: { Footer?: React.ComponentType<{ context?: unknown }> }
    context?: unknown
    className?: string
    style?: React.CSSProperties
  }
  return {
    __esModule: true,
    Virtuoso: (props: MockProps) => {
      const Footer = props.components?.Footer
      return React.createElement(
        'div',
        {
          'data-testid': 'mock-virtuoso',
          className: props.className,
          style: props.style,
        },
        ...(props.data ?? []).map((item, index) =>
          React.createElement(
            React.Fragment,
            { key: index },
            props.itemContent?.(index, item) ?? null,
          ),
        ),
        Footer
          ? React.createElement(Footer, {
              context: props.context,
              key: '__footer',
            })
          : null,
      )
    },
  }
})

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { ChatTimelineItem } from '../../types/chat-timeline'

import { ChatTimelineList } from './ChatTimelineList'

function makeUserItem(id: string): ChatTimelineItem {
  return {
    kind: 'user-message',
    id,
    renderKey: id,
    estimatedHeight: 80,
    message: {
      role: 'user',
      id,
      content: {},
      mentionables: [],
      reasoningLevel: 'none',
      timestamp: 0,
    },
  } as unknown as ChatTimelineItem
}

function renderList(props: {
  items: ChatTimelineItem[]
  bottomSpacerHeight?: number
  virtualizationThreshold?: number
}) {
  const ref = { current: null } as React.RefObject<HTMLElement>
  return renderToStaticMarkup(
    <ChatTimelineList
      items={props.items}
      scrollContainerRef={ref}
      virtualizationThreshold={props.virtualizationThreshold}
      bottomSpacerHeight={props.bottomSpacerHeight}
      renderItem={(item) => (
        <div data-testid="row" data-key={item.renderKey}>
          {item.renderKey}
        </div>
      )}
    />,
  )
}

describe('ChatTimelineList bottomSpacerHeight', () => {
  it('renders a spacer div at the tail of the non-virtualized branch', () => {
    const html = renderList({
      items: [makeUserItem('a'), makeUserItem('b')],
      bottomSpacerHeight: 120,
      virtualizationThreshold: 50, // force non-virtualized
    })

    expect(html).toContain('yolo-chat-timeline-bottom-spacer')
    expect(html).toContain('height:120px')
    // Spacer should come after the last item.
    const spacerIndex = html.indexOf('yolo-chat-timeline-bottom-spacer')
    const lastRowIndex = html.lastIndexOf('data-key="b"')
    expect(spacerIndex).toBeGreaterThan(lastRowIndex)
  })

  it('omits the spacer when height is 0 in the non-virtualized branch', () => {
    const html = renderList({
      items: [makeUserItem('a')],
      bottomSpacerHeight: 0,
      virtualizationThreshold: 50,
    })

    expect(html).not.toContain('yolo-chat-timeline-bottom-spacer')
  })

  it('renders the Footer spacer in the virtualized branch', () => {
    const items = Array.from({ length: 60 }, (_, i) => makeUserItem(`m-${i}`))
    const html = renderList({
      items,
      bottomSpacerHeight: 88,
      virtualizationThreshold: 24,
    })

    expect(html).toContain('mock-virtuoso')
    expect(html).toContain('yolo-chat-timeline-bottom-spacer')
    expect(html).toContain('height:88px')
  })

  it('does not render a Footer node when virtualized and spacer height is 0', () => {
    const items = Array.from({ length: 60 }, (_, i) => makeUserItem(`m-${i}`))
    const html = renderList({
      items,
      bottomSpacerHeight: 0,
      virtualizationThreshold: 24,
    })

    expect(html).toContain('mock-virtuoso')
    expect(html).not.toContain('yolo-chat-timeline-bottom-spacer')
  })
})
