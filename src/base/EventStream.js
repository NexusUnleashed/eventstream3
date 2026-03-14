const DOM_EVENT_NAMES = new Set(["click", "load", "error", "focus", "blur"]);
const FORBIDDEN_GMCP_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const createRegistry = () => Object.create(null);

const hasAllTags = (listenerTags, tags) => {
  if (!listenerTags) {
    return false;
  }

  for (let i = 0; i < tags.length; i += 1) {
    if (!listenerTags.has(tags[i])) {
      return false;
    }
  }

  return true;
};

export class EventStream {
  constructor() {
    this.stream = createRegistry();
    this._events = createRegistry();
    this.gmcpBackLog = [];
    this.logging = false;
    this._listenerSequence = 0;
    this._processingGmcp = false;
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
    this._validateEventName(event);
    if (typeof callback !== "function") {
      throw new TypeError("Callback must be a function");
    }

    const options = this._normalizeRegistrationOptions(
      event,
      onceOrOptions,
      durationParam,
      idParam,
      tagsParam,
      arguments.length
    );
    const id = this._resolveListenerId(callback, options.id);
    const bucket = this._getOrCreateBucket(event);

    if (bucket.listeners.has(id)) {
      if (this.logging) {
        console.warn(
          `eventStream: Replacing existing listener "${id}" on event "${event}"`
        );
      }
      this.removeListener(event, id);
    }

    const listener = {
      callback,
      id,
      enabled: true,
      once: options.once,
      tags: options.tags.length > 0 ? new Set(options.tags) : null,
      timer: 0,
    };

    if (options.duration > 0) {
      listener.timer = setTimeout(() => {
        this.removeListener(event, id);
      }, options.duration);
    }

    bucket.listeners.set(id, listener);
    bucket.snapshot = null;

    if (this.logging) {
      console.log(
        `eventStream: Registered listener "${id}" for event "${event}"` +
          (listener.once ? " (once)" : "") +
          (options.duration > 0 ? ` (${options.duration}ms)` : "")
      );
    }

    return id;
  }

  raiseEvent(event, data) {
    const bucket = this._events[event];

    if (!bucket || bucket.listeners.size === 0) {
      if (this.logging) {
        this._logDispatch(event, data);
      }
      return;
    }

    const snapshot =
      bucket.snapshot || (bucket.snapshot = Array.from(bucket.listeners.values()));

    for (let i = 0; i < snapshot.length; i += 1) {
      const listener = snapshot[i];
      const current = this._events[event]?.listeners.get(listener.id);

      if (current !== listener || !current.enabled) {
        continue;
      }

      const callback = current.callback;
      if (typeof callback !== "function") {
        continue;
      }

      if (current.once) {
        current.enabled = false;
      }

      try {
        callback(data, event);
      } catch (error) {
        console.error(
          "EventStream raiseEvent error:\nevent: %s\ncallback ID: %s\ndata: %o\nerror: %o",
          event,
          current.id,
          data,
          error
        );
      } finally {
        if (current.once && this._events[event]?.listeners.get(current.id) === current) {
          this.removeListener(event, current.id);
        }
      }
    }

    if (this.logging) {
      this._logDispatch(event, data);
    }
  }

