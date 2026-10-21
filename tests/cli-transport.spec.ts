import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkBuddyCredentialStore } from '../src/auth.ts'
import { WorkBuddyCatalog } from '../src/catalog.ts'
import { flattenChatPrompt, runCodeBuddyChat } from '../src/cli.ts'
import { createWorkBuddyShim, type WorkBuddyShim } from '../src/shim.ts'

/**
 * A stand-in for the official CLI. It records the argv it received and emits
 * the stream-json events the real binary produces, selected by
 * `FAKE_CODEBUDDY_MODE`, so no test spends real credit.
 */
const FAKE_CLI = `#!/usr/bin/env node
const { appendFileSync } = require('node:fs')
const args = process.argv.slice(2)
if (process.env.FAKE_ARGS_FILE) {
  appendFileSync(process.env.FAKE_ARGS_FILE, JSON.stringify(args) + '\\n')
}
const mode = process.env.FAKE_CODEBUDDY_MODE || 'partial'
const emit = value => process.stdout.write(JSON.stringify(value) + '\\n')
let prompt = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => { prompt += chunk })
process.stdin.on('end', () => {
  if (mode === 'hang') {
    setInterval(() => {}, 1000)
    return
  }
  if (mode === 'fail') {
    process.stderr.write('boom\\n')
    process.exitCode = 2
    return
  }
  if (mode === 'error-result') {
    emit({ type: 'result', is_error: true, result: 'model unavailable', usage: { input_tokens: 1, output_tokens: 1 } })
    return
  }
  if (mode === 'empty') {
    emit({ type: 'result', is_error: false, result: '', usage: { input_tokens: 1, output_tokens: 0 } })
    return
  }
  if (mode === 'assistant') {
    emit({ type: 'assistant', message: { content: [
      { type: 'thinking', thinking: 'plan' },
      { type: 'text', text: 'hello' },
    ] } })
    emit({ type: 'result', is_error: false, result: 'hello', usage: { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 3 } })
    return
  }
  if (mode === 'echo-prompt') {
    emit({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: prompt } } })
    emit({ type: 'result', is_error: false, result: prompt, usage: { input_tokens: 1, output_tokens: 1 } })
    return
  }
  emit({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'plan ' } } })
  emit({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'more' } } })
  emit({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: '你' } } })
  emit({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: '好' } } })
  emit({ type: 'result', is_error: false, result: '你好', usage: { input_tokens: 12, output_tokens: 3, cache_read_input_tokens: 4 }, duration_ms: 5, total_cost_usd: 0 })
})
`

const CLEANUP: (() => Promise<void>)[] = []
let directory = ''
let binary = ''
let argsFile = ''

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'wb-cli-'))
  binary = join(directory, 'codebuddy')
  argsFile = join(directory, 'args.ndjson')
  await writeFile(binary, FAKE_CLI)
  await chmod(binary, 0o755)
  process.env['FAKE_ARGS_FILE'] = argsFile
})

afterEach(async () => {
  delete process.env['FAKE_CODEBUDDY_MODE']
  delete process.env['FAKE_ARGS_FILE']
  await Promise.all(CLEANUP.splice(0).map(clean => clean()))
  await rm(directory, { recursive: true, force: true })
})

/** Arguments of the most recent fake CLI invocation. */
async function lastArgs(): Promise<string[]> {
  const lines = (await readFile(argsFile, 'utf8')).trim().split('\n')
  return JSON.parse(lines.at(-1) ?? '[]') as string[]
}

/** Value following one flag, if present. */
function flagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  return index === -1 ? undefined : args[index + 1]
}

async function startCliShim(): Promise<WorkBuddyShim> {
  const store = new WorkBuddyCredentialStore({
    desktopPath: join(directory, 'missing-desktop.info'),
    ownPath: join(directory, 'own.json'),
    refresh: async () => ({ accessToken: 'unused' }),
  })
  const shim = createWorkBuddyShim({
    store,
    client: {
      async chatStream() {
        throw new Error('the CLI transport must not call the gateway')
      },
    },
    catalog: new WorkBuddyCatalog(),
    transport: 'cli',
    cli: { binary, timeoutMs: 5_000 },
  })
  await shim.ready
  CLEANUP.push(() => shim.close())
  return shim
}

