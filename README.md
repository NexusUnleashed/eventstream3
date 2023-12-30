# Event handling for Nexus 3.0

eventStream provides an interface for players to interact with system generated events as well as create and raise their own custom events.

For those new to "events", an easy way to think of them is like a centralized trigger. Each event in some ways is a virtual trigger, which you can attach numerous actions or "listeners" to. Some players may be familiar with using built in Nexus onGMCP functions. The onGMCP is an "event" that is firing on every GMCP message.

Many Nexus users create package with multiple onGMCP functions for various purposes. To check if an item is added to the room, if a player enters, the name of the room they are in. Using an event handler like eventStream a user has a centralized location to attach functions rather than duplicating onGMCP functions.

## API

### `stream`

The `stream` object holds the array of all registered events. Users can browse this object for all available events.

```js
eventStream.stream;
```

### `registerEvent(event, callback, once = false, duration = false)`

#### event: string name of the event.

#### callback: function to fire when event is raised.

#### once: boolean, listener will fire once and be removed (single fire).

#### duration: in miliseconds, listener will be live and then remove after elapsed time.

##### Users can register an anonymous function to the event. This can be useful for quick snippets or temporary event listeners.

```js
eventStream.registerEvent("testEvent", () => {
  console.log("arrow function");
});
```

##### Named functions can be more helpful for accessing the listener at a later time. Typically when a user wants to remove a listener from an event.

```js
const testFunction = () => {
  console.log("named arrow function");
};
eventStream.registerEvent("testEvent", testFunction);
```

##### Named functions can be more helpful for accessing the listener at a later time. Typically when a user wants to remove a listener from an event.

```js
const singleFire = () => {
  console.log("single fire event");
};
eventStream.registerEvent("testEvent", testFunction, true);
// Listener will only fire once after testEvent is raised. This listener will not be present for subsequent testEvent events.
```

### `raiseEvent(event)`

Events are string ids used to flag all associated listener functions to fire. By default all GMCP received from the server are raised as events. Users can add any number of additional events.

```js
eventStream.raiseEvent("testEvent");
/*
Expected console output based on previous examples:
arrow function
named arrow function
single fire event
*/
eventStream.raiseEvent("testEvent");
/*
Expected console output based on previous examples:
arrow function
named arrow function
*/
```

### `removeListener(event, callback id)`

Removes a listener from an event. Typical usage is by function name. Will also accept an integer representing the array position of the listener.

```js
eventStream.removeListener("testEvent", "testFunction");
eventStream.raiseEvent("testEvent");
/*
Expected console output based on previous examples:
arrow function
*/
```

### `purge(event)`

Removes all listeners from an event.

```js
eventStream.purge("testEvent");
```

## EXAMPLES

### Nexus GMCP event

The following is an example of a basic function tied to a GMCP event. This will wave to any player that enters the room. An example of the GMCP message from Nexus:

##### [GMCP]: Room.AddPlayer {"name":"Khaseem","fullname":"Khaseem"}

_note: Room.AddPlayer is sent by Nexus but is not a core server GMCP message_

With GMCP messages thse are raised automatically by eventStream as received. This event/listener will fire every time a player enters the room.

```js
const greetPlayer = (args) => {
  nexusclient.send_commands(`wave ${args.name}`);
};
eventStream.registerEvent("Room.AddPlayer", greetPlayer);
```

### custom event

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
You could have snippet of code for

```js
eventStream.raiseEvent("targetShield", { id: args[1] });
```

Now, someone may ask why not just place the code directly in the trigger? What purpose is the event servering here?

Both are viable paths. One benefit of an event handler in this scenario is any number of other packages could add on to the targetShield event. You may have a bashing package that cares when a target shields, but also a pvp package that cares as well. In a completely separate package you could add another listener:

```js
const razeTargetPVP = (args) => {
  nexusclient.send_commands(`queue addclear free raze ${myTargetVar}`);
};
eventStream.registerEvent("targetShield", razeTargetPVP);
```

### Packaged events

Many packages, like nexMap, nexSys, nexGui, create and handle a variety of custom events that users can tap into. nexSys for example will raise events for things like afflictions, defences, items, etc.

Check with the various packages for details.