  removeListener(event, identifier) {
    const bucket = this._events[event];
    if (!bucket || bucket.listeners.size === 0) {
      if (this.logging && !bucket) {
        console.warn(`eventStream: No listeners found for event "${event}"`);
      }
      return false;
    }

    const listeners = bucket.listeners;

    if (typeof identifier === "string") {
      const listener = listeners.get(identifier);
      if (!listener) {
        if (this.logging) {
          console.warn(
            `eventStream: Listener "${identifier}" not found for event "${event}". ` +
              `Available IDs: ${Array.from(listeners.keys()).join(", ")}`
          );
        }
        return false;
      }

      this._removeListenerFromBucket(event, bucket, identifier, listener);
      if (this.logging) {
        console.log(
          `eventStream: Removed listener ${identifier} from event ${event}.`
        );
      }
      return true;
    }

    if (typeof identifier === "function") {
      for (const [id, listener] of listeners) {
        if (listener.callback === identifier) {
          this._removeListenerFromBucket(event, bucket, id, listener);
          if (this.logging) {
            console.log(`eventStream: Removed listener ${id} from event ${event}.`);
          }
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Remove listeners with matching tags across all events
   * @param {string[]} tags - Array of tags. Listeners must have ALL tags to be removed.
   * @returns {number} Total number of listeners removed
   */
  removeByTag(tags) {
    const normalizedTags = this._normalizeTags(tags);
    if (normalizedTags.length === 0) {
      console.warn("eventStream: removeByTag requires a non-empty array of tags");
      return 0;
    }

    let totalRemoved = 0;
    const events = Object.keys(this._events);

    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];
      const bucket = this._events[event];
      if (!bucket || bucket.listeners.size === 0) {
        continue;
      }

      const idsToRemove = [];
      for (const [id, listener] of bucket.listeners) {
        if (hasAllTags(listener.tags, normalizedTags)) {
          idsToRemove.push(id);
        }
      }

      for (let j = 0; j < idsToRemove.length; j += 1) {
        if (this.removeListener(event, idsToRemove[j])) {
          totalRemoved += 1;
        }
      }
    }

    if (this.logging) {
      console.log(
        `eventStream: Removed ${totalRemoved} listener(s) matching tags: ${normalizedTags.join(
          ", "
        )}`
      );
    }

    return totalRemoved;
  }

  getListener(event, id) {
    return this._events[event]?.listeners.get(id);
  }

  enableListener(event, id) {
    const listener = this.getListener(event, id);
    if (!listener) {
      console.warn(
        `eventStream: Attempted to enable invalid listener ${id} for event ${event}`
      );
      return false;
    }

    listener.enabled = true;
    return true;
  }

  disableListener(event, id) {
    const listener = this.getListener(event, id);
    if (!listener) {
      console.warn(
        `eventStream: Attempted to disable invalid listener ${id} for event ${event}`
      );
      return false;
    }

    listener.enabled = false;
    return true;
  }

  hasListeners(event) {
    return !!this._events[event]?.listeners.size;
  }

  debugListeners(event) {
    const listeners = this.stream[event];
    if (!listeners) {
      return [];
    }

    return Array.from(listeners.values(), (listener) => ({
      id: listener.id,
      enabled: listener.enabled,
      tags: listener.tags ? Array.from(listener.tags) : [],
      once: !!listener.once,
    }));
  }

  purge(event) {
    if (!event) {
      console.warn("eventStream: Attempted to purge invalid event");
      return 0;
    }

    if (event === "ALL") {
      let count = 0;
      const events = Object.keys(this._events);
      for (let i = 0; i < events.length; i += 1) {
        count += this._clearBucket(events[i], this._events[events[i]]);
      }
      return count;
    }

    const bucket = this._events[event];
    if (!bucket) {
      return 0;
    }

    return this._clearBucket(event, bucket);
  }

  gmcpHandler() {
    globalThis.GMCP ??= {};

    if (this._processingGmcp) {
      return null;
    }

    const errors = [];
    this._processingGmcp = true;

    try {
      for (let i = 0; i < this.gmcpBackLog.length; i += 1) {
        const currentArgs = this.gmcpBackLog[i];

        try {
          if (typeof currentArgs?.gmcp_method !== "string" || !currentArgs.gmcp_method) {
            console.warn("eventStream: Invalid GMCP data in backlog:", currentArgs);
            continue;
          }

          setAtString(
            globalThis.GMCP,
            currentArgs.gmcp_method.split("."),
            currentArgs.gmcp_args
          );
          this.raiseEvent(currentArgs.gmcp_method, currentArgs.gmcp_args);
        } catch (error) {
          console.error("eventStream: GMCP handler error:", error, currentArgs);
          errors.push({ error, data: currentArgs });
        }
      }
    } finally {
      this.gmcpBackLog.length = 0;
      this._processingGmcp = false;
    }

    return errors.length > 0 ? errors : null;
  }

  gmcpHandlerRaw(gmcp) {
    if (typeof gmcp?.gmcp_method !== "string" || !gmcp.gmcp_method) {
      console.warn("eventStream: Invalid GMCP data:", gmcp);
      return false;
    }

    globalThis.GMCP ??= {};

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

    if (DOM_EVENT_NAMES.has(event.toLowerCase())) {
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

  _normalizeRegistrationOptions(
    event,
    onceOrOptions,
    durationParam,
    idParam,
    tagsParam,
    argumentCount
  ) {
    let once = false;
    let duration = false;
    let id;
    let tags = [];

    if (argumentCount === 2) {
      return { once, duration: 0, id, tags };
    }

    if (this._isOptionsObject(onceOrOptions)) {
      ({ once = false, duration = false, id, tags = [] } = onceOrOptions);
    } else {
      if (this.logging) {
        console.warn(
          `eventStream: Deprecated registerEvent signature for "${event}". ` +
            "Use: registerEvent(event, callback, { once, duration, id, tags })"
        );
      }

      once = onceOrOptions ?? false;
      duration = durationParam ?? false;
      id = idParam;
      tags = tagsParam ?? [];
    }

    return {
      once: !!once,
      duration: this._normalizeDuration(duration),
      id: id == null || id === "" ? undefined : String(id),
      tags: this._normalizeTags(tags),
    };
  }

  _normalizeDuration(duration) {
    if (duration === false || duration == null) {
      return 0;
    }

    if (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0) {
      throw new TypeError("Listener duration must be a non-negative finite number");
    }

    return duration;
  }

  _normalizeTags(tags) {
    if (!Array.isArray(tags) || tags.length === 0) {
      return [];
    }

    const normalized = [];
    const seen = new Set();

    for (let i = 0; i < tags.length; i += 1) {
      const tag = tags[i];
      if (typeof tag !== "string" || tag.length === 0 || seen.has(tag)) {
        continue;
      }

      seen.add(tag);
      normalized.push(tag);
    }

    return normalized;
  }

  _resolveListenerId(callback, id) {
    if (id) {
      return id;
    }

    if (callback.name) {
      if (this.logging) {
        console.warn(
          `eventStream: Using function name "${callback.name}" as listener ID. ` +
            "This may break with bundler minification. Consider explicit ID."
        );
      }
      return callback.name;
    }

    return this._generateListenerId();
  }

  _generateListenerId() {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }

    this._listenerSequence += 1;
    return `listener-${this._listenerSequence}`;
  }

  _getOrCreateBucket(event) {
    let bucket = this._events[event];
    if (!bucket) {
      const listeners = new Map();
      bucket = {
        listeners,
        snapshot: null,
      };
      this._events[event] = bucket;
      this.stream[event] = listeners;
    }

    return bucket;
  }

  _removeListenerFromBucket(event, bucket, id, listener) {
    this._cleanupListener(listener);
    bucket.listeners.delete(id);
    bucket.snapshot = null;

    if (bucket.listeners.size === 0) {
      delete this._events[event];
      delete this.stream[event];
    }
  }

  _cleanupListener(listener) {
    if (listener.timer) {
      clearTimeout(listener.timer);
      listener.timer = 0;
    }

    listener.enabled = false;
    listener.callback = null;
  }

  _clearBucket(event, bucket) {
    if (!bucket) {
      return 0;
    }

    let count = 0;
    for (const listener of bucket.listeners.values()) {
      this._cleanupListener(listener);
      count += 1;
    }

    delete this._events[event];
    delete this.stream[event];
    return count;
  }

  _logDispatch(event, data) {
    console.log("eventStream event:", event);
    console.log("eventStream data:", data);
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

  for (let i = 0; i < dotarr.length - 1; i += 1) {
    const key = dotarr[i];

    if (FORBIDDEN_GMCP_KEYS.has(key)) {
      throw new Error(`Forbidden key: ${key}`);
    }

    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }

  const lastKey = dotarr[dotarr.length - 1];
  if (FORBIDDEN_GMCP_KEYS.has(lastKey)) {
    throw new Error(`Forbidden key: ${lastKey}`);
  }

  if (
    typeof val === "object" &&
    val !== null &&
    !Array.isArray(val) &&
    current[lastKey] &&
    typeof current[lastKey] === "object" &&
    !Array.isArray(current[lastKey])
  ) {
    current[lastKey] = Object.assign(current[lastKey], val);
    return;
  }

  current[lastKey] = val;
};
