# Event handling for Nexus 3.0

eventStream provides an interface for players to interact with system generated events as well as create and raise their own custom events.

For those new to "events", an easy way to think of them is like a centralized trigger. Each event in some ways is a virtual trigger, which you can attach numerous actions or "listeners" to. Some players may be familiar with using built in Nexus onGMCP functions. The onGMCP is an "event" that is firing on every GMCP message.

Many Nexus users create package with multiple onGMCP functions for various purposes. To check if an item is added to the room, if a player enters, the name of the room they are in. Using an event handler like eventStream a user has a centralized location to attach functions rather than duplicating onGMCP functions.

## API

### `stream`

`stream` is an object keyed by event name. Each value is a `Map` keyed by listener ID.
Event keys are automatically removed when their last listener is removed.

```js
eventStream.stream;
```

### `registerEvent(event, callback, options?)`

#### event: string name of the event.

#### callback: function to fire when event is raised.

#### options (recommended object form):

- `once` (boolean): listener fires once, then is removed.
- `duration` (number): listener is automatically removed after N milliseconds. Must be a non-negative finite number.
- `id` (string): explicit listener ID.
- `tags` (string[]): metadata for batch removal with `removeByTag`.

If a listener is registered with an ID that already exists on the same event, the old listener is replaced.
This replacement is deterministic even during an active dispatch: the replacement will not run until the next `raiseEvent`.

```js
eventStream.registerEvent("testEvent", onTest, {
  once: false,
  duration: 5000,
  id: "my-listener-id",
  tags: ["combat", "tracking"],
});
```

#### legacy signature (still supported):

```js
eventStream.registerEvent(event, callback, once, duration, id, tags);
```

##### Users can still register anonymous functions for quick snippets.

```js
eventStream.registerEvent("testEvent", () => {
  console.log("arrow function");
});
```

##### Named or explicit-ID listeners are easier to remove later.

```js
const testFunction = (args) => {
  console.log("named arrow function");
};
eventStream.registerEvent("testEvent", testFunction, {
  id: "testFunction",
});
```

### `raiseEvent(event, data?)`

Raises an event by string ID and passes `data` to each listener as `(data, eventName)`.
Listeners added during an active dispatch are deferred until the next raise.
Listeners removed, disabled, or replaced before their turn are skipped deterministically.

```js
eventStream.raiseEvent("testEvent", { some: "payload" });
```

### `removeListener(event, identifier)`

Removes one listener using either:

- listener ID (`string`)
- callback reference (`function`)

Returns `true` if a listener was removed, otherwise `false`.

```js
eventStream.removeListener("testEvent", "testFunction");
```

### `removeByTag(tags)`

Removes listeners across all events that contain **all** provided tags.
Returns the number of listeners removed.

```js
eventStream.removeByTag(["combat", "tracking"]);
```

### `getListener(event, id)`

Returns the listener object or `undefined`.

### `enableListener(event, id)` / `disableListener(event, id)`

Enable or disable a listener without removing it.
Both methods return `true` when the listener exists and `false` otherwise.

### `hasListeners(event)`

Returns `true` if an event currently has one or more listeners.

### `debugListeners(event)`

Returns a simplified list of listeners with metadata:
`id`, `enabled`, `tags`, and `once`.

### `purge(event | "ALL")`

Removes all listeners from an event.
Returns number of listeners removed.

```js
eventStream.purge("testEvent");
eventStream.purge("ALL");
```

### `gmcpHandler()` / `gmcpHandlerRaw(gmcp)`

`gmcpHandler()` processes queued `gmcpBackLog` items, updates `GMCP`, and raises events.
`gmcpHandlerRaw(gmcp)` handles one GMCP payload directly.

`gmcpHandler()` is safe against synchronous re-entry: if a listener calls it while a batch is already being processed, the current batch continues and any queued follow-up GMCP messages are drained once.

## Timer API

`eventStream.createTimer(name, lengthSeconds)` creates a timer bound to the current `eventStream` instance.
Timer length is measured in seconds.

Timers raise these events:

- `timerStarted<id>`
- `timerStopped<id>`
- `timerReset<id>`

`reset()` clears elapsed state and restores the timer to its default length.

## GMCP behavior

By default, GMCP messages are raised as events by `gmcp_method`.

Example GMCP:

```text
[GMCP]: Room.AddPlayer {"name":"Khaseem","fullname":"Khaseem"}
```

## EXAMPLES

### Nexus GMCP event

```js
const greetPlayer = (args) => {
  nexusclient.send_commands(`wave ${args.name}`);
};
eventStream.registerEvent("Room.AddPlayer", greetPlayer, {
  id: "greetPlayer",
});
```

### Custom event

Any number of events can be created. The only requirement is a unique event id.

```js
const shieldNotice = (args) => {
  if (args.id === GMCP.Target.Text) {
    nexusclient.display_notice("MY TARGET HAS SHIELDED!!!!");
  }
};
eventStream.registerEvent("targetShield", shieldNotice);
```

Then in a Nexus trigger for ^A nearly invisible magical shield forms around (.\*)\\.$
you could have:

```js
eventStream.raiseEvent("targetShield", { id: args[1] });
```

One benefit of the event pattern is that multiple packages can subscribe to the same event without sharing trigger logic.

```js
const razeTargetPVP = (args) => {
  nexusclient.send_commands(`queue addclear free raze ${myTargetVar}`);
};
eventStream.registerEvent("targetShield", razeTargetPVP);
```

### Packaged events

Many packages, like nexMap, nexSys, nexGui, create and handle a variety of custom events that users can tap into. nexSys for example will raise events for things like afflictions, defences, items, etc.

Check with the various packages for details.
