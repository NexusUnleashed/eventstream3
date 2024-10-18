export class EventStream {
  constructor() {
    this.stream = {}; // Using plain object for events
    this.gmcpBackLog = [];
    this.logging = false;
  }

  registerEvent(event, callback, once = false, duration = false, id) {
    // Determine the listener ID
    if (!id) {
      if (callback.name) {
        id = callback.name;
      } else {
        id = crypto.randomUUID();
      }
    }

    if (!this.stream[event]) {
      this.stream[event] = new Map();
    }

    const listeners = this.stream[event];

    // Remove existing listener with the same ID
    if (listeners.has(id)) {
      this.removeListener(event, id);
    }

    const listener = {
      callback,
      once,
      id,
    };

    if (duration) {
      listener.timer = setTimeout(() => {
        this.removeListener(event, id);
      }, duration);
    }

    listeners.set(id, listener);
  }

  raiseEvent(event, data) {
    const listeners = this.stream[event];
    if (!listeners) return;

    for (const [id, listener] of listeners) {
      try {
        listener.callback(data);
      } catch (error) {
        console.error(
          `EventStream raiseEvent error:
Event: ${event}
Listener ID: ${id}
Data:`,
          data,
          `\nError:`,
          error
        );
      } finally {
        if (listener.once) {
          this.removeListener(event, id);
        }
      }
    }

    if (this.logging) {
      console.log(`EventStream event: ${event}`);
      console.log(`EventStream data: ${JSON.stringify(data)}`);
    }
  }

  removeListener(event, identifier) {
    const listeners = this.stream[event];
    if (!listeners) return false;

    let removed = false;

    if (typeof identifier === "string") {
      // Remove by ID or function name
      if (listeners.has(identifier)) {
        const listener = listeners.get(identifier);
        if (listener.timer) {
          clearTimeout(listener.timer);
        }
        listeners.delete(identifier);
        removed = true;
        console.log(
          `EventStream: Removed listener ${identifier} from event ${event}.`
        );
      }
    } else if (typeof identifier === "function") {
      // Remove by function reference
      for (const [id, listener] of listeners) {
        if (listener.callback === identifier) {
          if (listener.timer) {
            clearTimeout(listener.timer);
          }
          listeners.delete(id);
          removed = true;
          console.log(
            `EventStream: Removed listener ${id} from event ${event}.`
          );
          break; // Assuming IDs are unique, we can exit the loop
        }
      }
    }

    if (listeners.size === 0) {
      delete this.stream[event];
    }

    return removed;
  }

  getListener(event, id) {
    const listeners = this.stream[event];
    return listeners ? listeners.get(id) : undefined;
  }

  purge(event) {
    if (!event) {
      console.warn("EventStream: Attempted to purge invalid event");
      return;
    }

    if (event === "ALL") {
      for (const eventName in this.stream) {
        const listeners = this.stream[eventName];
        for (const [id] of listeners) {
          this.removeListener(eventName, id);
        }
      }
      this.stream = {};
    } else if (this.stream[event]) {
      const listeners = this.stream[event];
      for (const [id] of listeners) {
        this.removeListener(event, id);
      }
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
