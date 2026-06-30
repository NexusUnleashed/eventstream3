/**
 * nexus-runtime — the shared third-party runtime for the nex* ecosystem.
 *
 * Maintained inside the nexevent (eventStream) repo because every nex* package
 * already loads eventStream first, so this is the natural home for the one shared
 * runtime payload they all draw from. It is a SEPARATE build artifact, not part of
 * the event-bus bundle: `npm run build:runtime` emits `dist/nexus-runtime.min.js`,
 * independent of `dist/bundle.min.js`. The event bus itself never imports these
 * libraries — they are devDependencies here, build-time inputs to this artifact
 * only, so `npm install nexevent` stays lean.
 *
 * It bundles the ecosystem's preferred libraries ONCE and assigns them to
 * `globalThis.nexRuntime` (e.g. `nexRuntime.mui`, `nexRuntime.xstate`). Every nex*
 * package (nexSys, nexMap, nexGui, nexBash) then references these as build externals
 * mapped to those globals instead of shipping its own copy.
 *
 * The global is set as an EXPLICIT side effect (not via the IIFE wrapper's `var`),
 * exactly like eventStream.js does `globalThis.eventStream = …`. That matters
 * because the package loader pulls bundles in with dynamic `import()` (see the
 * `.nxs`): under `import()` a top-level `var` is module-scoped and would never
 * become a global, whereas this assignment runs regardless of how the file is
 * loaded (`<script>` or `import()`).
 *
 * Load order on the page:
 *   React / ReactDOM (host) → nexus-runtime → eventStream → nex* packages
 *
 * React / ReactDOM are intentionally NOT bundled here — they stay external and are
 * borrowed from the host's `React` / `ReactDOM` globals. That keeps exactly one
 * React on the page, so the MUI / emotion copies bundled inside this runtime share
 * the same React (and the same emotion instance) as every consumer. Bundling our
 * own React here would create a second copy and break hooks/context/styling.
 */
// Bundled versions below are the RESOLVED installs at the last update, not the
// caret ranges in package.json — they drift upward on `npm install`. Refresh
// after bumping deps:  node -p "require('PKG/package.json').version"
import * as mui from "@mui/material";                            // 9.1.2
import * as muiStyles from "@mui/material/styles";               // 9.1.2 (part of @mui/material)
import * as muiLab from "@mui/lab";                              // 9.0.0-beta.5
import * as dndCore from "@dnd-kit/core";                        // 6.3.1
import * as dndSortable from "@dnd-kit/sortable";                // 10.0.0
import * as dndUtilities from "@dnd-kit/utilities";             // 3.2.2
import * as tanstackReactTable from "@tanstack/react-table";     // 8.21.3
import * as tanstackReactVirtual from "@tanstack/react-virtual"; // 3.14.4
import * as immer from "immer";                                  // 11.1.8
import * as xstate from "xstate";                                // 5.32.2
import * as zustand from "zustand";                              // 5.0.14
import * as zod from "zod";                                      // 4.4.3

globalThis.nexRuntime = {
  mui,
  muiStyles,
  muiLab,
  dndCore,
  dndSortable,
  dndUtilities,
  immer,
  tanstackReactTable,
  tanstackReactVirtual,
  xstate,
  zustand,
  zod,
};
