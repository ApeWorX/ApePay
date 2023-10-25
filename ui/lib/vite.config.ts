import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "index.tsx"),
      name: "MyLib",
      formats: ["es", "umd"],
      fileName: (format: string) =>
        `apepay-react.${format}.${format.toString() === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: ["react", "react-dom", "styled-components", "wagmi"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "styled-components": "styled",
        },
      },
    },
  },
  resolve: {
    alias: {
      sdk: path.resolve(__dirname, '../../sdk/')
    },
  }
});
