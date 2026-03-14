import { EventStream } from "./base/EventStream";
import createTimer from "./base/Timer";

const PACKAGE_NAME = "eventStream3";
const PACKAGE_URL = "https://unpkg.com/nexevent/eventStream3.nxs";

globalThis.EventStream = EventStream;
globalThis.eventStream = new EventStream();
globalThis.eventStream.createTimer = (name, length = 0) =>
  createTimer(name, length, globalThis.eventStream);

const updateNxs = async () => {
  try {
    const response = await fetch(PACKAGE_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    const packages = globalThis.nexusclient?.packages?.();
    const eventPackage = packages?.get?.(PACKAGE_NAME);

    if (eventPackage) {
      eventPackage.apply(data, globalThis.nexusclient.reflexes());
    }
  } catch (error) {
    console.error("[eventStream]: Failed to update package metadata", error);
  }
};

const applyOverride = () => {
  const client = globalThis.nexusclient;
  if (!client || client.__eventStreamOverrideApplied) {
    return;
  }

  client.__eventStreamOverrideApplied = true;
  client.process_lines = function (lines) {
    if (this.gagged || !Array.isArray(lines) || lines.length === 0) {
      return;
    }

    let currentLines = lines;
    const reflexes = this.reflexes();
    this.current_block = currentLines;

    for (let idx = 0; idx < currentLines.length && idx < 1000; idx += 1) {
      const currentLine = currentLines[idx];
      this.current_line = currentLine;

      if (currentLine) {
        currentLine.index = idx;

        if (typeof currentLine.line === "string" && currentLine.line.indexOf("\u0007") >= 0) {
          this.platform().beep();
        }
      }

      if (!this.fullstop) {
        currentLines = reflexes.handle_triggers(currentLines, idx) || currentLines;
        this.current_block = currentLines;
      }
    }

    reflexes.run_function("onBlock", currentLines, "ALL");

    const block = this.get_displayed_block(currentLines);
    this.buffer().add_block(block);

    this.current_line = undefined;
    this.current_block = undefined;
  };

  console.log("[eventStream]: Overrides applied");
};

if (
  typeof nexusclient !== "undefined" &&
  nexusclient.charname?.toLowerCase() !== "khaseem"
) {
  void updateNxs();
  applyOverride();
}
