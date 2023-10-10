import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: "es2020",
  },
  plugins: [react()],
  resolve: {
    alias: {
      lib: path.resolve(__dirname, '../lib/'),
      app: path.resolve(__dirname)
    },
  }
});
