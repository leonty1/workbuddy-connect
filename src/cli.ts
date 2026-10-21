/**
 * Text bridge to the official CodeBuddy CLI.
 *
 * WorkBuddy's gateway rejects requests from unapproved clients (code 11128),
 * and a DSH request is one. The CLI is the vendor's own client, so it carries
 * the same conversation without that rejection. It is a text-only transport:
 * built-in tools stay disabled and the bridge prompt forbids claiming that any
 * action ran. Each DSH turn becomes one headless CLI run.
 *
 * @module dsh-workbuddy-connect/cli
 */

import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { access, readdir } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { delimiter, dirname, isAbsolute, join, sep } from 'node:path'
import { createInterface } from 'node:readline'

/** Minimal logger surface shared with the shim. */
export interface CodeBuddyLogger {
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

/** CLI process settings, resolved from the plugin configuration. */
export interface CodeBuddyOptions {
  /** Binary name or absolute path; defaults to `codebuddy`. */
  binary?: string
  /** Per-request ceiling in milliseconds; defaults to ten minutes. */
  timeoutMs?: number
  /** Working directory for the CLI process; defaults to the OS temp directory. */
  cwd?: string
  logger?: CodeBuddyLogger
}

/** One headless CLI turn. */
export interface CodeBuddyRequest {
  model: string
  prompt: string
  effort?: string
  signal?: AbortSignal
}

/** Incremental output sinks; callers forward these into their own stream. */
export interface CodeBuddyHandlers {
  onThinking(delta: string): void
  onText(delta: string): void
}

/** Everything one CLI turn produced, including a terminal error. */
export interface CodeBuddyResult {
  text: string
  thinking: string
  promptTokens: number
  completionTokens: number
  cacheReadTokens: number
  durationMs?: number
  costUsd?: number
  error?: string
}

/** Default ceiling for one CLI run. */
const DEFAULT_TIMEOUT_MS = 600_000

/** Upper bound on retained stderr, enough for a diagnostic without memory growth. */
const STDERR_LIMIT = 16_384

/**
 * System text appended to the CLI's own prompt for every bridged turn.
 *
 * With tools disabled the model otherwise invents plausible command output
 * instead of admitting it cannot run anything, which would read as a real
 * execution result in the transcript.
 */
export const CLI_BRIDGE_PROMPT = [
  'You are answering through a text-only bridge inside another agent harness.',
  'No tools are available in this session: you cannot run commands, read or write files, or browse the web.',
  'Never claim to have performed such actions. If a request needs them, say plainly that this session cannot perform it and provide the reasoning or code instead.',
].join(' ')

/** Whether a path is executable by this user. */
async function executable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    // Missing or non-executable; callers try the next candidate.
    return false
  }
}

/** Node-version bin directories under nvm, newest first. */
async function nvmBinDirectories(): Promise<string[]> {
  const root = join(homedir(), '.nvm', 'versions', 'node')
  let versions: string[]
  try {
    versions = await readdir(root)
  } catch {
    // No nvm installation; the remaining search directories still apply.
    return []
  }
  return versions
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
    .map(version => join(root, version, 'bin'))
}

