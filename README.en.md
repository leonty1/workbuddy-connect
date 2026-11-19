# DSH WorkBuddy Connect

English | [中文](./README.md)

Brings WorkBuddy models into [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness); the two versions each show their own model group and reuse their own account sign-in and credit.

> **This repository is a fork of [corrinehu/dsh-workbuddy-connect](https://github.com/corrinehu/dsh-workbuddy-connect).** Since 0.8.2, the CN version talks to the WorkBuddy gateway by default: requests follow the official CodeBuddy CLI's measured wire format (CLI identity headers and body fields), and the DSH identity sentence and brand mentions that trip the channel check are cleaned, so the full DSH system prompt, tool calls, approval cards, and image input all work. The 0.8.0–0.8.1 CodeBuddy CLI text bridge remains available as an optional `transport: cli`: it uses its own sign-in to bypass the channel check, but is text-only — DSH tools and images never take part. The international version always uses the gateway.

## Install

**Prerequisite**: the WorkBuddy (CN) desktop app is installed and signed in on this machine; the international version requires the WorkBuddy AI desktop app signed in. The default gateway transport does not depend on the CodeBuddy CLI. Only when explicitly choosing `transport: cli` do you need the official CodeBuddy CLI (`codebuddy` or `cbc`) installed and signed in (`codebuddy -p "hello"` answers normally).

**Recommended: let an Agent you already have do the install** — any assistant with terminal and file access (the DSH agent, Codex, Claude Code, Cursor, …). Paste this to it verbatim:

```text
Please install and verify the DSH (DeepSeek Harness) plugin dsh-workbuddy-connect for me (project: https://github.com/leonty1/workbuddy-connect).
Start by reading the project README and confirming which interface I actually use (Web / Desktop / TUI) and its DSH core version — for the Desktop app, the bundled core, never the standalone CLI's version.
This fork targets DSH 0.2.1-rc.2 / 0.2.1-rc.3 / 0.2.2-rc.2 / 0.2.2-rc.3 / 0.2.2-rc.5 (plugin 0.8.7) and uses the WorkBuddy gateway by default — no CodeBuddy CLI needed; only check that codebuddy is installed and signed in if I explicitly ask for CLI mode.
Then install from this repository or local source, preferring a locally supported non-market channel; on some Desktop distributions (the official Electron app in particular) the profile is app-managed and rules vary by distribution — check mine first, then explore its compliant install route, but never bypass its validation.
Ask for my consent and make backups before changing any local files or configuration.
After installing, verify the WorkBuddy group appears in the model picker and walk me through one short conversation.
If the Desktop install still fails generation validation (e.g. the @types/retry false positive), report it honestly, reference upstream dataelement/dsh-desktop#688, and suggest switching to the standalone Web / TUI — do not modify dependency packages or bypass the check.
```

Core-to-plugin quick reference (full table in "Compatibility and release history" at the end):

| DSH core | Recommended plugin |
|---|---|
| 0.2.2-rc.5 | 0.8.7 (this fork, source or local link install; 0.8.6 and earlier are flagged Problem and refused) |
| 0.2.2-rc.3 | 0.8.7 (same; 0.8.6 also works) |
| 0.2.2-rc.2 | 0.8.7 (same; 0.8.4 / 0.8.5 / 0.8.6 also work) |
| 0.2.1-rc.3 | 0.8.7 (same; 0.8.3 / 0.8.4 / 0.8.5 / 0.8.6 also work) |
| 0.2.1-rc.2 | 0.8.7 (same; 0.8.2 / 0.8.3 / 0.8.4 / 0.8.5 / 0.8.6 also work) |
| 0.2.1-rc.2 | 0.7.9 (upstream npm, gateway only) |
| 0.2.1-rc.1 | 0.7.7 |
| 0.2.0-rc.2 | 0.7.6 |
| 0.2.0-rc.1 | 0.7.0 |
| 0.1.5 – 0.1.7 | 0.6.5 |

<details>
<summary>Manual install (command line, Web / TUI only)</summary>

```sh
# Web (pin per your actual core; this fork can also be installed from source via github:leonty1/workbuddy-connect)
dsh plugin --profile web add dsh-workbuddy-connect@0.7.9
dsh web

# TUI (example for a 0.1.x core; that profile needs pnpm 11, e.g. npx pnpm@11)
dsh plugin --profile dsh-tui add dsh-workbuddy-connect@0.6.5
dsh --profile dsh-tui
```

</details>

> **TUI version pairing**: the terminal shell `@deepseek-harness-tui/dsh-tui` must be 0.10.0-beta.5 or newer — older versions fail at startup with this plugin installed (`events is not iterable`); manual reasoning-level detection exists on Web / Desktop only, not TUI.

> **Desktop**: on some Desktop distributions (the official Electron app in particular) the `desktop` profile is app-managed, and the official app rejects the standalone CLI's `--profile desktop`; other distributions may follow different rules, so check yours first and do not blindly use the standalone CLI's `--profile desktop`. An Agent may probe whether your distribution offers a compliant non-market install route, but that is not guaranteed to work; never blindly edit the app-managed directory or bypass its validation.

**Verify**: after restarting the interface, the model picker shows the "WorkBuddy / WorkBuddy AI" group(s) (with only one app installed, check just that group), and a model picked from the group completes one short conversation with a normal reply — that is what a successful install means.

## Features

- **Works out of the box**: install and enable the plugin, then use it directly in DSH — the default gateway transport only needs the matching desktop app signed in, with no extra configuration or CLI.

![WorkBuddy models in the DSH model picker](assets/1.png)

- **CN and international side by side**: the CN app appears as the WorkBuddy group and the international one (WorkBuddy AI) as the WorkBuddy AI group; their models, accounts, and credit never mix. Each group follows only its own app's sign-in — install just the international app and only WorkBuddy AI appears, install both and both groups appear, sign out of one and that group goes away. Settings shows one card per version, each with its own account and balance.

![WorkBuddy AI models in the DSH model picker](assets/5.png)

- **Image input**: most models accept images pasted or dropped straight into the conversation (GLM-5.3-Flash, the DeepSeek-V4 series, and more); the few text-only models (e.g. GLM-5.1 / GLM-5.2 on the China endpoint) clearly say so.

- **Reasoning levels**: levels explicitly declared by WorkBuddy appear directly — for example, GLM-5.3 and GLM-5.3-Flash offer low / high / max. For models without declared levels, Web and Desktop offer a manual check in the model picker (it sends a few requests and may consume credit); models without a check result or selectable levels keep using WorkBuddy's default.

- **Balance at a glance**: with a WorkBuddy / WorkBuddy AI model selected, the composer shows the account's remaining credit next to the model selector (e.g. `WB.3,401 credits`, `WB AI.3,401 credits` on the international app). Credit is not polled automatically (every status read is a real billing query): one read on mount, then refresh on demand with the ↻ before the balance. During session switching, the controls may briefly hide until the model selection is ready, then return automatically. The refresh button remains available even when the model has no reasoning-level detection entry or the balance cannot be read.

- **Status and detection**: Settings → Plugins → the matching card shows the account, token validity, remaining credit, and model offers; it also refreshes the model list manually, shows whether the current list came from the upstream or the built-in fallback, and runs manual reasoning-level detection for eligible models. On DSH 0.1.5 the entry lives under Settings → Plugins; on 0.1.6+ it moved to the left-sidebar Plugins panel (workbuddy-connect → View) — and the Settings → Models page shows no WorkBuddy entries on either generation, by design.

- **Model visibility**: the Context window tab of each card lets you check which models appear in the model picker. Hidden lists are saved per signed-in account: switching accounts switches to that account's own list, switching back restores it; new accounts and newly added models are visible by default. Hiding only affects pickability — existing chats using a hidden model keep working.

![Model visibility in the context-window list (DSH 0.1.6+ plugin configuration page)](assets/6.png)

The same UI works unchanged inside the DSH 0.1.5 settings cards:

![Model visibility in a DSH 0.1.5 settings card](assets/7.png)

- **Enterprise credit**: on the CN product, enterprise accounts (non-empty `enterpriseId`) read their cycle quota from the enterprise billing endpoint, and the card shows the enterprise quota with the cycle reset time.

- **Rate**: every model name carries its credits multiplier (e.g. `GLM-5.2 · x0.79`, `Hy3 · x0.00`) in both the `/model` popup and the composer's model dropdown; the rate is display-only and never affects requests.

- **Promo badges**: promo badges (limited-time free, night discount) ride the model name itself (e.g. `Hy4 preview · x0.00 · 限时免费`), visible wherever you pick a model, and the status card collects currently discounted models — per WorkBuddy service data, synced each time DSH starts. The international version's promotions come from the service's `modelPromotions` (with an effective window); once a promotion lapses its badge is withdrawn, and because the service writes the discounted value into the model's own rate field, the original price cannot be reconstructed — the model then reports "price unavailable — refresh to update" instead of repeating the discounted rate or claiming it is free.

![Settings card showing the plugin](assets/2.png)

The expanded card has three tabs: Status shows the account, token validity, total credit, catalog source, and reasoning-level detection; Context lists each model's context window, and the international version's "use the upstream's largest declared context window" switch lives here (on by default, so DSH sizes context compression to the largest declared window; turn it off to follow the upstream default instead, and the preference persists across restarts); Details combines credit packages with the same name and shows model offers. The CN and international versions each get their own card.

![Settings card showing account and remaining credit](assets/3.png)

## Transport (gateway by default, CLI optional)

This fork adds a `transport` setting to the CN version, defaulting to `gateway`:

```yaml
plugins:
  dsh-workbuddy-connect:
    transport: gateway      # gateway (default) or cli (optional text bridge)
    # the following apply only when transport: cli
    # cliPath: /Users/me/.nvm/versions/node/v22.22.2/bin/codebuddy
    # cliTimeoutMs: 600000
    # cliTools: false       # text-only by default; true runs the CLI's own tool loop
    # cliCwd: /path/to/project   # the CLI working directory when cliTools is true
    # cliPermissionMode: bypassPermissions # acceptEdits / bypassPermissions / default / plan / dontAsk / auto
    # cliMaxTurns: 30       # per-run agentic-turn ceiling when cliTools is true
```

> Upgrading from 0.8.1 and relying solely on the CodeBuddy CLI's sign-in (desktop app signed out)? Keep `transport: cli` explicitly; otherwise the new gateway default requires signing in to the desktop app first.

- **Gateway (default)**: talks to the WorkBuddy CN gateway directly and needs the desktop app's sign-in. Requests follow the official CodeBuddy CLI's measured wire format — CLI identity headers (`X-IDE-Type/Name: CLI` and friends) and body fields — after two system-prompt cleanups: the DSH identity sentence is removed, and "DeepSeek Harness" brand mentions are replaced with a neutral word. Besides the identity sentence, the gateway's channel check (11128) also rejects brand wording combined with Web-GUI instruction sentences; with those replaced, the full DSH system prompt passes in testing. Unlike the CLI text bridge, DSH tool calls, approval cards and the session log, and image input all work in gateway mode.
- **CLI text bridge (`transport: cli`, optional)**: hands each request to the locally signed-in official CodeBuddy CLI, which does not need the desktop app's sign-in and does not go through the WorkBuddy gateway. Each turn is flattened into one text prompt for `codebuddy -p`; CLI tool execution is disabled (`--tools "" --max-turns 1`) and DSH tool calls are not passed through; images become an "omitted" placeholder and the model cannot actually read them. The CLI's model list is the CN product line and the international ids have no CLI equivalent, so this mode registers the CN "WorkBuddy" group only.
- **CLI independent sign-in**: the CLI uses its own sign-in under `~/.codebuddy`; the CN group is available in CLI mode even when the desktop app is signed out. If the CLI itself is signed out, a chat fails with an explanation in the conversation.
- **CLI model and reasoning selection stay**: the picker still lists the WorkBuddy group and credit multipliers, and a reasoning effort is forwarded (`--effort`) only when the model's catalog entry declares it; other models run at the CLI default.
- **CLI optional tool mode (`cliTools: true`)**: the CLI runs its own tool loop — it really executes commands and reads/writes files, with the working directory taken from the DSH session's system prompt and applied to the CLI process as well. Three caveats: execution happens inside the CLI, so **DSH's approval prompts, tool cards, and session log do not cover it** — the transcript shows only the final text; `cliPermissionMode` selects the CLI's permission level (default `bypassPermissions` — an unattended run cannot show an approval prompt, and `dontAsk` refuses every tool, so tool mode pre-approves by default; tighten to `acceptEdits` etc. if you want to); without `cliCwd` the CLI works in a temp directory, because a desktop app's own working directory is not necessarily a project. Set `cliCwd` explicitly for tasks that write files.
- **CLI extra overhead**: every CLI call carries the CLI's own system prompt and context (about 6k tokens measured) and is slower than the direct gateway; tool mode adds further model turns bounded by `cliMaxTurns` (default 30), so time and credits rise with the task. A long turn is bounded by `cliTimeoutMs`.

When using the CLI, the binary is resolved in this order: `cliPath` (a value containing `/` is authoritative and a wrong path fails loudly) → `PATH` → `~/.nvm/versions/node/*/bin` (newest version) → `~/.local/bin`, `~/.npm-global/bin`, `~/.volta/bin`, `~/.bun/bin`, `/opt/homebrew/bin`, `/usr/local/bin`. A desktop app often launches with a minimal PATH, so common install locations are searched automatically; if the binary still cannot be found, set `cliPath` explicitly.

## Why reasoning levels work this way

Information about WorkBuddy models' reasoning levels is currently split between upstream API responses and private UI logic in the client, while the model catalog changes quickly. If the plugin filled in one uniform set of levels for every model without an upstream declaration, it would need to keep chasing unpublished product logic with no stable contract.

![Reasoning-level detection in the composer](assets/4.png)

Testing also found that some models accept the `reasoning_effort` parameter while ignoring unknown values and falling back to their default behavior. A successful request alone therefore does not prove that a level is actually usable.

For models without declared levels, Web and Desktop instead use user-authorized, on-demand detection: it first confirms that the upstream validates the parameter, then checks which standard levels it accepts. The check sends a few requests and may consume credit. Its result means only that the upstream currently accepts that level; it does not promise a particular change in reasoning quality, speed, or credit use.

## CLI

`dsh plugin --profile <web|dsh-tui> exec dsh-workbuddy-connect status`: sign-in state and remaining credit (`--json` for machine-readable output; `doctor` for diagnostics and `logout` for credential cleanup are also available). The `desktop` profile is generally managed by the desktop app, so the CLI (including `exec`) does not work against it (see the Desktop note under Install).

Both commands target the CN version by default; add `--provider workbuddy-ai` for the international one:

```sh
dsh plugin --profile web exec dsh-workbuddy-connect status --provider workbuddy-ai
dsh plugin --profile web exec dsh-workbuddy-connect doctor --provider workbuddy-ai
```

`logout` removes only that version's plugin-owned credential copy. It leaves the desktop app's own sign-in alone and does not promise the model group will disappear (the app's credential file still supplies one).

## Known limitations

- Verified on macOS with the DSH Web / Desktop / TUI profiles (as of 0.3.2 this requires `0.1.5-rc.1`+ and Node 22+; TUI requires the terminal UI package `0.10.0-beta.5` or newer — see the Install section). Windows probes Local and Roaming AppData in order; WSL first reads credentials from the mounted Windows user profile. If the Windows and Linux user names differ and Windows environment variables are not forwarded into WSL, point `WORKBUDDY_AUTH_FILE` (or `WORKBUDDY_AI_AUTH_FILE` for the international version) at the actual file.
- **Encrypted desktop credential helper discovery**: the helper is auto-detected on macOS and Windows; on Windows the CN app checks the default path `%LOCALAPPDATA%\Programs\WorkBuddy\WorkBuddy.exe` first and then the uninstall registry records, while the international app has no verified default path and checks the registry only. If auto-detection fails, set `WORKBUDDY_ELECTRON_BIN` (CN) or `WORKBUDDY_AI_ELECTRON_BIN` (international) to the executable explicitly, then fully quit and restart DSH for the change to take effect. Linux has no auto-discovery; an explicit environment variable is required. When WSL invokes the Windows-side helper, the plugin automatically normalizes the `ELECTRON_RUN_AS_NODE` entry in the child's `WSLENV` to a single safe flag set (carrying `/w` for forwarding, with no path translation; all other entries are preserved) — no manual `WSLENV` setup is needed. This change has passed offline regression tests; real WSL2 / Windows verification remains outstanding.
- **The international version's model catalog comes from the app's own interface**: the service splits it by User-Agent, which is a private implementation detail that a server-side change can break. When that happens the plugin degrades to this account's last successful catalog and then to its built-in roster, showing the source (live / saved / built-in), the fetch time, and the failure reason on the card — but long-term compatibility is not guaranteed. The CN version's catalog uses the same interface as the official CLI and is unaffected.
- **International-version environments not yet covered**: on Windows / WSL / Linux no reliable source for the international app's version has been located yet, so the saved value or the built-in default is used. On macOS, real-shim checks covered complete GPT-family replies, tool calls, and continued turns.
- **Behaviour change with no credentials**: in gateway mode, a version whose app was never signed in — and that left no plugin-owned copy — no longer shows a model group (the CN version used to display a built-in fallback list, but every model on it failed when selected). Explicitly choosing `transport: cli` is the exception: the CN group does not depend on the desktop app's sign-in and always shows the built-in roster; whether a chat works depends on the CodeBuddy CLI's own sign-in.
- **The enterprise credit path currently covers the CN product only**: the international enterprise billing interface is unverified, so those accounts still read through the personal endpoint pending measurement. The enterprise branch could not be tested locally (the development machine holds a personal account); it was implemented from the official app's interface contract, and reports from enterprise users are welcome.
- **Settings entries vary with the DSH version**: older services use `installSection`; newer ones use SettingsForms. On DSH 0.2.1-rc.2, 0.7.9 restores the international edition's maximum-context switch, enabled by default. Turning it off uses the upstream default window, and the preference survives restarts. The switch appears only once this plugin's writable settings entry is ready; while waiting, the maximum window remains the default.
- **The optional CLI transport is implemented for macOS only**: on Windows the CLI is usually an npm-generated `.cmd` shim, which Node cannot spawn directly; that path is neither adapted nor tested. Windows users can use the default `transport: gateway` instead, no waiting required.
- Relies on WorkBuddy client interfaces (not a public API), including the gateway's channel check and client identity headers; the plugin may need updates as WorkBuddy changes.

## Compatibility and release history

The plugin version must match the DSH core — a mismatched combination fails to start DSH — and the Desktop app picks its plugin version by the bundled core. The newest npm release is not necessarily right for you: match your actual core first.

| DSH core | Recommended plugin | Notes |
|---|---|---|
| `0.2.2-rc.5` | `0.8.7` | This fork; the compatibility range explicitly enumerates 0.2.1-rc.2, 0.2.1-rc.3, 0.2.2-rc.2, 0.2.2-rc.3, and 0.2.2-rc.5, with no version exemption needed. CN chat uses the WorkBuddy gateway by default (full DSH tools, images, and system prompt), with the CodeBuddy CLI as an optional text bridge. Not published to npm — install from this repository or a local `link:`. |
| `0.2.2-rc.3` | `0.8.7` | Same; 0.8.6 also supports this core. |
| `0.2.2-rc.2` | `0.8.7` | Same; 0.8.4 / 0.8.5 / 0.8.6 also support this core. |
| `0.2.1-rc.3` | `0.8.7` | Same; 0.8.3 already supports this core and remains usable. |
| `0.2.1-rc.2` | `0.8.7` | Same; 0.8.2 / 0.8.3 are functionally identical on this core, so an existing install needs no upgrade. |
| `0.2.1-rc.2` | `0.7.9` | Upstream npm release; gateway only. |
| `0.2.1-rc.1` | `0.7.7` | The core moved to `@earendil-works/pi-ai` 1.3.0, so the plugin bundles 1.3.0 too — a leftover 0.87.1 overrides entry must be removed (see the pi-ai note below). |
| `0.2.0-rc.2` | `0.7.6` | Previous core line; fixes enterprise catalog gaps and international chat requests blocked by the upstream channel check. Avoid 0.7.2 with its registry regression. |
| `0.2.0-rc.1` | `0.7.0` | 0.7.1 drops rc.1 support; stay on this version. |
| `0.1.5` – `0.1.7` | `0.6.5` | Final release for the old cores; 0.7.0 targets 0.2.0 only. |
| `0.1.2-rc.1` | `0.3.1` | Older line, historical maintenance only. |
| `0.1.1-rc.2` | `0.2.6` | Older line, historical maintenance only. |

Release history (full 0.7.x and earlier records at the upstream [releases](https://github.com/corrinehu/dsh-workbuddy-connect/releases)):

- **0.8.7** (this fork): supports DSH 0.2.2-rc.5, the core the desktop app ships since 2026-11-18: the six DSH service peers explicitly gain `0.2.2-rc.5` (still no carets) and local build/test dependencies move to rc.5. On rc.5 the app's compatibility check flags 0.8.6 as Problem and refuses to load it (NO_ADAPTER for every WorkBuddy model); checked against the rc.5 app's own `evaluatePluginCompatibility` semantics: 0.8.6 fails rc.5, 0.8.7 passes, and unverified cores are still refused. The rc.5 gate logic is unchanged from rc.3 and the plugin code is untouched.
- **0.8.6** (this fork): two fixes. (1) Supports DSH 0.2.2-rc.3, the core the desktop app ships since 2026-11-13: the six DSH service peers explicitly gain `0.2.2-rc.3` (still no carets) and local build/test dependencies move to rc.3. On rc.3 the app's compatibility check flags 0.8.5 as Problem and refuses to load it, which surfaces as NO_ADAPTER for every WorkBuddy model; checked against the app's own `evaluatePluginCompatibility` semantics (`semver.satisfies` with `includePrerelease`): 0.8.5 fails rc.3, 0.8.6 passes, and an unverified rc.4 is still refused. (2) Fixes the recurring 400 / 11128 "Request blocked" in long conversations: measured live 2026-11-16 on glm-5.3-flash and hy3, the channel check scores **assistant history** too — an assistant turn opening with the identity sentence, or quoting the harness prompt wholesale, blocks every later request in that conversation, Continue included. The system/developer rewrites now apply to assistant text as well (including content-parts); tool results, `reasoning_content`, and `tool_calls` arguments measurably are not scored and pass verbatim. Verified: local typecheck / 863 tests / build green; 27 live gateway probes pass (8 of them blocked before the fix); three-turn conversations through the built artifact (adapter → pi-ai → shim → gateway) on hy3 and glm-5.3-flash. The desktop app must reload the plugin for this to take effect.
- **0.8.5** (this fork): fixes desktop (DSH 0.2.2-rc.2) gateway chats being blocked by the CN channel check (400 / 11128 "Request blocked"). Live bisection shows the check scores system-prompt text that resembles a known harness prompt and blocks once enough matches accumulate, so removing the identity sentence and brand mentions was no longer enough: the fingerprinted sentences are now rewritten to equivalent phrasing (`Tokens prefixed with @` → `Tokens starting with @`, `Relative paths resolve from` → `Relative paths are resolved from`), and content-parts system/developer messages are covered too; other roles pass verbatim. Verified by replaying the full failed-session body (6 messages + 33 tools).
- **0.8.4** (this fork): supports DSH 0.2.2-rc.2: the peer range gains `0.2.2-rc.2` (still an explicit enumeration, no carets), and the image-request count budgets 0.2.2 made required (`maxRequestImages` / `imageOffloadCountQuantum`, at the upstream defaults) are adopted; local builds and tests move to 0.2.2 dependencies (rc.1 for client packages with no rc.2 release). Loads in an isolated 0.2.2-rc.2 profile without an exemption, and a gateway conversation passed.
- **0.8.3** (this fork): widens compatibility to DSH 0.2.1-rc.3: the six DSH service peers now explicitly list `0.2.1-rc.2 || 0.2.1-rc.3` (still caret-free), and local builds and tests move to rc.3. 0.8.2 declared rc.2 only, so DSH's compatibility gate marked it "Problem" and refused to start it on rc.3; 0.8.3 loads in an isolated rc.3 profile without an exemption, and a gateway conversation passed.
- **0.8.2** (this fork): the CN default transport returns to the WorkBuddy gateway (`transport: gateway`), enabling the full DSH system prompt, tool calls, approval cards, and image input by default; gateway requests remain aligned with the official CodeBuddy CLI's wire format and clean the DSH identity and brand mentions to pass the channel check. The 0.8.0–0.8.1 CodeBuddy CLI text bridge remains as an explicit `transport: cli` and is no longer the default; users who relied on the CLI's sign-in alone must keep that setting.
- **0.8.1** (this fork): adds the optional CLI tool mode `cliTools` (still text-only by default): when enabled, the CodeBuddy CLI runs its own tool loop — executing commands and reading/writing files (`--tools default`, `--permission-mode` from `cliPermissionMode`, turn ceiling `cliMaxTurns`) — and the session working directory is applied to the CLI process; adds `cliCwd` for choosing that directory.
- **0.8.0** (this fork): adds `transport: cli` (the default in 0.8.0–0.8.1, optional since 0.8.2) so CN chat runs through the official CodeBuddy CLI under its own sign-in, avoiding the WorkBuddy gateway's unapproved-client rejection; keeps model selection and reasoning-effort forwarding; CLI mode registers the CN group only; `cliPath` / `cliTimeoutMs` are configurable and `transport: gateway` falls back. The CLI is a text bridge, so DSH tools and images never reach the model. Also fixes the legacy settings path dropping `transport` when merging section config.
- **0.7.9**: restores the international edition's maximum-context switch on DSH 0.2.1-rc.2, including delayed initialization and persistent settings (PR [#172](https://github.com/corrinehu/dsh-workbuddy-connect/pull/172), by @1Dreamer666); avoids fetch-blocked local ports that could cause international-edition 502 errors (PR [#164](https://github.com/corrinehu/dsh-workbuddy-connect/pull/164), by @Xiong-Ziyi); combines credit packages with the same name to reduce repeated entries.
- **0.7.8**: adapts to DSH 0.2.1-rc.2; bundles the official atomic-write helper instead of relying on host module exposure; refreshes the China catalog snapshot and distinguishes Hy3 / Hy3-X; improves probe result labels and fixes the credit-refresh placement and tooltip. Thanks to @chenpiyanghappy for PR [#156](https://github.com/corrinehu/dsh-workbuddy-connect/pull/156).
- **0.7.7**: adapts to the DSH 0.2.1-rc.1 core: peers narrow to 0.2.1-rc.1 and the plugin-bundled `@earendil-works/pi-ai` moves to 1.3.0 with it (a profile-level leftover 0.87.1 overrides entry must be removed, or the plugin fails to load).
- **0.7.6**: fixes enterprise accounts missing `glm-5.3-flashx` from the model catalog ([#123](https://github.com/corrinehu/dsh-workbuddy-connect/issues/123)), and fixes international chat requests being blocked by the upstream channel check ([#139](https://github.com/corrinehu/dsh-workbuddy-connect/issues/139) / [#142](https://github.com/corrinehu/dsh-workbuddy-connect/issues/142)).
- **0.7.5**: restores composer controls after session switching ([#125](https://github.com/corrinehu/dsh-workbuddy-connect/issues/125) / [#132](https://github.com/corrinehu/dsh-workbuddy-connect/issues/132)), fixes WSL helper environment forwarding ([#133](https://github.com/corrinehu/dsh-workbuddy-connect/issues/133)), and adds community projects to both READMEs.
- **0.7.4**: Windows diagnostics and stability improvements: accurate classification of oversized registry-subprocess output, cross-platform test-assumption fixes ([#62](https://github.com/corrinehu/dsh-workbuddy-connect/issues/62)), and a reworked install section.
- **0.7.3**: fixes Windows registry auto-discovery failing on non-default install paths ([#105](https://github.com/corrinehu/dsh-workbuddy-connect/issues/105)).
- **0.7.2**: pi-ai becomes a plugin-bundled dependency and rejected inference-field requests are fixed ([#92](https://github.com/corrinehu/dsh-workbuddy-connect/issues/92)); this release carries a Windows registry regression — use 0.7.4 or a newer stable release.
- **0.7.1**: narrows the pi-ai dependency range.
- **0.7.0**: adapts to DSH 0.2.0's settings-service rework and drops 0.1.x support.
- **0.6.5**: final release of the 0.1.x line.

Pinned-version install example: upstream npm `dsh plugin --profile web add dsh-workbuddy-connect@0.7.9`; this fork `dsh plugin --profile web add /path/to/workbuddy-connect` (local source) or `dsh plugin --profile web add github:leonty1/workbuddy-connect`.

**pi-ai versions are per core line and must not be mixed**: the 0.2.1-rc.1 / rc.2 core lines (plugin 0.7.7 / 0.7.8–0.7.9 respectively) moved to `@earendil-works/pi-ai` 1.3.0 (bundled by the plugin), so a profile-level leftover `overrides: {'@earendil-works/pi-ai': '0.87.1'}` **must be removed** or the plugin fails to load; the 0.2.0-rc.2 core line (plugin 0.7.6) still requires `^0.87.1` — on that line, **do not** upgrade the profile-level pi-ai to 1.x, and do not act on third-party plugin managers' "updatable" prompts, which do not check peer constraints ([#86](https://github.com/corrinehu/dsh-workbuddy-connect/issues/86)).

## Disclaimer

- This project is for **personal learning and research only**, driving your own WorkBuddy account on your own machine. Do not use it commercially or beyond reasonable personal use.
- Users must comply with the WorkBuddy terms of service. Any consequence of using this project (including but not limited to account restrictions, depleted credit, or service interruption) is borne by the user.
- The author is not liable for any direct or indirect loss arising from the use or misuse of this project.
- This project is not affiliated with, endorsed by, or sponsored by Tencent, WorkBuddy, or DeepSeek. Product names are used for compatibility description only; trademarks belong to their respective owners.

## Related Projects / Community Ecosystem

- **[dsh-buddy-checkin](https://github.com/corrinehu/dsh-buddy-checkin)**: a daily check-in plugin for the WorkBuddy China edition, maintained by this project's author.
- **[dsh-workbuddy-switcher](https://github.com/ddGuo/dsh-workbuddy-switcher)**: a community-maintained WorkBuddy account management and switching plugin.
- **[hana-workbuddy-connect](https://github.com/miaoyongxu/hana-workbuddy-connect)**: a community-maintained unofficial adapter project that reuses parts of the `dsh-workbuddy-connect` implementation to bring WorkBuddy / WorkBuddy AI models to HanaAgent.

See each project's documentation for supported versions and installation requirements. Except for `dsh-buddy-checkin`, these projects are independently maintained by third parties. Listing them here is not an official endorsement or a stability or compatibility commitment for this plugin's internal interfaces.

## Acknowledgements

- [corrinehu/dsh-workbuddy-connect](https://github.com/corrinehu/dsh-workbuddy-connect) (MIT) — the upstream project this fork is based on, providing the model catalog, account, settings, and client UI.
- [Sliverkiss/workbuddy2api](https://github.com/Sliverkiss/workbuddy2api) (MIT) — reference implementation of the WorkBuddy upstream protocol.
- [franksong2702/dsh-codex-connect](https://github.com/franksong2702/dsh-codex-connect) (Apache-2.0) — reference for the DSH plugin structure and provider registration.

## License

[MIT](./LICENSE)
