export class EventStream extends EventTarget {
  constructor() {
    super();
    this.stream = {};
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
      controller: new AbortController(),
      callback,
      id,
    };

    if (duration) {
      listener.timer = setTimeout(() => {
        this.removeListener(event, listener.id);
      }, duration);

      listener.controller.signal.onabort = () => {
        clearTimeout(listener.timer);
      };
    }

    // Tried setting callbackBundle to async to await listener.callback
    // Do we need that?
    // Is it just additional overhead for no benefit?
    // Will we ever set an asynchronous listener?
    const callbackBundle = ({ detail }) => {
      try {
        listener.callback(detail);
      } catch (error) {
        console.error(
          "Evenstream raiseEvent error:\nevent: %s %o\ncallback %s: %o\ndata: %o\nerror: %o",
          event,
          this.stream[event],
          listener.id,
          { callback },
          detail,
          error
        );
      } finally {
        if (once) {
          this.removeListener(event, listener.id);
        }
      }
    };

    // Store the callbackBundle for later reference
    listener.callbackBundle = callbackBundle;

    this.addEventListener(event, callbackBundle, {
      once,
      signal: listener.controller.signal,
    });

    listeners.set(id, listener);
  }

  raiseEvent(event, data) {
    //This batching method didn't function as intended. It delayed processing
    //of large blocks of text/GMCP received.
    /*
    // Batching events for frequent raises:
    //"Modern" version of setTimeout 0
    Promise.resolve().then(() => {
      this.dispatchEvent(new CustomEvent(event, { detail: data }));
    });
    
    setTimeout(() => {
      this.dispatchEvent(new CustomEvent(event, { detail: data }));
    }, 0);
    
    */
    this.dispatchEvent(new CustomEvent(event, { detail: data }));

    if (this.logging) {
      console.log(`eventStream event: ${event}`);
      console.log(`eventStream data: ${JSON.stringify(data)}`);
    }
  }

  removeListener(event, identifier) {
    const listeners = this.stream[event];
    if (!listeners) return false;

    let removed = false;

    if (typeof identifier === "string") {
      if (listeners.has(identifier)) {
        const listener = listeners.get(identifier);
        if (listener.timer) {
          clearTimeout(listener.timer);
        }
        listener.controller.abort();
        listeners.delete(identifier);
        removed = true;
        console.log(
          `eventStream: Removed listener ${identifier} from event ${event}.`
        );
      }
    } else if (typeof identifier === "function") {
      // Remove by function reference
      for (const [id, listener] of listeners) {
        if (listener.callback === identifier) {
          if (listener.timer) {
            clearTimeout(listener.timer);
          }
          listener.controller.abort();
          listeners.delete(id);
          removed = true;
          console.log(
            `eventStream: Removed listener ${id} from event ${event}.`
          );
          break; // Assuming IDs are unique, we can exit the loop
        }
      }
    }

    return removed;
  }

  getListener(event, id) {
    const listeners = this.stream[event];
    return listeners ? listeners.get(id) : undefined;
  }

  purge(event) {
    if (!event) {
      console.warn("eventStream: Attempted to purge invalid event");
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