/** Directories searched for a bare CLI name. */
function searchDirectories(): string[] {
  const directories = new Set<string>()
  for (const entry of (process.env['PATH'] ?? '').split(delimiter)) {
    if (entry !== '') directories.add(entry)
  }
  for (const entry of [
    join(homedir(), '.local', 'bin'),
    join(homedir(), '.npm-global', 'bin'),
    join(homedir(), '.volta', 'bin'),
    join(homedir(), '.bun', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ]) {
    directories.add(entry)
  }
  return [...directories]
}

/**
 * Resolve the CodeBuddy binary.
 *
 * A configured path containing a separator is authoritative: a wrong path
 * fails loudly instead of silently running a different installation. A bare
 * configured name, and the default `codebuddy`, are searched through PATH plus
 * common install layouts, because a GUI-launched host often carries a minimal
 * PATH that omits the user's node manager.
 *
 * @param configured - Configured binary name or path.
 * @param logger - Optional diagnostic sink.
 * @returns The executable path, or undefined when no candidate is executable.
 */
export async function resolveCodeBuddyBinary(configured?: string, logger?: CodeBuddyLogger): Promise<string | undefined> {
  const requested = configured?.trim()
  const authoritative = requested !== undefined && requested !== ''
    && (requested.includes(sep) || requested.includes('/') || isAbsolute(requested))
  if (requested !== undefined && authoritative) {
    if (await executable(requested)) return requested
    logger?.warn(`dsh-workbuddy-connect: configured CodeBuddy CLI path is not executable: ${requested}`)
    return undefined
  }
  const names = requested !== undefined && requested !== '' ? [requested] : ['codebuddy', 'cbc']
  const directories = [...searchDirectories(), ...await nvmBinDirectories()]
  for (const name of names) {
    for (const directory of directories) {
      const candidate = join(directory, name)
      if (await executable(candidate)) return candidate
    }
  }
  return undefined
}

/** Text of one OpenAI content value, dropping images this bridge cannot send. */
function contentText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  const parts: string[] = []
  for (const part of value) {
    if (typeof part === 'string') {
      parts.push(part)
      continue
    }
    if (typeof part !== 'object' || part === null) continue
    const record = part as Record<string, unknown>
    if (record['type'] === 'image_url' || record['type'] === 'image') {
      parts.push('[Image omitted: this bridge is text-only.]')
    } else if (typeof record['text'] === 'string') {
      parts.push(record['text'])
    }
  }
  return parts.join('\n')
}

/** Names of the tools an assistant message requested, when the transcript has any. */
function toolCallSummary(value: unknown): string {
  if (!Array.isArray(value)) return ''
  const names: string[] = []
  for (const call of value) {
    if (typeof call !== 'object' || call === null) continue
    const fn = (call as Record<string, unknown>)['function']
    if (typeof fn !== 'object' || fn === null) continue
    const name = (fn as Record<string, unknown>)['name']
    if (typeof name === 'string' && name !== '') names.push(name)
  }
  return names.length === 0 ? '' : `[Assistant requested tool calls: ${names.join(', ')}]`
}

/**
 * Flatten an OpenAI message list into one CLI prompt.
 *
 * System and developer messages are omitted: DSH's system prompt is written
 * for its own tool loop and would both bloat every CLI run and instruct the
 * model to use tools this transport does not provide. A single user turn is
 * sent verbatim; a longer conversation is labelled by role so the model can
 * follow the exchange.
 *
 * @param messages - The request's `messages` value.
 * @returns The prompt, or an empty string when no user content is present.
 */
export function flattenChatPrompt(messages: unknown): string {
  if (!Array.isArray(messages)) return ''
  const entries: string[] = []
  for (const message of messages) {
    if (typeof message !== 'object' || message === null) continue
    const record = message as Record<string, unknown>
    const role = typeof record['role'] === 'string' ? record['role'] : 'user'
    if (role === 'system' || role === 'developer') continue
    const text = contentText(record['content'])
    if (role === 'tool') {
      const name = typeof record['name'] === 'string' && record['name'] !== '' ? ` (${record['name']})` : ''
      if (text !== '') entries.push(`[Tool result${name}]\n${text}`)
      continue
    }
    if (role === 'assistant') {
      const parts = [text, toolCallSummary(record['tool_calls'])].filter(part => part !== '')
      if (parts.length > 0) entries.push(`[Assistant]\n${parts.join('\n')}`)
      continue
    }
    if (text !== '') entries.push(`[User]\n${text}`)
  }
  const first = entries[0]
  if (entries.length === 1 && first !== undefined && first.startsWith('[User]\n')) {
    return first.slice('[User]\n'.length)
  }
  if (entries.length === 0) return ''
  return `Continue the conversation below and answer the final user message.\n\n${entries.join('\n\n')}`
}

