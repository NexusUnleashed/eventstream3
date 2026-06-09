# eventStream — Proposed Improvements

Standalone improvement proposals. Each is justified on its own merit as a
general-purpose package feature — **not** to facilitate any particular consumer.
Litmus test for inclusion: *would a consumer who has never heard of the calling
project still want this?*

---

## 1. Expiry callback for `duration` (`onExpire`)

### Summary

A listener registered with `duration` is **silently** auto-removed when the
window elapses. There is no signal to the subscriber. Proposal: an optional
`onExpire` callback fired when (and only when) a listener is removed because its
`duration` elapsed.

### Why this is universal (not consumer-specific)

Enumerating every way a listener is removed today, only one is unobservable by
the subscriber:

| Removal cause                                    | Subscriber can already observe it? |
|--------------------------------------------------|------------------------------------|
| `once` consumed                                  | Yes — their callback just ran      |
| manual `removeListener` / `removeByTag` / `purge`| Yes — they initiated it            |
| **`duration` elapsed**                           | **No — silent auto-removal**       |

So eventStream has exactly one observability gap, and it maps to a bedrock async
pattern: **subscription-with-timeout** — "auto-unsubscribe after a window, and
let me react if nothing arrived." Real, consumer-agnostic uses: a stale-data UI
badge when no update lands in time, an RPC-style "no reply" handler, expiry
metrics/logging. This is general infrastructure, not facilitation of any one
caller.

### Current behavior

[`src/base/EventStream.js`](src/base/EventStream.js), in `registerEvent` (~line 89):

```js
if (options.duration > 0) {
  listener.timer = setTimeout(() => {
    this.removeListener(event, id);   // silent — no callback, nothing raised
  }, options.duration);
}
```

When the timer fires, the listener vanishes with no notification.

### Proposed behavior

A new option `onExpire`, accepted only in the **options-object** form of
`registerEvent`. Signature: `onExpire(event, id)` — passes the event name and
listener ID so a single handler can manage several subscriptions. Fired **after**
removal, exactly once, only on `duration` expiry.

```js
eventStream.registerEvent("Target.Info", onInfo, {
  duration: 5000,
  onExpire: (event, id) => {
    console.warn(`No ${event} within 5s (listener ${id})`);
  },
});
```

- `onExpire` without a positive `duration` never fires (optionally warn under
  `this.logging`).
- It does **not** fire on `once` consumption, manual `removeListener`,
  `removeByTag`, `purge`, or replacement — those are all caller-initiated and
  already observable.

### Implementation sketch

Contained to [`EventStream.js`](src/base/EventStream.js):

1. **`_normalizeRegistrationOptions`** — destructure `onExpire` from the options
   object and include it in the returned options. (Legacy positional signature is
   intentionally **not** extended; the README already steers callers to the
   options form.)

2. **Listener record** (the `const listener = { ... }` object) — store
   `onExpire: typeof options.onExpire === "function" ? options.onExpire : null`.

3. **Duration timer** — capture the callback in a local, remove the listener,
   then invoke it (after removal, guarded):
   ```js
   if (options.duration > 0) {
     listener.timer = setTimeout(() => {
       const onExpire = listener.onExpire;
       this.removeListener(event, id);
       if (onExpire) {
         try {
           onExpire(event, id);
         } catch (error) {
           console.error(
             "EventStream onExpire error:\nevent: %s\nlistener ID: %s\nerror: %o",
             event, id, error,
           );
         }
       }
     }, options.duration);
   }
   ```
   Firing after `removeListener` keeps the listener fully torn down before the
   handler runs (no re-entrancy on a half-removed listener). `_cleanupListener`
   nulls `callback` but the local capture of `onExpire` is unaffected.

### Tests to add

In [`src/tests/eventStream.test.js`](src/tests/eventStream.test.js) (use fake timers):

- `duration` elapses → `onExpire(event, id)` fires once with the correct args,
  and the listener is gone afterward.
- A listener that **fires before** its `duration` (`once: true`, then raised)
  does **not** also fire `onExpire`.
- Manual `removeListener`, `removeByTag`, `purge`, and replacement do **not** fire
  `onExpire`.
- `onExpire` provided without `duration` never fires.

### Out of scope (flagged, not recommended now)

- **Full lifecycle-hook parity** (`onEnable`/`onDisable`/`onRemove`). The only
  non-caller-initiated removal is `duration` expiry; the rest are already
  observable. General hooks would add weight to removal paths (and the
  once-consume path inside `raiseEvent`) for no real consumer. Keep the surface to
  the single genuine gap: `onExpire`.

### Relationship to the Timer API

This is complementary to, not redundant with, the existing `Timer`
([`src/base/Timer.js`](src/base/Timer.js)) and its `timerStarted/Stopped/Reset`
events. `Timer` is an explicit, named, queryable countdown; `onExpire` is the
lightweight inline "this subscription timed out" signal attached to a listener
you were registering anyway. They serve different ergonomics.

### Docs

Update [`README.md`](README.md) `registerEvent` options list to document
`onExpire`, noting it is options-form only and fires solely on `duration` expiry.
