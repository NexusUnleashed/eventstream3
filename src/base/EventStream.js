/* global globalThis */
export const EventStream = () => {
  const stream = {};
  const gmcpBackLog = [];
  const logging = false;
  const eventTarget = new EventTarget();

  const registerEvent = (event, callback, once = false, duration = false) => {
    if (typeof stream[event] === "undefined") {
      stream[event] = [];
    }

    let listener = { controller: new AbortController(), callback: callback };
    eventTarget.addEventListener(
      event,
      async ({ detail }) => {
        listener.callback(detail);
      },
      {
        once: once,
        signal: duration ? AbortSignal.timeout(duration) : listener.controller.signal,
      }
    );

    stream[event].push(listener);
  };
  const raiseEvent = (event, data) => {
    eventTarget.dispatchEvent(new CustomEvent(event, { detail: data }));
    if (logging === true) {
      console.log("eventStream event: " + event);
      console.log("eventStream data: " + JSON.stringify(data));
    }
  };
  const removeListener = (event, listener) => {
    let streamEvent = stream[event];
    if (typeof streamEvent === "undefined") {
      console.log(
        `eventStream: Attempted to remove event that does not exist ${event}`
      );
      return;
    }

    if (typeof listener === "string") {
      const listenerIndex = streamEvent.findIndex(
        (e) => e.callback.name === listener
      );
      if (listenerIndex >= 0) {
        streamEvent[listenerIndex].controller.abort();
        streamEvent.splice(listenerIndex, 1);
      }
    } else if (typeof listener === "number" && listener < streamEvent.length) {
      streamEvent[listener].controller.abort();
      streamEvent.splice(listener, 1);
    } else {
      let i = streamEvent.findIndex((e) => e.callback === listener);
      if (i >= 0) {
        eventTarget.removeListener(event, i);
      }
    }
  };
  const purge = (event) => {
    if (event === "ALL") {
      for (const ev in stream) {
        for (const cb of stream[ev]) {
          cb.controller.abort();
        }
      }
      stream.length = 0; // Empty the array
      return;
    }

    if (stream[event]) {
      for (const cb of stream[event]) {
        cb.controller.abort();
      }

      stream[event] = [];
      return;
    }
  };
  const gmcpHandler = () => {
    while (gmcpBackLog && gmcpBackLog.length > 0) {
      const current_args = gmcpBackLog.shift();
      if (current_args.gmcp_method) {
        setAtString(
          globalThis.GMCP,
          current_args.gmcp_method.split("."),
          current_args.gmcp_args
        );
        raiseEvent(current_args.gmcp_method, current_args.gmcp_args);
      }
    }
  };
  const gmcpHandlerRaw = (gmcp) => {
    if (gmcp.current_args.gmcp_method) {
      setAtString(
        window.GMCP,
        gmcp.current_args.gmcp_method.split("."),
        gmcp.current_args.gmcp_args
      );
      raiseEvent(gmcp.current_args.gmcp_method, gmcp.current_args.gmcp_args);
    }
  };
  const setAtString = (obj, dotarr, val) => {
    dotarr.reduce((p, c, i) => {
      if (dotarr.length === ++i) {
        if (typeof val === "object" && Array.isArray(val) === false) {
          p[c] = Object.assign(p[c] || {}, val);
        } else {
          p[c] = val;
        }
      } else {
        p[c] = p[c] || {};
      }
      return p[c];
    }, obj);
  };

  return {
    stream: stream,
    registerEvent: registerEvent,
    raiseEvent: raiseEvent,
    removeListener: removeListener,
    purge: purge,
    gmcpHandler: gmcpHandler,
    gmcpHandlerRaw: gmcpHandlerRaw,
  };
};
