export class Timer {
  constructor(id, length = 0, emitter = globalThis.eventStream) {
    this._id = id;
    this._enabled = false;
    this._startTime = 0;
    this._endTime = 0;
    this._timerId = 0;
    this._defaultLength = length;
    this._emitter = emitter;
    this._stopHandler = () => {
      this.stop();
    };

    this.setLength(length);
  }

  get length() {
    return this._length;
  }

  get id() {
    return this._id;
  }

  get enabled() {
    return this._enabled;
  }

  setLength(length) {
    if (typeof length !== "number" || !Number.isFinite(length) || length < 0) {
      throw new TypeError("Timer length must be a non-negative finite number");
    }

    this._length = length;
  }

  reset() {
    clearTimeout(this._timerId);
    this._timerId = 0;
    this._enabled = false;
    this.setLength(this._defaultLength);
    this._startTime = 0;
    this._endTime = 0;
    this._raise(`timerReset${this._id}`);
  }

  start() {
    clearTimeout(this._timerId);
    this._timerId = setTimeout(this._stopHandler, this._length * 1000);
    this._enabled = true;
    this._startTime = performance.now() / 1000;
    this._endTime = 0;
    this._raise(`timerStarted${this._id}`);
  }

  stop() {
    if (!this._enabled) {
      return false;
    }

    clearTimeout(this._timerId);
    this._timerId = 0;
    this._endTime = performance.now() / 1000;
    this._enabled = false;
    this._raise(`timerStopped${this._id}`);
    return true;
  }

  duration() {
    if (this._enabled) {
      return this.elapsed();
    }

    if (this._startTime === 0 || this._endTime === 0 || this._endTime < this._startTime) {
      return 0;
    }

    return this._endTime - this._startTime;
  }

  elapsed() {
    return this._enabled ? Math.max(0, performance.now() / 1000 - this._startTime) : 0;
  }

  remaining() {
    return this._enabled ? Math.max(0, this._length - this.elapsed()) : this._length;
  }

  destroy() {
    clearTimeout(this._timerId);
    this._enabled = false;
    this._startTime = 0;
    this._endTime = 0;
    this._timerId = 0;
    this._length = 0;
    this._defaultLength = 0;
    this._emitter = null;
  }

  _raise(event) {
    if (this._emitter && typeof this._emitter.raiseEvent === "function") {
      this._emitter.raiseEvent(event);
    }
  }

  static createTimer(name, length = 0, emitter = globalThis.eventStream) {
    return new Timer(name, length, emitter);
  }
}

export default Timer.createTimer;