describe('flattenChatPrompt', () => {
  it('sends one user turn verbatim without the system prompt', () => {
    const prompt = flattenChatPrompt([
      { role: 'system', content: 'You are DeepSeek Harness.' },
      { role: 'user', content: '你好' },
    ])
    expect(prompt).toBe('你好')
  })

  it('labels a multi-turn transcript, including tools and omitted images', () => {
    const prompt = flattenChatPrompt([
      { role: 'system', content: 'ignored system text' },
      {
        role: 'user',
        content: [
          { type: 'text', text: '看图' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } },
        ],
      },
      { role: 'assistant', content: '', tool_calls: [{ function: { name: 'read_file' } }] },
      { role: 'tool', name: 'read_file', content: 'file body' },
      { role: 'user', content: '继续' },
    ])
    expect(prompt).toContain('Continue the conversation below')
    expect(prompt).toContain('[Image omitted: this bridge is text-only.]')
    expect(prompt).toContain('[Assistant requested tool calls: read_file]')
    expect(prompt).toContain('[Tool result (read_file)]\nfile body')
    expect(prompt).toContain('[User]\n继续')
    expect(prompt).not.toContain('ignored system text')
  })
})

describe('runCodeBuddyChat', () => {
  it('streams partial thinking and text and reports usage', async () => {
    const thinking: string[] = []
    const text: string[] = []
    const result = await runCodeBuddyChat({ binary }, { model: 'glm-5.3', prompt: 'hi' }, {
      onThinking: delta => thinking.push(delta),
      onText: delta => text.push(delta),
    })
    expect(thinking).toEqual(['plan ', 'more'])
    expect(text).toEqual(['你', '好'])
    expect(result.text).toBe('你好')
    expect(result.thinking).toBe('plan more')
    expect(result.promptTokens).toBe(12)
    expect(result.completionTokens).toBe(3)
    expect(result.cacheReadTokens).toBe(4)
    expect(result.error).toBeUndefined()
    const args = await lastArgs()
    expect(flagValue(args, '--model')).toBe('glm-5.3')
    expect(flagValue(args, '--tools')).toBe('')
    expect(flagValue(args, '--setting-sources')).toBe('')
    expect(args).toContain('--include-partial-messages')
  })

  it('passes an explicit effort through', async () => {
    await runCodeBuddyChat({ binary }, { model: 'glm-5.3', prompt: 'hi', effort: 'high' }, {
      onThinking() {},
      onText() {},
    })
    expect(flagValue(await lastArgs(), '--effort')).toBe('high')
  })

  it('uses the full assistant message when no partial events arrive', async () => {
    process.env['FAKE_CODEBUDDY_MODE'] = 'assistant'
    const thinking: string[] = []
    const text: string[] = []
    const result = await runCodeBuddyChat({ binary }, { model: 'glm-5.3', prompt: 'hi' }, {
      onThinking: delta => thinking.push(delta),
      onText: delta => text.push(delta),
    })
    expect(thinking).toEqual(['plan'])
    expect(text).toEqual(['hello'])
    expect(result.error).toBeUndefined()
  })

  it('returns an error result from the CLI', async () => {
    process.env['FAKE_CODEBUDDY_MODE'] = 'error-result'
    const result = await runCodeBuddyChat({ binary }, { model: 'glm-5.3', prompt: 'hi' }, {
      onThinking() {},
      onText() {},
    })
    expect(result.error).toBe('model unavailable')
  })

  it('reports a non-zero exit with stderr', async () => {
    process.env['FAKE_CODEBUDDY_MODE'] = 'fail'
    const result = await runCodeBuddyChat({ binary }, { model: 'glm-5.3', prompt: 'hi' }, {
      onThinking() {},
      onText() {},
    })
    expect(result.error).toContain('exited with code 2')
    expect(result.error).toContain('boom')
  })

  it('treats a text-less success as an error', async () => {
    process.env['FAKE_CODEBUDDY_MODE'] = 'empty'
    const result = await runCodeBuddyChat({ binary }, { model: 'glm-5.3', prompt: 'hi' }, {
      onThinking() {},
      onText() {},
    })
    expect(result.error).toBe('CodeBuddy CLI returned no text')
  })

  it('times out and terminates the child', async () => {
    process.env['FAKE_CODEBUDDY_MODE'] = 'hang'
    const result = await runCodeBuddyChat({ binary, timeoutMs: 200 }, { model: 'glm-5.3', prompt: 'hi' }, {
      onThinking() {},
      onText() {},
    })
    expect(result.error).toContain('timed out after 200 ms')
  }, 10_000)

  it('terminates the child when the request is aborted', async () => {
    process.env['FAKE_CODEBUDDY_MODE'] = 'hang'
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 100)
    const result = await runCodeBuddyChat({ binary, timeoutMs: 5_000 }, {
      model: 'glm-5.3',
      prompt: 'hi',
      signal: controller.signal,
    }, {
      onThinking() {},
      onText() {},
    })
    expect(result.error).toBe('request aborted')
  }, 10_000)

  it('fails loudly when an explicit binary path is missing', async () => {
    const result = await runCodeBuddyChat({ binary: join(directory, 'missing') }, {
      model: 'glm-5.3',
      prompt: 'hi',
    }, {
      onThinking() {},
      onText() {},
    })
    expect(result.error).toContain('not found at')
  })
})

