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
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.log("proxy error", err);
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log("Sending Request to the Target:", req.method, req.url);
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log(
              "Received Response from the Target:",
              proxyRes.statusCode,
              req.url
            );
          });
        },
      },
    },
  },
  // optimizeDeps: {
  //   exclude: ["fhevmjs"],
  // },
});
