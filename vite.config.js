import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  // Shared runtime — a SEPARATE artifact maintained in this repo (see
  // src/nexus-runtime.js). Bundles MUI/emotion/@mui/lab/dnd-kit/TanStack/immer/xstate/zod/zustand
  // once and exposes them on `globalThis.nexRuntime`. React/ReactDOM stay external
  // (one React on the page). Not part of the event-bus bundle.
  if (mode === "runtime") {
    return {
      define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
      },
      build: {
        outDir: "dist",
        emptyOutDir: false, // keep bundle.min.js alongside it
        copyPublicDir: false,
        // Keep class fields (xstate/zustand) native instead of letting esbuild
        // down-compile them — the down-compile injects `__publicField`/`__defProp`
        // helpers that get hoisted ABOVE the IIFE as top-level `var`s, breaking the
        // single self-contained `!function(){…}()` form the Nexus client expects.
        target: "esnext",
        lib: {
          entry: "src/nexus-runtime.js",
          // The entry sets `globalThis.nexRuntime` itself (works under both
          // <script> and dynamic import()). This `name` is just the IIFE wrapper
          // var required by the format — keep it DISTINCT from `nexRuntime` so a
          // classic <script> load can't clobber the real global with the wrapper's
          // (export-less ⇒ undefined) return value.
          name: "nexRuntimeBundle",
          fileName: () => "nexus-runtime.min.js",
          formats: ["iife"],
        },
        rollupOptions: {
          external: ["react", "react-dom", "react-dom/client"],
          output: {
            globals: {
              react: "React",
              "react-dom": "ReactDOM",
              "react-dom/client": "ReactDOM",
            },
            inlineDynamicImports: true,
          },
          // MUI ships "use client" RSC directives on hundreds of its ESM files.
          // They are meaningless once bundled into one IIFE (we are not an RSC
          // host), and Rollup warns per-file — pages of noise. Drop just that one
          // warning code; everything else still surfaces.
          onwarn(warning, warn) {
            if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
            warn(warning);
          },
        },
        // Minify with terser (NOT esbuild) to match the nexBash/eventStream
        // bundles. esbuild's lib output leaks helper `var`s to the top level; terser
        // emits one clean self-contained `!function(){…}()` IIFE — the exact form the
        // Nexus client loads via `import()`. keep_fnames/keep_classnames mirror the
        // other bundles (named-listener cleanup contract) for ecosystem consistency.
        minify: "terser",
        terserOptions: {
          ecma: 2020,
          mangle: true,
          keep_fnames: true,
          keep_classnames: true,
          compress: {
            inline: 0,
            reduce_funcs: false,
            reduce_vars: false,
            passes: 1,
            keep_fargs: true,
          },
        },
      },
    };
  }

  const isBundleMode = mode === "bundle";

  if (isBundleMode) {
    return {
      define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
      },
      build: {
        outDir: "dist",
        emptyOutDir: false,
        copyPublicDir: false,
        lib: {
          entry: "src/eventstream.js",
          name: "eventStreamBundle",
          fileName: () => "bundle.min.js",
          formats: ["iife"],
        },
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
          },
        },
        minify: "terser",
        terserOptions: {
          mangle: false,
          keep_fnames: true,
          keep_classnames: true,
          compress: {
            passes: 1,
          },
        },
      },
      test: {
        environment: "jsdom",
        globals: true,
      },
    };
  }

  return {
    plugins: [react()],
    build: {
      outDir: "build",
      emptyOutDir: true,
    },
    test: {
      environment: "jsdom",
      globals: true,
    },
  };
});