describe('CLI transport in the shim', () => {
  it('serves a completion without a WorkBuddy credential and maps effort', async () => {
    const shim = await startCliShim()
    const response = await fetch(`${shim.baseUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${shim.token()}` },
      body: JSON.stringify({
        model: 'glm-5.3',
        reasoning_effort: 'high',
        messages: [
          { role: 'system', content: 'ignored system text' },
          { role: 'user', content: 'hello' },
        ],
      }),
    })
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain('"reasoning_content":"plan "')
    expect(body).toContain('"content":"你"')
    expect(body).toContain('"content":"好"')
    expect(body).toContain('"prompt_tokens":12')
    expect(body).toContain('data: [DONE]')
    expect(flagValue(await lastArgs(), '--effort')).toBe('high')
  })

  it('sends the flattened conversation and drops system text', async () => {
    const shim = await startCliShim()
    process.env['FAKE_CODEBUDDY_MODE'] = 'echo-prompt'
    const response = await fetch(`${shim.baseUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${shim.token()}` },
      body: JSON.stringify({
        model: 'glm-5.3',
        messages: [
          { role: 'system', content: 'SECRET SYSTEM PROMPT' },
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'second' },
          { role: 'user', content: 'third' },
        ],
      }),
    })
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain('[User]')
    expect(body).toContain('third')
    expect(body).not.toContain('SECRET SYSTEM PROMPT')
  })

  it('omits an effort the model does not declare', async () => {
    const shim = await startCliShim()
    const response = await fetch(`${shim.baseUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${shim.token()}` },
      body: JSON.stringify({
        model: 'hy3',
        reasoning_effort: 'high',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    })
    expect(response.status).toBe(200)
    await response.text()
    expect(flagValue(await lastArgs(), '--effort')).toBeUndefined()
  })

  it('maps a CLI failure to HTTP 502', async () => {
    const shim = await startCliShim()
    process.env['FAKE_CODEBUDDY_MODE'] = 'fail'
    const response = await fetch(`${shim.baseUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${shim.token()}` },
      body: JSON.stringify({ model: 'glm-5.3', messages: [{ role: 'user', content: 'hello' }] }),
    })
    expect(response.status).toBe(502)
    const body = await response.json() as { error: { message: string }, error_type?: string }
    expect(body.error.message).toContain('CodeBuddy CLI exited with code 2')
  })
})
