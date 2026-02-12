import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "data/**/*"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,txt,xml,json}"],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB for large data files
        navigateFallbackDenylist: [/^\/~oauth/],
        runtimeCaching: [
          {
            urlPattern: /\/data\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "quran-data-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: "القارئ المُعين - معاني غريب القرآن",
        short_name: "القارئ المُعين",
        description: "تطبيق لتعلم معاني غريب القرآن الكريم والتحفيظ",
        theme_color: "#B8860B",
        background_color: "#F7F5F0",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        dir: "rtl",
        lang: "ar",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
