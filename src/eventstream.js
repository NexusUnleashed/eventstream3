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

if (
  typeof nexusclient !== "undefined" &&
  nexusclient.logged_in &&
  nexusclient.charname !== "khaseem"
) {
  updateNxs();
}
