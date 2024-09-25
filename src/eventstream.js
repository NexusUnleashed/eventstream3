import { EventStream } from "./base/EventStream";
import createTimer from "./base/Timer";

globalThis.EventStream = EventStream;
globalThis.eventStream = new EventStream();
globalThis.eventStream.createTimer = createTimer;

const updateNxs = () => {
  fetch(`https://unpkg.com/nexevent/eventStream3.nxs`, { cache: "no-store" })
    .then((response) => response.json())
    .then((data) => {
      //Self-update the eventStream3.nxs settings.
      nexusclient
        .packages()
        .get("eventStream3")
        .apply(data, nexusclient.reflexes());
    });
};

const applyOverride = () => {
  globalThis.nexusclient.process_lines = function (lines) {
    if (this.gagged) return;
    // Nothing to do if there are no lines. Happens when we receive a GMCP message.
    if (!lines.length) return;

    this.current_block = lines;
    let reflexes = this.reflexes();

    for (var idx = 0; idx < lines.length; ++idx) {
      if (idx >= 1000) break; // just in case we somehow hit an infinite loop (notifications mainly)

      // this is for custom functions/scripts
      this.current_line = lines[idx];
      // TODO added index property
      this.current_line.index = idx;

      if (
        lines[idx].line &&
        lines[idx].line.indexOf(String.fromCharCode(7)) >= 0
      )
        // line contains the beep char
        this.platform().beep();

      if (!this.fullstop) lines = reflexes.handle_triggers(lines, idx);
    }

    reflexes.run_function("onBlock", lines, "ALL");

    this.ui().buffer().add_block(lines);

    this.current_line = undefined;
    this.current_block = undefined;
  };
  console.log(`[eventStream]: Overrides applied`);
};

if (typeof nexusclient !== "undefined" && nexusclient.charname !== "khaseem") {
  updateNxs();
  applyOverride();
}
