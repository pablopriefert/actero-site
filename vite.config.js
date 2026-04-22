import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Sentry source map upload runs only when SENTRY_AUTH_TOKEN is set (prod/CI).
// Without the token, sourcemap generation still happens locally but nothing is
// uploaded — keeps dev/PR builds fast and doesn't fail the build.
const enableSentryUpload = Boolean(process.env.SENTRY_AUTH_TOKEN);

// Release name used by BOTH the runtime SDK (Sentry.init.release) and the
// sourcemap upload plugin — must match so Sentry can pair the event with the
// uploaded maps. Vercel provides VERCEL_GIT_COMMIT_SHA automatically.
const sentryRelease =
  process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || "";

export default defineConfig({
  build: {
    // Generate sourcemaps only when we'll upload them to Sentry (and then
    // delete the local .map files so they never ship publicly). In dev / PR
    // builds without a Sentry token, skip maps to avoid leaking source.
    sourcemap: enableSentryUpload,
  },
  define: {
    // Inject the release name at build time so src/main.jsx's Sentry.init
    // reads the same value as the sourcemap upload plugin below.
    "import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(sentryRelease),
  },
  plugins: [
    react(),
    tailwindcss(),
    enableSentryUpload &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG || "actero",
        project: process.env.SENTRY_PROJECT || "javascript-react",
        authToken: process.env.SENTRY_AUTH_TOKEN,
        // Release = current git SHA so errors are tied to a specific deploy.
        release: { name: sentryRelease || undefined },
        sourcemaps: {
          // Delete local sourcemaps after upload so they don't ship in the
          // public bundle (Sentry still has them for symbolication).
          filesToDeleteAfterUpload: ["dist/**/*.map"],
        },
      }),
  ].filter(Boolean),
});
