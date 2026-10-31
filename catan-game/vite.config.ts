import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const forwardedHost = process.env.CODESPACE_NAME
  ? `${process.env.CODESPACE_NAME}-5173.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev"}`
  : null;
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: forwardedHost ? [forwardedHost] : [],
    // Saves contain private hands and identity tokens; never serve them.
    fs: {
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.data/**"],
    },
    proxy: {
      "/socket.io": {
        target:
          process.env.CATAN_SERVER_URL ||
          `http://127.0.0.1:${process.env.PORT || 3001}`,
        ws: true,
      },
    },
  },
});
