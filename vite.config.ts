import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  root: "src/ui",
  // envDir defaults to `root` (src/ui) — resolved relative to `root`, so this
  // must go up two levels (src/ui -> src -> repo root) to reach the repo's
  // real .env. Without it, every VITE_-prefixed var is silently invisible to
  // import.meta.env in the built bundle.
  envDir: "../..",
})
