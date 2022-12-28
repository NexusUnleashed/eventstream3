/* global */
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

    // If the event is designed to remove itself do not store the listener.
    if (!once && !duration) {
      stream[event].push(listener);
    }
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

    const clearListener = (i) => {
      streamEvent[i].controller.abort();
      streamEvent.splice(i, 1);
    };

    if (typeof listener === "string") {
      const listenerIndex = streamEvent.findIndex(
        (e) => e.callback.name === listener
      );
      if (listenerIndex >= 0) {
        clearListener(listenerIndex);
      } else {
        console.log(
          `eventStream: Unable to locate listener with name ${listener} on event ${event}.`
        );
      }
    } else if (Number.isInteger(listener) && listener < streamEvent.length) {
      clearListener(listener);
    } else {
      let i = streamEvent.findIndex((e) => e.callback === listener);
      if (i >= 0) {
        clearListener(i);
      }
    }
  };
  const purge = (event) => {
    if (typeof event === 'undefined') {
      console.log('eventStream: attempted to purge invalid event');
      return;
    }

    if (event === "ALL") {
      for (const ev in stream) {
        for (const cb of stream[ev]) {
          cb.controller.abort();
        }
      }
      // Empty the stream object.
      for (var key in stream) {
          delete stream[key];
      }
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
    if (gmcp.gmcp_method) {
      setAtString(
        window.GMCP,
        gmcp.gmcp_method.split("."),
        gmcp.gmcp_args
      );
      raiseEvent(gmcp.gmcp_method, gmcp.gmcp_args);
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
    gmcpBackLog: gmcpBackLog,
    gmcpHandler: gmcpHandler,
    gmcpHandlerRaw: gmcpHandlerRaw,
  };
};
