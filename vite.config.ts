import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths(), tailwindcss()],
  resolve: {
    alias: [
      // Shim for the unpublished `airweave-connect` workspace package that
      // `@airweave/connect-react` declares as a dep. See
      // `src/shims/airweave-connect/lib/types.ts` for full context.
      // Delete both this alias and the shim directory when Airweave
      // republishes the SDK with the workspace dep inlined or as a real npm pkg.
      {
        find: /^airweave-connect\/lib\/(.*)$/,
        replacement: path.resolve(
          __dirname,
          "src/shims/airweave-connect/lib/$1",
        ),
      },
    ],
  },
  optimizeDeps: {
    // esbuild's dep-prebundle step needs to resolve the shimmed imports the
    // same way Vite's runtime resolver does. Listing the SDK forces it
    // through the alias rewrite during prebundling.
    include: ["@airweave/connect-react"],
  },
  server: {
    allowedHosts: ["4c572c9b2665.ngrok-free.app"],
  },
});
