/*global crypto */

import { EventStream } from "../base/EventStream";

beforeEach(() => {
  window.crypto = {
    randomUUID() {
      return 42;
    },
  };
  jest.useFakeTimers();
  jest.spyOn(global, "setTimeout");
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe("basic eventStream functionality", () => {
  const eventStream = EventStream();

  test("eventStream loaded", () => {
    expect(eventStream).toBeDefined();
  });

  test("add event to eventStream", () => {
    let testEvent = () => {
      console.log("hello world");
    };
    eventStream.registerEvent("testEvent", testEvent);
    expect(eventStream.stream).toHaveProperty("testEvent");
  });

  test("remove event by name from eventStream", () => {
    eventStream.removeListener("testEvent", "testEvent");
    expect(eventStream.stream["testEvent"]).toHaveLength(0);
  });

  test("remove event by index from eventStream", () => {
    let testEvent1 = () => {
      console.log("hello world");
    };
    eventStream.registerEvent("testEvent", testEvent1);
    eventStream.removeListener("testEvent", 0);
    expect(eventStream.stream["testEvent"]).toHaveLength(0);
  });

  test("remove event by object from eventStream", () => {
    const callback = jest.fn();
    eventStream.registerEvent("testEvent", callback);
    eventStream.removeListener("testEvent", callback);
    expect(eventStream.stream["testEvent"]).toHaveLength(0);
  });

  test("'once' events clear on fire", () => {
    let check = 0;
    let testEvent = () => {
      check += 1;
    };
    eventStream.registerEvent("testEvent", testEvent, true);
    eventStream.raiseEvent("testEvent");
    eventStream.raiseEvent("testEvent");
    expect(eventStream.stream["testEvent"]).toHaveLength(0);
    expect(check).toEqual(1);
  });

  test("'once' with 'duration' events clear on fire", () => {
    let check = 0;
    let testEvent = () => {
      check += 1;
    };
    eventStream.registerEvent("testEvent", testEvent, true, 5000);
    eventStream.raiseEvent("testEvent");
    eventStream.raiseEvent("testEvent");
    expect(eventStream.stream["testEvent"]).toHaveLength(0);
    expect(check).toEqual(1);
  });

  test("'duration' events clear on time", () => {
    let check = 0;
    let durationEvent = () => {
      check += 1;
    };
    eventStream.registerEvent("testEvent", durationEvent, false, 5000);
    //jest.advanceTimersByTime(10000);
    //eventStream.raiseEvent("testEvent");
    jest.runAllTimers();
    expect(eventStream.stream["testEvent"]).toHaveLength(0);
    expect(check).toEqual(0);
  });
});
