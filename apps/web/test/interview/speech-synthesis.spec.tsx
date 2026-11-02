import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi } from 'vitest'
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'

describe('interviewer speech', () => {
  it('serializes sentences at natural speed, observes toggles from stale handlers, and cancels on unmount', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    const spoken: SpeechSynthesisUtterance[] = []
    const cancel = vi.fn()
    vi.stubGlobal('speechSynthesis', { speak: (u: SpeechSynthesisUtterance) => spoken.push(u), cancel, getVoices: () => [] })
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
    let api!: ReturnType<typeof useSpeechSynthesis>
    function Harness() { api = useSpeechSynthesis(); return null }
    const host = document.createElement('div'); const root = createRoot(host)
    await act(async () => root.render(<Harness />))
    const staleHandler = api.handleStreamText
    await act(async () => { staleHandler('第一句。第二句。', true); staleHandler('第三句。', true) })
    expect(spoken).toHaveLength(1); expect(spoken[0].rate).toBe(1)
    await act(async () => spoken[0].onend?.({} as SpeechSynthesisEvent))
    expect(spoken).toHaveLength(2)
    await act(async () => api.toggle())
    await act(async () => staleHandler('不应该播放。', true))
    expect(spoken).toHaveLength(2)
    await act(async () => root.unmount())
    expect(cancel).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
  it('does not cancel another component speech when an idle preview unmounts', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    const cancel = vi.fn()
    vi.stubGlobal('speechSynthesis', { speak: vi.fn(), cancel, getVoices: () => [] })
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
    let active!: ReturnType<typeof useSpeechSynthesis>
    function Active() { active = useSpeechSynthesis(); return null }
    function Idle() { useSpeechSynthesis(); return null }
    const activeRoot = createRoot(document.createElement('div'))
    const idleRoot = createRoot(document.createElement('div'))
    try {
      await act(async () => { activeRoot.render(<Active />); idleRoot.render(<Idle />) })
      await act(async () => active.handleStreamText('正在进行的面试。', true))
      await act(async () => idleRoot.unmount())
      expect(cancel).not.toHaveBeenCalled()
      await act(async () => activeRoot.unmount())
      expect(cancel).toHaveBeenCalledTimes(1)
    } finally {
      await act(async () => { idleRoot.unmount(); activeRoot.unmount() })
      vi.unstubAllGlobals()
    }
  })

})
