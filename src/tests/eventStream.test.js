/*global crypto */

import { EventStream } from "../base/EventStream";
const eventStream = new EventStream();
beforeEach(async () => {
  window.crypto = {
    randomUUID() {
      return 42;
    },
  };
  jest.useFakeTimers();
  jest.spyOn(global, "setTimeout");
  eventStream.purge("ALL");
  await flushPromises();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

function flushPromises() {
  return Promise.resolve().then(() => {});
}

describe("basic eventStream functionality", () => {
  test("eventStream loaded", () => {
    expect(eventStream).toBeDefined();
  });

  test("add event to eventStream", () => {
    let testEvent1 = () => {
      console.log("hello world");
    };
    eventStream.registerEvent("testEvent1", testEvent1);
    expect(eventStream.stream).toHaveProperty("testEvent1");
  });

  test("remove event by name from eventStream", () => {
    let testEvent2 = () => {
      console.log("hello world");
    };
    eventStream.registerEvent("testEvent2", testEvent2);
    eventStream.removeListener("testEvent2", "testEvent2");
    expect(eventStream.stream["testEvent2"]).toHaveLength(0);
  });

  test("remove event by index from eventStream", () => {
    let testEvent3 = () => {
      console.log("hello world");
    };
    eventStream.registerEvent("testEvent3", testEvent3);
    eventStream.removeListener("testEvent3", 0);
    expect(eventStream.stream["testEvent3"]).toHaveLength(0);
  });

  test("remove event by object from eventStream", () => {
    const callback = jest.fn();
    eventStream.registerEvent("testEvent4", callback);
    eventStream.removeListener("testEvent4", callback);
    expect(eventStream.stream["testEvent4"]).toHaveLength(0);
  });

  test("'once' events clear on fire", async () => {
    let check = 0;
    let testEventOnce = () => {
      check += 1;
    };
    eventStream.registerEvent("testEventOnce", testEventOnce, true);
    eventStream.raiseEvent("testEventOnce");
    jest.runAllTimers();
    await flushPromises();
    eventStream.raiseEvent("testEventOnce");
    expect(check).toEqual(1);
    expect(eventStream.stream["testEventOnce"]).toHaveLength(0);
  });

  test("'once' with 'duration' events clear on fire", async () => {
    let check = 0;
    let testEventOnceD = () => {
      check += 1;
    };
    eventStream.registerEvent("testEventOnceD", testEventOnceD, true, 5000);
    eventStream.raiseEvent("testEventOnceD");
    jest.runAllTimers();
    await flushPromises();
    eventStream.raiseEvent("testEventOnceD");
    expect(eventStream.stream["testEventOnceD"]).toHaveLength(0);
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