/** Child environment with the CLI's own bin directory ahead of PATH, so its shebang finds node. */
function childEnvironment(binary: string): NodeJS.ProcessEnv {
  const directory = dirname(binary)
  const path = process.env['PATH']
  return {
    ...process.env,
    PATH: path === undefined || path === '' ? directory : `${directory}${delimiter}${path}`,
  }
}

/** Human-readable text of an unknown failure. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Truncated integer from an unknown value. */
function integerOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : undefined
}

/** Arguments for one headless turn. */
function cliArguments(request: CodeBuddyRequest): string[] {
  const args = [
    '-p',
    '--model', request.model,
    '--tools', '',
    '--max-turns', '1',
    '--permission-mode', 'dontAsk',
    '--setting-sources', '',
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--append-system-prompt', CLI_BRIDGE_PROMPT,
  ]
  if (request.effort !== undefined) args.push('--effort', request.effort)
  return args
}

/**
 * Run one prompt through the official CLI and stream its text back.
 *
 * Failures are returned in {@link CodeBuddyResult.error} rather than thrown so
 * a caller that has already started an HTTP response can close it cleanly.
 *
 * @param options - Binary, timeout, working directory, and logging.
 * @param request - Model, prompt, optional effort, and cancellation signal.
 * @param handlers - Called as thinking and answer deltas arrive.
 * @returns The collected text, usage, and terminal error, if any.
 */
