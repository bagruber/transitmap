import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: '/transit-map/' for GitHub Pages project-page deploy.
// Set to '/' if a custom domain is used.
export default defineConfig({
  base: '/transit-map/',
  plugins: [react(), tailwindcss()],
})
