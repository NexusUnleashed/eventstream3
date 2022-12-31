import "../base/Nexaction";

describe("base nexAction functionality", () => {
  const na = globalThis.nexAction;

  const example = {
    regex: /^You feel a fish nibbling on your hook\.$/,
    id: "example",
    action: () => {
      console.log("hello");
    },
  };

  beforeEach(() => {
    na.triggers.clear();
  });

  test("nexAction loaded", () => {
    expect(na).toBeDefined();
  });

  test("adding basic trigger", () => {
    na.triggers.add(example);
    expect(na.triggers.reflexes.length).toBe(1);
  });

  test("remove trigger by id", () => {
    na.triggers.add(example);
    na.triggers.remove("example");
    expect(na.triggers.reflexes.length).toBe(0);
  });

  test("remove trigger by ONCE", () => {
    const exampleOnce = {
      regex: /^You feel a fish nibbling on your hook\.$/,
      id: "exampleOnce",
      once: true,
      action: () => {
        console.log("hello");
      },
    };
    na.triggers.add(exampleOnce);
    na.triggers.process("You feel a fish nibbling on your hook.");
    expect(na.triggers.reflexes.length).toBe(0);
  });

  test("disable trigger by ID", () => {
    na.triggers.add(example);
    expect(na.triggers.reflexes.length).toBe(1);
    na.triggers.disable("example", false);
    expect(na.triggers.reflexes[0].enabled).toBe(false);
  });

  test("enable trigger by ID", () => {
    na.triggers.add(example);
    expect(na.triggers.reflexes.length).toBe(1);
    na.triggers.disable("example", false);
    expect(na.triggers.reflexes[0].enabled).toBe(false);
    na.triggers.enable("example", false);
    expect(na.triggers.reflexes[0].enabled).toBe(true);
  });

  test("remove trigger by DURATION", () => {
    const exampleTime = {
      regex: /^You feel a fish nibbling on your hook\.$/,
      id: "exampleTime",
      duration: 1,
      action: () => {
        console.log("hello");
      },
    };
    na.triggers.add(exampleTime);
    setTimeout(() => {
      expect(na.triggers.reflexes.length).toBe(0);
    }, 2);
  });
});