export async function runCodeBuddyChat(
  options: CodeBuddyOptions,
  request: CodeBuddyRequest,
  handlers: CodeBuddyHandlers,
): Promise<CodeBuddyResult> {
  const outcome: CodeBuddyResult = {
    text: '',
    thinking: '',
    promptTokens: 0,
    completionTokens: 0,
    cacheReadTokens: 0,
  }
  const binary = await resolveCodeBuddyBinary(options.binary, options.logger)
  if (binary === undefined) {
    outcome.error = options.binary === undefined
      ? 'CodeBuddy CLI not found; install it or set cliPath'
      : `CodeBuddy CLI not found at ${options.binary}`
    return outcome
  }

  let child
  try {
    child = spawn(binary, cliArguments(request), {
      cwd: options.cwd ?? tmpdir(),
      env: childEnvironment(binary),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (error: unknown) {
    outcome.error = `CodeBuddy CLI failed to start: ${messageOf(error)}`
    return outcome
  }

  let timedOut = false
  let aborted = false
  let startError: string | undefined
  let exitCode: number | null = null
  let stderr = ''
  let sawPartial = false

  const emit = (handler: (delta: string) => void, delta: string): void => {
    try {
      handler(delta)
    } catch (error: unknown) {
      options.logger?.warn('dsh-workbuddy-connect: CLI output handler failed', error)
    }
  }

  const handleResult = (event: Record<string, unknown>): void => {
    const usage = event['usage']
    if (typeof usage === 'object' && usage !== null) {
      const record = usage as Record<string, unknown>
      outcome.promptTokens = integerOf(record['input_tokens']) ?? outcome.promptTokens
      outcome.completionTokens = integerOf(record['output_tokens']) ?? outcome.completionTokens
      outcome.cacheReadTokens = integerOf(record['cache_read_input_tokens']) ?? outcome.cacheReadTokens
    }
    if (typeof event['duration_ms'] === 'number') outcome.durationMs = event['duration_ms']
    if (typeof event['total_cost_usd'] === 'number') outcome.costUsd = event['total_cost_usd']
    if (event['is_error'] === true) {
      outcome.error = typeof event['result'] === 'string' && event['result'].trim() !== ''
        ? event['result']
        : 'CodeBuddy CLI reported an error'
      return
    }
    const text = event['result']
    if (!sawPartial && outcome.text === '' && outcome.thinking === '' && typeof text === 'string' && text !== '') {
      outcome.text = text
      emit(handlers.onText, text)
    }
  }

  const handleAssistant = (value: unknown): void => {
    if (typeof value !== 'object' || value === null) return
    const content = (value as Record<string, unknown>)['content']
    if (!Array.isArray(content)) return
    for (const block of content) {
      if (typeof block !== 'object' || block === null) continue
      const record = block as Record<string, unknown>
      if (record['type'] === 'text' && typeof record['text'] === 'string' && record['text'] !== '') {
        outcome.text += record['text']
        emit(handlers.onText, record['text'])
      } else if (record['type'] === 'thinking' && typeof record['thinking'] === 'string' && record['thinking'] !== '') {
        outcome.thinking += record['thinking']
        emit(handlers.onThinking, record['thinking'])
      }
    }
  }

  const handleStreamEvent = (value: unknown): void => {
    if (typeof value !== 'object' || value === null) return
    const event = value as Record<string, unknown>
    if (event['type'] !== 'content_block_delta') return
    const delta = event['delta']
    if (typeof delta !== 'object' || delta === null) return
    const record = delta as Record<string, unknown>
    if (record['type'] === 'text_delta') {
      const text = record['text']
      if (typeof text === 'string' && text !== '') {
        sawPartial = true
        outcome.text += text
        emit(handlers.onText, text)
      }
      return
    }
    if (record['type'] === 'thinking_delta') {
      const thinking = typeof record['thinking'] === 'string'
        ? record['thinking']
        : typeof record['text'] === 'string' ? record['text'] : ''
      if (thinking !== '') {
        sawPartial = true
        outcome.thinking += thinking
        emit(handlers.onThinking, thinking)
      }
    }
  }

  const handleLine = (line: string): void => {
    if (line.trim() === '') return
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      // Non-JSON diagnostics on stdout are not part of the event protocol.
      return
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return
    const event = parsed as Record<string, unknown>
    if (event['type'] === 'stream_event') {
      handleStreamEvent(event['event'])
      return
    }
    if (event['type'] === 'assistant' && !sawPartial) {
      handleAssistant(event['message'])
      return
    }
    if (event['type'] === 'result') handleResult(event)
  }

  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
  lines.on('line', handleLine)
  const linesClosed = new Promise<void>((resolve) => {
    lines.once('close', () => resolve())
  })
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => {
    if (stderr.length < STDERR_LIMIT) stderr += chunk
  })
  // A CLI that exits before reading the prompt leaves EPIPE here; the exit path
  // reports the real failure.
  child.stdin.on('error', (error: unknown) => {
    options.logger?.warn('dsh-workbuddy-connect: CodeBuddy CLI stdin failed', error)
  })
  child.stdin.end(request.prompt)

  const exited = new Promise<void>((resolve) => {
    child.once('error', (error: unknown) => {
      startError = messageOf(error)
      resolve()
    })
    child.once('close', (code: number | null) => {
      exitCode = code
      resolve()
    })
  })

  const stop = (): void => {
    if (child.exitCode !== null) return
    child.kill('SIGTERM')
    const force = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL')
    }, 2_000)
    force.unref?.()
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timer = setTimeout(() => {
    timedOut = true
    stop()
  }, timeoutMs)
  timer.unref?.()
  const onAbort = (): void => {
    aborted = true
    stop()
  }
  if (request.signal?.aborted === true) onAbort()
  else request.signal?.addEventListener('abort', onAbort, { once: true })

  await exited
  clearTimeout(timer)
  request.signal?.removeEventListener('abort', onAbort)
  lines.close()
  await linesClosed

  if (timedOut) {
    outcome.error = `CodeBuddy CLI timed out after ${timeoutMs} ms`
  } else if (aborted) {
    outcome.error = 'request aborted'
  } else if (startError !== undefined) {
    outcome.error = `CodeBuddy CLI failed to start: ${startError}`
  } else if (exitCode !== 0) {
    const detail = stderr.trim().slice(0, 500)
    outcome.error ??= `CodeBuddy CLI exited with code ${exitCode ?? 'unknown'}${detail === '' ? '' : `: ${detail}`}`
  }
  if (outcome.error === undefined && outcome.text === '' && outcome.thinking === '') {
    outcome.error = 'CodeBuddy CLI returned no text'
  }
  return outcome
}
