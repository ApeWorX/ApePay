import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, "index.tsx"), // Update this path to your library's entry file
      name: "@apeworx.apepay-react",
      fileName: (format) =>
        `apepay-react.${format}.${format.toString() === "es" ? "js" : "cjs"}`,
    },
  },
});
