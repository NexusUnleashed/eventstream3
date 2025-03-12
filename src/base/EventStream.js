export class EventStream extends EventTarget {
  constructor() {
    super();
    this.stream = {};
    this.gmcpBackLog = [];
    this.logging = false;
  }

  registerEvent(
    event,
    callback,
    onceOrOptions = false, // could be boolean or object
    durationParam = false,
    idParam,
    tagsParam = []
  ) {
    let once;
    let duration;
    let id;
    let tags;
    let enabled = true;

    // Case 1: Only two arguments => new style with defaults
    if (arguments.length === 2) {
      // nothing to do here; all defaults remain
    }

    // Case 2: Third argument is an options object => new style
    else if (typeof onceOrOptions === "object" && onceOrOptions !== null) {
      const {
        once: onceOption = false,
        duration: durationOption = false,
        id: idOption,
        tags: tagsOption = [],
      } = onceOrOptions;

      once = onceOption;
      duration = durationOption;
      id = idOption;
      tags = tagsOption;
    }

    // Case 3: Old-style usage => interpret positional parameters
    else {
      console.log(
        `eventStream.registerEvent() deprecated call ${event}, ${
          idParam || callback.name
        }`
      );
      once = onceOrOptions ?? false;
      duration = durationParam ?? false;
      id = idParam;
      tags = tagsParam ?? [];
    }

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
      enabled: enabled,
      tags: tags,
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
        if (listener.enabled) {
          listener.callback(detail, event);
        }
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

    //Remove any events with no listeners attached.
    /*if (listeners.size === 0) {
      delete this.stream[event];
    }*/

    return removed;
  }

  getListener(event, id) {
    const listeners = this.stream[event];
    return listeners ? listeners.get(id) : undefined;
  }

  enableListener(event, id) {
    const listener = this.getListener(event, id);
    if (listener) {
      listener.enabled = true;
    } else {
      console.warn(
        `eventStream: Attempted to enable invalid listener ${id} for event ${event}`
      );
    }
  }

  disableListener(event, id) {
    const listener = this.getListener(event, id);
    if (listener) {
      listener.enabled = false;
    } else {
      console.warn(
        `eventStream: Attempted to disable invalid listener ${id} for event ${event}`
      );
    }
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
