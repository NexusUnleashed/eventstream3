export class EventStream extends EventTarget {
  constructor() {
    super();
    this.stream = {};
    this.gmcpBackLog = [];
    this.logging = false;
  }

  registerEvent(event, callback, once = false, duration = false) {
    if (!this.stream[event]) {
      this.stream[event] = [];
    }

    const listener = {
      callback: callback,
      once: once,
      id: crypto.randomUUID(),
    };

    if (duration) {
      listener.timer = setTimeout(() => {
        this.removeListener(event, callback.name);
      }, duration);
    }

    if (callback.name) {
      this.removeListener(event, callback.name);
    }

    this.stream[event].push(listener);
  }

  raiseEvent(event, data) {
    const streamEvent = this.stream[event];
    if (!streamEvent) return;

    streamEvent.forEach((listener) => {
      try {
        listener.callback(data);
      } catch (error) {
        console.error(
          "Evenstream raiseEvent error:\nevent: %s %o\ncallback %s: %o\ndata: %o\nerror: %o",
          event,
          streamEvent,
          listener.callback.name,
          { callback },
          detail,
          error
        );
      } finally {
        if (listener.once) {
          this.removeListener(event, listener.callback.name);
        }
      }
    });

    if (this.logging) {
      console.log(`eventStream event: ${event}`);
      console.log(`eventStream data: ${JSON.stringify(data)}`);
    }
  }

  removeListener(event, listener) {
    const streamEvent = this.stream[event];
    if (!streamEvent) return;

    const clearListener = (index) => {
      //Stop and remove any timer on the listener
      clearTimeout(streamEvent[index].timer);
      // Remove from stream
      streamEvent.splice(index, 1);
    };

    if (typeof listener === "string") {
      const listenerIndex = streamEvent.findIndex(
        (e) => e.callback.name === listener
      );

      if (listenerIndex >= 0) {
        clearListener(listenerIndex);
      } else {
        return false;
      }
    } else if (Number.isInteger(listener) && listener < streamEvent.length) {
      clearListener(listener);
    } else {
      const index = streamEvent.findIndex((e) => e.callback === listener);
      if (index >= 0) {
        clearListener(index);
      }
    }

    console.log(`eventStream: Removed event ${listener} on event ${event}.`);
  }

  getListener(event, id) {
    return this.stream[event]?.find((e) => e.callback.name === id);
  }

  purge(event) {
    if (!event) {
      console.log("eventStream: attempted to purge invalid event");
      return;
    }

    if (event === "ALL") {
      for (const ev in this.stream) {
        this.stream[ev].forEach((cb) =>
          this.removeListener(ev, cb.callback.name)
        );
      }
      this.stream = {};
    } else if (this.stream[event]) {
      this.stream[event].forEach((callback) => callback.controller.abort());
      this.stream[event] = [];
    }
  }

  gmcpHandler() {
    while (this.gmcpBackLog.length > 0) {
      const currentArgs = this.gmcpBackLog.shift();
      if (currentArgs.gmcp_method) {
        setAtString(
          globalThis.GMCP,
          currentArgs.gmcp_method.split("."),
          currentArgs.gmcp_args
        );
        this.raiseEvent(currentArgs.gmcp_method, currentArgs.gmcp_args);
      }
    }
  }

  gmcpHandlerRaw(gmcp) {
    if (gmcp.gmcp_method) {
      setAtString(globalThis.GMCP, gmcp.gmcp_method.split("."), gmcp.gmcp_args);
      this.raiseEvent(gmcp.gmcp_method, gmcp.gmcp_args);
    }
  }
}

const setAtString = (obj, dotarr, val) => {
  let current = obj;
  for (let i = 0; i < dotarr.length - 1; i++) {
    const key = dotarr[i];
    current[key] = current[key] || {};
    current = current[key];
  }

  const lastKey = dotarr[dotarr.length - 1];
  if (typeof val === "object" && !Array.isArray(val)) {
    current[lastKey] = Object.assign(current[lastKey] || {}, val);
  } else {
    current[lastKey] = val;
  }
};
