export default class EventStream extends EventTarget {
  constructor() {
    super();
    this.stream = {};
    this.gmcpBackLog = [];
  }

  registerEvent(event, callback, once = false) {
    if (typeof this.stream[event] === "undefined") {
      this.stream[event] = [];
    }

    let listener = { controller: new AbortController(), callback: callback };
    this.addEventListener(
      event,
      async ({ detail }) => {
        listener.callback(detail);
      },
      {
        once: once,
        signal: listener.controller.signal,
      }
    );

    this.stream[event].push(listener);
  }

  raiseEvent(event, data) {
    this.dispatchEvent(new CustomEvent(event, { detail: data }));
  }

  removeListener(event, listener) {
    let streamEvent = this.stream[event];
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
        this.removeListener(event, i);
      }
    }
  }

  gmcpHandler() {
    while (this.gmcpBackLog && this.gmcpBackLog.length > 0) {
      const current_args = this.gmcpBackLog.shift();
      if (current_args.gmcp_method) {
        this.setAtString(
          window.GMCP,
          current_args.gmcp_method.split("."),
          current_args.gmcp_args
        );
        this.raiseEvent(current_args.gmcp_method, current_args.gmcp_args);
      }
    }
  }

  setAtString(obj, dotarr, val) {
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
  }

  purge(event) {
    if (event === "ALL") {
      for (const ev in this.stream) {
        for (const cb of this.stream[ev]) {
          cb.controller.abort();
        }
      }
      this.stream = [];
      return;
    }

    if (this.stream[event]) {
      for (const cb of this.stream[event]) {
        cb.controller.abort();
      }

      this.stream[event] = [];
      return;
    }
  }
}
