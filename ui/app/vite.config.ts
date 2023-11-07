import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: "es2020",
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@apeworx/apepay": path.resolve(
        __dirname,
        "../../node_modules/@apeworx/apepay/index.ts"
      ),
      "@apeworx/apepay-react": path.resolve(
        __dirname,
        "../../node_modules/@apeworx/apepay-react/index.tsx"
      ),
    },
  },
});
