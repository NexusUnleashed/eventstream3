import { EventStream } from "../base/EventStream";

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
    let testEvent = () => {
      console.log("hello world");
    };
    eventStream.registerEvent("testEvent", testEvent);
    eventStream.removeListener("testEvent", testEvent);
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
});
