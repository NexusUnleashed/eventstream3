import { EventStream } from "../base/EventStream";
import createTimer from "../base/Timer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const eventStream = new EventStream();

beforeEach(async () => {
  vi.stubGlobal("crypto", {
    randomUUID() {
      return "uuid-42";
    },
  });

  globalThis.GMCP = {};
  globalThis.eventStream = eventStream;

  vi.useFakeTimers();
  vi.spyOn(global, "setTimeout");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  eventStream.purge("ALL");
  eventStream.gmcpBackLog.length = 0;
  eventStream._listenerSequence = 0;
  eventStream._processingGmcp = false;
  await flushPromises();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.runAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete globalThis.GMCP;
  delete globalThis.eventStream;
});

function flushPromises() {
  return Promise.resolve().then(() => {});
}

describe("basic eventStream functionality", () => {
  test("eventStream loaded", () => {
    expect(eventStream).toBeDefined();
  });

  test("add event to eventStream", () => {
    const testEvent1 = () => {
      console.log("hello world 1");
    };
    const id = eventStream.registerEvent("testEvent1", testEvent1);
    expect(id).toBeDefined();
    expect(eventStream.stream).toHaveProperty("testEvent1");
    expect(eventStream.getListener("testEvent1", id)).toBeDefined();
  });

  test("remove event by id prunes empty event map", () => {
    const callback = vi.fn();
    eventStream.registerEvent("testEvent2", callback, { id: "listenerA" });

    const removed = eventStream.removeListener("testEvent2", "listenerA");
    expect(removed).toEqual(true);
    expect(eventStream.stream).not.toHaveProperty("testEvent2");
  });

  test("remove event by callback reference prunes empty event map", () => {
    const callback = vi.fn();
    eventStream.registerEvent("testEvent4", callback);

    const removed = eventStream.removeListener("testEvent4", callback);
    expect(removed).toEqual(true);
    expect(eventStream.stream).not.toHaveProperty("testEvent4");
  });

  test("re-registering the same inferred listener ID preserves the event bucket", () => {
    let calls = 0;

    const itemWatch = () => {
      calls += 1;
    };

    const firstId = eventStream.registerEvent("ItemRemovedFromInv", itemWatch);
    const secondId = eventStream.registerEvent("ItemRemovedFromInv", itemWatch);

    expect(firstId).toEqual("itemWatch");
    expect(secondId).toEqual("itemWatch");
    expect(eventStream.stream.ItemRemovedFromInv).toBeInstanceOf(Map);
    expect(eventStream.stream.ItemRemovedFromInv.size).toEqual(1);

    eventStream.raiseEvent("ItemRemovedFromInv");
    expect(calls).toEqual(1);
  });

  test("'once' events clear on fire", () => {
    let check = 0;
    const testEventOnce = () => {
      check += 1;
    };

    eventStream.registerEvent("testEventOnce", testEventOnce, true);
    eventStream.raiseEvent("testEventOnce");
    vi.runAllTimers();
    eventStream.raiseEvent("testEventOnce");

    expect(check).toEqual(1);
    expect(eventStream.stream).not.toHaveProperty("testEventOnce");
  });

  test("'once' with 'duration' events clear on fire", () => {
    let check = 0;
    const testEventOnceD = () => {
      check += 1;
    };

    eventStream.registerEvent("testEventOnceD", testEventOnceD, true, 5000);
    eventStream.raiseEvent("testEventOnceD");
    vi.runAllTimers();
    eventStream.raiseEvent("testEventOnceD");

    expect(check).toEqual(1);
    expect(eventStream.stream).not.toHaveProperty("testEventOnceD");
  });

  test("'duration' events clear on time", () => {
    let check = 0;
    const durationEvent = () => {
      check += 1;
    };

    eventStream.registerEvent("testEventDuration", durationEvent, false, 1000);

    eventStream.raiseEvent("testEventDuration");
    eventStream.raiseEvent("testEventDuration");
    eventStream.raiseEvent("testEventDuration");
    expect(check).toEqual(3);

    vi.advanceTimersByTime(10000);

    expect(eventStream.stream).not.toHaveProperty("testEventDuration");
    expect(check).toEqual(3);
  });

  test("disabled event test", () => {
    let check = 0;
    const testEventDisabled = () => {
      check += 1;
    };

    eventStream.registerEvent("testEventDisabled", testEventDisabled, {
      id: "disabledListener",
    });
    expect(eventStream.stream).toHaveProperty("testEventDisabled");

    eventStream.raiseEvent("testEventDisabled");
    eventStream.raiseEvent("testEventDisabled");
    expect(check).toEqual(2);

    eventStream.disableListener("testEventDisabled", "disabledListener");
    eventStream.raiseEvent("testEventDisabled");
    expect(check).toEqual(2);

    eventStream.enableListener("testEventDisabled", "disabledListener");
    eventStream.raiseEvent("testEventDisabled");
    expect(check).toEqual(3);
  });

  test("remove event(s) by tag id removes only matching listener set", () => {
    eventStream.registerEvent("testEventTag", vi.fn(), {
      id: "tagged-1",
      tags: ["tag1", "tag2"],
    });
    eventStream.registerEvent("testEventTag", vi.fn(), {
      id: "tagged-2",
      tags: ["tag1"],
    });
    eventStream.registerEvent("testEventTag", vi.fn(), {
      id: "tagged-3",
      tags: ["tag3"],
    });

    const removedTag1Tag2 = eventStream.removeByTag(["tag1", "tag2"]);
    const removedTag1 = eventStream.removeByTag(["tag1"]);

    expect(removedTag1Tag2).toEqual(1);
    expect(removedTag1).toEqual(1);
    expect(eventStream.getListener("testEventTag", "tagged-1")).toBeUndefined();
    expect(eventStream.getListener("testEventTag", "tagged-2")).toBeUndefined();
    expect(eventStream.getListener("testEventTag", "tagged-3")).toBeDefined();
  });

  test("removeByTag returns 0 for invalid tags input", () => {
    expect(eventStream.removeByTag()).toEqual(0);
    expect(eventStream.removeByTag([])).toEqual(0);
    expect(eventStream.removeByTag("tag1")).toEqual(0);
  });

  test("listener added during dispatch should not fire until next raise", () => {
    const calls = [];

    const lateListener = () => {
      calls.push("late");
    };

    const initialListener = () => {
      calls.push("initial");
      eventStream.registerEvent("reentrantEvent", lateListener);
    };

    eventStream.registerEvent("reentrantEvent", initialListener, { once: true });

    eventStream.raiseEvent("reentrantEvent");
    expect(calls).toEqual(["initial"]);

    calls.length = 0;
    eventStream.raiseEvent("reentrantEvent");
    expect(calls).toEqual(["late"]);
  });

  test("listener removed during dispatch does not fire later in the same raise", () => {
    const calls = [];

    eventStream.registerEvent(
      "removeDuringDispatch",
      () => {
        calls.push("first");
        eventStream.removeListener("removeDuringDispatch", "second");
      },
      { id: "first" }
    );
    eventStream.registerEvent(
      "removeDuringDispatch",
      () => {
        calls.push("second");
      },
      { id: "second" }
    );

    eventStream.raiseEvent("removeDuringDispatch");

    expect(calls).toEqual(["first"]);
    expect(eventStream.getListener("removeDuringDispatch", "second")).toBeUndefined();
  });

  test("listener replaced during dispatch is deferred until the next raise", () => {
    const calls = [];

    eventStream.registerEvent(
      "replaceDuringDispatch",
      () => {
        calls.push("first");
        eventStream.registerEvent(
          "replaceDuringDispatch",
          () => {
            calls.push("replacement");
          },
          { id: "target" }
        );
      },
      { id: "first", once: true }
    );
    eventStream.registerEvent(
      "replaceDuringDispatch",
      () => {
        calls.push("original");
      },
      { id: "target" }
    );

    eventStream.raiseEvent("replaceDuringDispatch");
    expect(calls).toEqual(["first"]);

    calls.length = 0;
    eventStream.raiseEvent("replaceDuringDispatch");
    expect(calls).toEqual(["replacement"]);
  });

  test("dispatch snapshot is reused until listeners change", () => {
    eventStream.registerEvent("snapshotEvent", vi.fn(), { id: "one" });
    eventStream.registerEvent("snapshotEvent", vi.fn(), { id: "two" });

    expect(eventStream._events.snapshotEvent.snapshot).toBeNull();

    eventStream.raiseEvent("snapshotEvent");
    const firstSnapshot = eventStream._events.snapshotEvent.snapshot;

    expect(Array.isArray(firstSnapshot)).toEqual(true);

    eventStream.raiseEvent("snapshotEvent");
    expect(eventStream._events.snapshotEvent.snapshot).toBe(firstSnapshot);

    eventStream.registerEvent("snapshotEvent", vi.fn(), { id: "three" });
    expect(eventStream._events.snapshotEvent.snapshot).toBeNull();

    eventStream.raiseEvent("snapshotEvent");
    expect(eventStream._events.snapshotEvent.snapshot).not.toBe(firstSnapshot);
  });

  test("prototype-like event names do not corrupt stream storage", () => {
    const callback = vi.fn();

    eventStream.registerEvent("__proto__", callback, { id: "proto-listener" });
    eventStream.raiseEvent("__proto__", { safe: true });

    expect(callback).toHaveBeenCalledWith({ safe: true }, "__proto__");
    expect(eventStream.hasListeners("__proto__")).toEqual(true);
    expect(eventStream.stream.__proto__).toBeInstanceOf(Map);
  });

  test("purge removes a single event and reports count", () => {
    eventStream.registerEvent("purgeOne", vi.fn(), { id: "one" });
    eventStream.registerEvent("purgeOne", vi.fn(), { id: "two" });

    const removed = eventStream.purge("purgeOne");
    expect(removed).toEqual(2);
    expect(eventStream.stream).not.toHaveProperty("purgeOne");
  });

  test("purge ALL removes all events and reports count", () => {
    eventStream.registerEvent("purgeA", vi.fn(), { id: "a" });
    eventStream.registerEvent("purgeB", vi.fn(), { id: "b" });

    const removed = eventStream.purge("ALL");
    expect(removed).toEqual(2);
    expect(Object.keys(eventStream.stream)).toEqual([]);
  });
});

