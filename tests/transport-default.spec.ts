import { resolveConfig } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import * as WorkBuddy from '../src/index.ts'

/**
 * The gateway is the default so a fresh install keeps DSH's own tools,
 * approvals, images, and system prompt. The CLI stays an explicit opt-in.
 */
describe('transport default', () => {
  const resolve = (saved: Record<string, unknown>): Record<string, unknown> =>
    resolveConfig({ name: 'fixture', callback() {}, Config: WorkBuddy.Config } as never, saved) as Record<string, unknown>

  it('resolves to the gateway when the profile sets no transport', () => {
    expect(resolve({}).transport).toBe('gateway')
  })

  it('still accepts an explicit CLI opt-in', () => {
    expect(resolve({ transport: 'cli' }).transport).toBe('cli')
  })
})
