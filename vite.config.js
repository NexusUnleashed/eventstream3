import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
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