describe("GMCP handling", () => {
  test("gmcpHandler updates GMCP and raises events", () => {
    const callback = vi.fn();
    eventStream.registerEvent("Char.Vitals", callback, { id: "vitals-listener" });
    eventStream.gmcpBackLog.push({
      gmcp_method: "Char.Vitals",
      gmcp_args: { hp: 100 },
    });

    const errors = eventStream.gmcpHandler();

    expect(errors).toBeNull();
    expect(globalThis.GMCP.Char.Vitals.hp).toEqual(100);
    expect(callback).toHaveBeenCalledWith({ hp: 100 }, "Char.Vitals");
    expect(eventStream.gmcpBackLog).toHaveLength(0);
  });

  test("gmcpHandler returns errors for forbidden prototype keys", () => {
    eventStream.gmcpBackLog.push({
      gmcp_method: "Char.__proto__.Vitals",
      gmcp_args: { hp: 100 },
    });

    const errors = eventStream.gmcpHandler();

    expect(Array.isArray(errors)).toEqual(true);
    expect(errors).toHaveLength(1);
    expect(eventStream.gmcpBackLog).toHaveLength(0);
  });

  test("gmcpHandlerRaw validates payload and returns false for invalid data", () => {
    expect(eventStream.gmcpHandlerRaw()).toEqual(false);
    expect(eventStream.gmcpHandlerRaw({ gmcp_args: {} })).toEqual(false);
  });

  test("gmcpHandlerRaw updates GMCP and returns true for valid payload", () => {
    const callback = vi.fn();
    eventStream.registerEvent("Char.Status", callback, { id: "status-listener" });

    const result = eventStream.gmcpHandlerRaw({
      gmcp_method: "Char.Status",
      gmcp_args: { class: "Magi" },
    });

    expect(result).toEqual(true);
    expect(globalThis.GMCP.Char.Status.class).toEqual("Magi");
    expect(callback).toHaveBeenCalledWith(
      { class: "Magi" },
      "Char.Status"
    );
  });

  test("gmcpHandler is safe under re-entrant processing", () => {
    const calls = [];

    eventStream.registerEvent(
      "Char.Status",
      () => {
        calls.push("status");
        eventStream.gmcpBackLog.push({
          gmcp_method: "Char.Vitals",
          gmcp_args: { hp: 100 },
        });
        eventStream.gmcpHandler();
      },
      { id: "status-listener", once: true }
    );
    eventStream.registerEvent(
      "Char.Vitals",
      (args) => {
        calls.push(`vitals:${args.hp}`);
      },
      { id: "vitals-listener" }
    );
    eventStream.gmcpBackLog.push({
      gmcp_method: "Char.Status",
      gmcp_args: { class: "Magi" },
    });

    const errors = eventStream.gmcpHandler();

    expect(errors).toBeNull();
    expect(calls).toEqual(["status", "vitals:100"]);
    expect(globalThis.GMCP.Char.Status.class).toEqual("Magi");
    expect(globalThis.GMCP.Char.Vitals.hp).toEqual(100);
  });
});

