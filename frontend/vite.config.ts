import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// function crossOriginIsolationMiddleware(_, res, next) {
//   res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
//   res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
//   next();
// }

// const setCors = () => ({
//   name: "configure-server",
//   configureServer: (server) => {
//     server.middlewares.use(crossOriginIsolationMiddleware);
//   },
//   configurePreviewServer: (server) => {
//     server.middlewares.use(crossOriginIsolationMiddleware);
//   },
// });

// https://vite.dev/config/
export default defineConfig({
  assetsInclude: ["**/*.wasm"],
  plugins: [react(), nodePolyfills()],
  server: {
    allowedHosts: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  // optimizeDeps: {
  //   exclude: ["fhevmjs"],
  // },
});
