// 订阅实时任务流事件的 React hook。
// 先通过 getSnapshot 补齐历史，再订阅后续 push；50ms 节流避免每 chunk 一次 setState。

import { App } from 'obsidian'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { LiveTaskStreamSnapshot } from '../core/agent/live-stream/taskStreamBus'
import { liveTaskStreamBus } from '../core/agent/live-stream/taskStreamBus'
import { loadExternalAgentProgress } from '../database/json/chat/externalAgentProgressStore'
import type { YoloSettings } from '../settings/schema/setting.types'

const THROTTLE_MS = 50

export type LiveTaskKind = 'external-agent' | 'subagent' | 'terminal'

export type LiveTaskViewSnapshot =
  | (LiveTaskStreamSnapshot & { source: 'live' })
  | {
      stderr: string
      stdout: ''
      status: 'done'
      source: 'historical'
      truncated?: { totalBytes: number; omittedBytes: number }
    }

export function useLiveTaskStream(
  toolCallId: string,
  opts: { app: App; settings?: YoloSettings; kind?: LiveTaskKind },
): LiveTaskViewSnapshot | null {
  const { app, settings, kind = 'external-agent' } = opts

  const [snapshot, setSnapshot] = useState<LiveTaskViewSnapshot | null>(() => {
    const live = liveTaskStreamBus.getSnapshot(toolCallId)
    if (live !== null) return { ...live, source: 'live' }
    return null
  })

  const pendingRef = useRef<LiveTaskStreamSnapshot | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    timerRef.current = null
    if (pendingRef.current !== null) {
      setSnapshot({ ...pendingRef.current, source: 'live' })
      pendingRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    pendingRef.current = null
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    const initial = liveTaskStreamBus.getSnapshot(toolCallId)
    if (initial !== null) {
      setSnapshot({ ...initial, source: 'live' })
    } else {
      setSnapshot(null)
      if (kind === 'external-agent') {
        void loadExternalAgentProgress({ app, settings, toolCallId })
          .then((stored) => {
            if (cancelled) return
            if (liveTaskStreamBus.getSnapshot(toolCallId) !== null) return
            if (!stored) return
            setSnapshot({
              stderr: stored.progressText,
              stdout: '',
              status: 'done',
              source: 'historical',
              ...(stored.truncated ? { truncated: stored.truncated } : {}),
            })
          })
          .catch(() => {
            // load 失败保持 null
          })
      }
    }

    const unsubscribe = liveTaskStreamBus.subscribe(toolCallId, () => {
      pendingRef.current = liveTaskStreamBus.getSnapshot(toolCallId)
      if (!timerRef.current) {
        timerRef.current = setTimeout(flush, THROTTLE_MS)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [toolCallId, app, settings, kind, flush])

  return snapshot
}