describe("Timer integration", () => {
  test("timer raises started and stopped events", () => {
    const started = vi.fn();
    const stopped = vi.fn();
    eventStream.registerEvent("timerStarteddemo", started, { id: "started" });
    eventStream.registerEvent("timerStoppeddemo", stopped, { id: "stopped" });

    const timer = createTimer("demo", 1);
    timer.start();

    expect(timer.enabled).toEqual(true);
    expect(started).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);

    expect(timer.enabled).toEqual(false);
    expect(stopped).toHaveBeenCalledTimes(1);

    timer.destroy();
  });

  test("timer reset raises reset event", () => {
    const reset = vi.fn();
    eventStream.registerEvent("timerResetquick", reset, { id: "reset" });

    const timer = createTimer("quick", 5);
    timer.reset();

    expect(reset).toHaveBeenCalledTimes(1);
    timer.destroy();
  });

  test("timer reset clears elapsed state and restores remaining time", () => {
    const timer = createTimer("elapsed", 5);
    timer.start();

    vi.advanceTimersByTime(2000);
    timer.reset();

    expect(timer.duration()).toEqual(0);
    expect(timer.elapsed()).toEqual(0);
    expect(timer.remaining()).toEqual(5);

    timer.destroy();
  });

  test("timer binds to the emitter active at creation time", () => {
    const boundStream = new EventStream();
    const started = vi.fn();
    boundStream.registerEvent("timerStartedbound", started, { id: "started" });

    globalThis.eventStream = boundStream;
    const timer = createTimer("bound", 1);

    globalThis.eventStream = eventStream;
    timer.start();

    expect(started).toHaveBeenCalledTimes(1);

    timer.destroy();
    boundStream.purge("ALL");
  });

  test("timer rejects invalid lengths", () => {
    expect(() => createTimer("negative", -1)).toThrow(
      "Timer length must be a non-negative finite number"
    );
    expect(() => createTimer("not-a-number", Number.NaN)).toThrow(
      "Timer length must be a non-negative finite number"
    );
  });
});

describe("validation and lifecycle helpers", () => {
  test("registerEvent falls back to deterministic IDs when crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);

    const firstId = eventStream.registerEvent("fallbackIds", () => {});
    const secondId = eventStream.registerEvent("fallbackIds", () => {});

    expect(firstId).toEqual("listener-1");
    expect(secondId).toEqual("listener-2");
  });

  test("listener duration must be a non-negative finite number", () => {
    expect(() =>
      eventStream.registerEvent("invalidDuration", vi.fn(), { duration: -1 })
    ).toThrow("Listener duration must be a non-negative finite number");
    expect(() =>
      eventStream.registerEvent("invalidDuration", vi.fn(), { duration: Number.NaN })
    ).toThrow("Listener duration must be a non-negative finite number");
  });

  test("enableListener and disableListener report success state", () => {
    eventStream.registerEvent("toggleEvent", vi.fn(), { id: "toggle" });

    expect(eventStream.disableListener("toggleEvent", "toggle")).toEqual(true);
    expect(eventStream.enableListener("toggleEvent", "toggle")).toEqual(true);
    expect(eventStream.disableListener("toggleEvent", "missing")).toEqual(false);
    expect(eventStream.enableListener("toggleEvent", "missing")).toEqual(false);
  });
});
