# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server for the React shell (entry: [src/main.jsx](src/main.jsx)). The shell exists only to exercise the library in a browser; the user-facing artifact is the bundle.
- `npm run build` — Builds the React shell into `build/` (gh-pages target).
- `npm run build:bundle` — Builds the **library** as a non-minified-name IIFE (`terser` with `mangle:false`, `keep_fnames:true`) into [dist/bundle.min.js](dist/bundle.min.js). This is what gets published to unpkg as `nexevent` and loaded by the Nexus client.
- `npm test` — Runs the Vitest suite once (jsdom environment, globals enabled).
- `npm run test:watch` — Vitest watch mode.
- Single test: `npx vitest run -t "listener added during dispatch"` (substring match against `test()` names in [src/tests/eventStream.test.js](src/tests/eventStream.test.js)).
- `npm run deploy` — `predeploy` runs `npm run build`, then `gh-pages -d build`.

There is no separate lint script; `.eslintrc.json` only enforces `semi`.

## Architecture

This repo ships a single library — an event bus for the Nexus 3.0 MUD client — wrapped in a Vite/React dev shell. The two build modes in [vite.config.js](vite.config.js) produce different artifacts from different entries:

| Mode | Entry | Output | Purpose |
|---|---|---|---|
| default | [src/main.jsx](src/main.jsx) | `build/` | React dev shell for local browser testing |
| `bundle` | [src/eventstream.js](src/eventstream.js) | `dist/bundle.min.js` (IIFE, name `eventStreamBundle`) | The actual library, consumed by the `.nxs` package via unpkg |

### Load path (production)

[dist/eventStream3.nxs](dist/eventStream3.nxs) is a Nexus package descriptor. Its `onLoad` function dynamically imports `https://unpkg.com/nexevent/bundle.min.js`, which executes [src/eventstream.js](src/eventstream.js). That entry:

1. Attaches `EventStream` (class) and `eventStream` (singleton) to `globalThis`.
2. Wraps `nexusclient.process_lines` with a re-entrant-safe replacement that runs triggers per-line and invokes `onBlock` once per block (the `__eventStreamOverrideApplied` flag prevents double-patching). The block override is gated to skip if `nexusclient.charname === "khaseem"` — this is intentional: the package author runs an un-overridden client locally.
3. Fetches and applies an updated `.nxs` payload from unpkg so installed copies self-update.

`onGMCP` in the `.nxs` pushes raw GMCP onto `eventStream.gmcpBackLog` and calls `gmcpHandler()`; `onBlock` raises a `PromptEvent`. Downstream packages (`nexAction`, `nexSkills`, `nexMap`, `nexSys`, `nexGui`) listen via `registerEvent`. The `esLoad` reflex is the **post-eventStream init hook** other packages should use — they must not assume `eventStream` exists at their own `onLoad`.

### EventStream internals ([src/base/EventStream.js](src/base/EventStream.js))

- Listeners live in `this._events[event].listeners` (a `Map`). `this.stream` is a public mirror exposing the same `Map` references, so external code that reads `eventStream.stream` sees live data.
- **Dispatch uses a per-bucket snapshot**, lazily built and invalidated on any add/remove. This produces deterministic behavior during re-entrant dispatch:
  - Listeners added during a `raiseEvent` are deferred to the next raise (they aren't in the snapshot).
  - Listeners removed, disabled, or replaced before their slot runs are skipped — the loop re-fetches the current listener by ID and compares identity (`current !== listener`) before invoking.
  - A `once` listener is marked `enabled = false` *before* invocation, then removed in `finally` only if still the same instance, so a replacement registered inside the callback survives.
- `gmcpHandler()` is guarded by `_processingGmcp` against synchronous re-entry: if a listener triggers another `gmcpHandler()` call mid-batch, the nested call returns `null` and the outer loop continues. The backlog is drained (`length = 0`) in `finally`.
- `setAtString` (writes GMCP payloads into `globalThis.GMCP` by dotted path) explicitly rejects `__proto__` / `constructor` / `prototype` keys — preserve this when editing.

### Listener registration signatures

[src/base/EventStream.js](src/base/EventStream.js) accepts **both** signatures and several tests still use the legacy positional form:

```js
registerEvent(event, callback, { once, duration, id, tags })   // preferred
registerEvent(event, callback, once, duration, id, tags)       // legacy, still supported
```

`_normalizeRegistrationOptions` distinguishes them by checking whether the 3rd arg is a plain object. Don't remove the legacy branch without auditing the test file and any downstream Nexus packages.

Listener IDs default to `callback.name`, falling back to `crypto.randomUUID()` (or a sequence counter). Because `terser` is configured with `keep_fnames: true` in bundle mode specifically to keep these IDs stable, avoid changes that would require enabling mangling.

### Timer ([src/base/Timer.js](src/base/Timer.js))

`createTimer(name, lengthSeconds, emitter)` returns a `Timer` bound to an `EventStream`. Lengths are seconds (converted to ms internally); events raised are `timerStarted<id>`, `timerStopped<id>`, `timerReset<id>`. The default export is the factory, not the class.

## Conventions worth knowing

- The library mutates `globalThis` on import (`EventStream`, `eventStream`, `GMCP`). Tests must reset this state — see the `beforeEach`/`afterEach` in [src/tests/eventStream.test.js](src/tests/eventStream.test.js) which stubs `crypto.randomUUID`, purges all listeners, and resets `_listenerSequence` and `_processingGmcp`.
- `.eslintrc.json` declares `globalThis: "off"` — refer to it explicitly rather than relying on it being implicitly global.
- When bumping the version in [package.json](package.json), also update `version` in both [dist/package.json](dist/package.json) and the `__meta` function inside [dist/eventStream3.nxs](dist/eventStream3.nxs); these are published together.
