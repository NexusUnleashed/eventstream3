export class EventStream extends EventTarget {
  constructor() {
    super();
    this.stream = {};
    this.gmcpBackLog = [];
    this.logging = false;
  }

  /**
   * Register an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @param {Object|boolean} [onceOrOptions=false] - Options object or legacy boolean
   * @param {boolean} [onceOrOptions.once=false] - Remove listener after first invocation
   * @param {number} [onceOrOptions.duration] - Auto-remove after duration (ms)
   * @param {string} [onceOrOptions.id] - Explicit listener ID (recommended for bundled code)
   * @param {string[]} [onceOrOptions.tags=[]] - Tags for batch operations
   * @param {boolean} [durationParam=false] - Legacy: duration parameter
   * @param {string} [idParam] - Legacy: ID parameter
   * @param {string[]} [tagsParam=[]] - Legacy: tags parameter
   * @returns {string} The listener ID
   */
  registerEvent(
    event,
    callback,
    onceOrOptions = false,
    durationParam = false,
    idParam,
    tagsParam = []
  ) {
    // Validate inputs
    this._validateEventName(event);
    if (typeof callback !== "function") {
      throw new TypeError("Callback must be a function");
    }

    let once = false;
    let duration = false;
    let id;
    let tags = [];

    // Parse arguments based on usage pattern
    if (arguments.length === 2) {
      // Modern style with defaults
    } else if (this._isOptionsObject(onceOrOptions)) {
      // Modern style with options
      ({ once = false, duration = false, id, tags = [] } = onceOrOptions);
    } else {
      // Legacy style - warn in logging mode
      if (this.logging) {
        console.warn(
          `eventStream: Deprecated registerEvent signature for "${event}". ` +
            `Use: registerEvent(event, callback, { once, duration, id, tags })`
        );
      }
      once = onceOrOptions ?? false;
      duration = durationParam ?? false;
      id = idParam;
      tags = tagsParam ?? [];
    }

    // Determine listener ID
    if (!id) {
      if (callback.name) {
        id = callback.name;
        if (this.logging) {
          console.warn(
            `eventStream: Using function name "${id}" as listener ID. ` +
              `This may break with bundler minification. Consider explicit ID.`
          );
        }
      } else {
        id = crypto.randomUUID();
      }
    }

    // Initialize event map if needed
    if (!this.stream[event]) {
      this.stream[event] = new Map();
    }

    const listeners = this.stream[event];

    // Remove existing listener with same ID
    if (listeners.has(id)) {
      if (this.logging) {
        console.warn(
          `eventStream: Replacing existing listener "${id}" on event "${event}"`
        );
      }
      this.removeListener(event, id);
    }

    // Create listener object
    const listener = {
      controller: new AbortController(),
      callback,
      id,
      enabled: true,
      tags: Array.isArray(tags) ? tags : [],
    };

    // Set up duration timer if specified
    if (duration && typeof duration === "number" && duration > 0) {
      listener.timer = setTimeout(() => {
        this.removeListener(event, id);
      }, duration);

      // Clean up timer on abort
      listener.controller.signal.addEventListener(
        "abort",
        () => {
          if (listener.timer) {
            clearTimeout(listener.timer);
          }
        },
        { once: true }
      );
    }

    // Create callback bundle with fresh lookup
    const callbackBundle = ({ detail }) => {
      const currentListener = this.stream[event]?.get(id);
      if (!currentListener || !currentListener.enabled) {
        return;
      }

      try {
        currentListener.callback(detail, event);
      } catch (error) {
        console.error(
          "EventStream raiseEvent error:\nevent: %s\ncallback ID: %s\ndata: %o\nerror: %o",
          event,
          id,
          detail,
          error
        );
      } finally {
        if (once && this.stream[event]?.has(id)) {
          this.removeListener(event, id);
        }
      }
    };

    listener.callbackBundle = callbackBundle;

    // Register with native EventTarget
    this.addEventListener(event, callbackBundle, {
      once,
      signal: listener.controller.signal,
    });

    listeners.set(id, listener);

    if (this.logging) {
      console.log(
        `eventStream: Registered listener "${id}" for event "${event}"` +
          (once ? " (once)" : "") +
          (duration ? ` (${duration}ms)` : "")
      );
    }

    return id;
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
    if (!listeners || listeners.size === 0) {
      if (this.logging && !listeners) {
        console.warn(`eventStream: No listeners found for event "${event}"`);
      }
      return false;
    }

    let removed = false;
    let listener;

    if (typeof identifier === "string") {
      listener = listeners.get(identifier);
      if (listener) {
        this._cleanupListener(event, identifier, listener); // FIX: Use identifier, not id
        listeners.delete(identifier);
        removed = true;

        if (this.logging) {
          console.log(
            `eventStream: Removed listener ${identifier} from event ${event}.`
          );
        }
      } else if (this.logging) {
        const availableIds = Array.from(listeners.keys());
        console.warn(
          `eventStream: Listener "${identifier}" not found for event "${event}". ` +
            `Available IDs: ${availableIds.join(", ")}`
        );
      }
    } else if (typeof identifier === "function") {
      // Remove by function reference
      for (const [id, l] of listeners) {
        if (l.callback === identifier) {
          this._cleanupListener(event, id, l);
          listeners.delete(id);
          removed = true;

          if (this.logging) {
            console.log(
              `eventStream: Removed listener ${id} from event ${event}.`
            );
          }
          break;
        }
      }
    }

    // Keep the Map even if empty to maintain consistency with tests
    // The Map will be cleaned up when new listeners are added or on purge

    return removed;
  }

  /**
   * Internal cleanup method to avoid code duplication
   * @private
   */
  _cleanupListener(event, id, listener) {
    if (listener.timer) {
      clearTimeout(listener.timer);
    }

    // Remove event listener BEFORE aborting to ensure cleanup
    this.removeEventListener(event, listener.callbackBundle);

    // Abort the controller
    listener.controller.abort();

    // Defensive: disable and nullify callback
    listener.enabled = false;
    listener.callback = null;
    listener.callbackBundle = null;
  }

  removeByTag(event, tag) {
    const listeners = this.stream[event];
    if (!listeners || listeners.size === 0) return 0;

    // Collect IDs first to avoid modifying during iteration
    const idsToRemove = [];
    for (const [id, l] of listeners) {
      if (l.tags?.includes(tag)) {
        idsToRemove.push(id);
      }
    }

    // Remove in batch
    for (const id of idsToRemove) {
      this.removeListener(event, id);
    }

    return idsToRemove.length;
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

  hasListeners(event) {
    const listeners = this.stream[event];
    return !!(listeners && listeners.size);
  }

  debugListeners(event) {
    const listeners = this.stream[event];
    if (!listeners) return [];
    return Array.from(listeners.values()).map((l) => ({
      id: l.id,
      enabled: l.enabled,
      tags: l.tags,
      once: !!l.once,
    }));
  }

  purge(event) {
    if (!event) {
      console.warn("eventStream: Attempted to purge invalid event");
      return 0;
    }

    let count = 0;

    if (event === "ALL") {
      // Use Object.keys for better performance on large objects
      const events = Object.keys(this.stream);
      for (const eventName of events) {
        const listeners = this.stream[eventName];
        if (listeners) {
          // Convert to array first to avoid modification during iteration
          const ids = Array.from(listeners.keys());
          for (const id of ids) {
            this.removeListener(eventName, id);
            count++;
          }
        }
      }
      this.stream = {};
    } else if (this.stream[event]) {
      const listeners = this.stream[event];
      const ids = Array.from(listeners.keys());
      for (const id of ids) {
        this.removeListener(event, id);
        count++;
      }
    }

    return count; // Return count for debugging
  }

  gmcpHandler() {
    const errors = [];

    while (this.gmcpBackLog.length > 0) {
      const currentArgs = this.gmcpBackLog.shift();

      try {
        if (currentArgs?.gmcp_method) {
          setAtString(
            globalThis.GMCP,
            currentArgs.gmcp_method.split("."),
            currentArgs.gmcp_args
          );
          this.raiseEvent(currentArgs.gmcp_method, currentArgs.gmcp_args);
        } else {
          console.warn(
            "eventStream: Invalid GMCP data in backlog:",
            currentArgs
          );
        }
      } catch (error) {
        console.error("eventStream: GMCP handler error:", error, currentArgs);
        errors.push({ error, data: currentArgs });
      }
    }

    return errors.length > 0 ? errors : null;
  }

  gmcpHandlerRaw(gmcp) {
    if (!gmcp?.gmcp_method) {
      console.warn("eventStream: Invalid GMCP data:", gmcp);
      return false;
    }

    try {
      setAtString(globalThis.GMCP, gmcp.gmcp_method.split("."), gmcp.gmcp_args);
      this.raiseEvent(gmcp.gmcp_method, gmcp.gmcp_args);
      return true;
    } catch (error) {
      console.error("eventStream: GMCP raw handler error:", error, gmcp);
      return false;
    }
  }

  /**
   * Validates event names to prevent common errors
   * @private
   */
  _validateEventName(event) {
    if (!event || typeof event !== "string") {
      throw new TypeError("Event name must be a non-empty string");
    }

    // Prevent accidental DOM events
    const domEvents = ["click", "load", "error", "focus", "blur"];
    if (domEvents.includes(event.toLowerCase())) {
      console.warn(
        `eventStream: Using DOM event name "${event}" may cause confusion. ` +
          `Consider using a namespaced name like "app:${event}"`
      );
    }

    return true;
  }

  /**
   * Type guard for options object
   * @private
   */
  _isOptionsObject(value) {
    return (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      !(value instanceof RegExp)
    );
  }
}

const setAtString = (obj, dotarr, val) => {
  if (!obj || typeof obj !== "object") {
    throw new TypeError("Target must be an object");
  }

  if (!Array.isArray(dotarr) || dotarr.length === 0) {
    throw new TypeError("Path must be a non-empty array");
  }

  let current = obj;

  for (let i = 0; i < dotarr.length - 1; i++) {
    const key = dotarr[i];

    // Protect against prototype pollution
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error(`Forbidden key: ${key}`);
    }

    // Create intermediate objects if needed
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }

  const lastKey = dotarr[dotarr.length - 1];

  // Protect against prototype pollution
  if (
    lastKey === "__proto__" ||
    lastKey === "constructor" ||
    lastKey === "prototype"
  ) {
    throw new Error(`Forbidden key: ${lastKey}`);
  }

  if (typeof val === "object" && val !== null && !Array.isArray(val)) {
    current[lastKey] = Object.assign(current[lastKey] || {}, val);
  } else {
    current[lastKey] = val;
  }
};
