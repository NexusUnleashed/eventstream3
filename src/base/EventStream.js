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

    const listener = {
      controller: new AbortController(),
      callback: callback,
      id: crypto.randomUUID(),
    };

    if (duration) {
      listener.timer = setTimeout(() => {
        listener.controller.abort();
        removeListener(event, callback.name);
      }, duration);

      listener.controller.signal.onabort = (evt) => {
        clearTimeout(listener.timer);
      };
    }

    // event with ONCE and DURATION that fire do not natively clear the timeout
    // This snippet bundles a clearTimeout call with the ONCE callback
    const callbackBundle = once
      ? async ({ detail }) => {
          listener.callback(detail);
          removeListener(event, callback.name);
        }
      : async ({ detail }) => {
          listener.callback(detail);
        };

    // Do not allow duplicates of functions in each event. Remove action.
    if (callback.name && callback.name.length > 0) {
      removeListener(event, callback.name);
    }

    eventTarget.addEventListener(event, callbackBundle, {
      once: once,
      signal: listener.controller.signal,
    });

    //https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
    //At time of writing there is no way to combine multiple signals. This means that you can't
    //directly abort a download using either a timeout signal or by calling AbortController.abort()
    //signal: duration ? AbortSignal.timeout(duration) : listener.controller.signal

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
        return false;
      }
    } else if (Number.isInteger(listener) && listener < streamEvent.length) {
      clearListener(listener);
    } else {
      let i = streamEvent.findIndex((e) => e.callback === listener);
      if (i >= 0) {
        clearListener(i);
      }
    }

    console.log(`eventStream: Removed event ${listener} on event ${event}.`);
  };

  const getListener = (event, id) => {
    return stream[event].find((e) => e.callback.name === id);
  };

  const purge = (event) => {
    if (typeof event === "undefined") {
      console.log("eventStream: attempted to purge invalid event");
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
      setAtString(globalThis.GMCP, gmcp.gmcp_method.split("."), gmcp.gmcp_args);
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
    getListener: getListener,
    purge: purge,
    gmcpBackLog: gmcpBackLog,
    gmcpHandler: gmcpHandler,
    gmcpHandlerRaw: gmcpHandlerRaw,
  };
};

//Char.Status {"name":"Nicola","fullname":"Nicola","age":"1","race":"Troll","specialisation":"","level":"1 (0%)","xp":"0%","xprank":"0","class":"Magi","city":"Ashtan (1)","house":"(None)","order":"(None)","boundcredits":"0","unboundcredits":"0","lessons":"0","explorerrank":"a Sightseer","mayancrowns":"0","boundmayancrowns":"0","gold":"0","bank":"0","unread_news":"0","unread_msgs":"0","target":"None","gender":"male"}
