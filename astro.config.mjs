import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import vercel from '@astrojs/vercel'

export default defineConfig({
  site: 'https://cuestionario.online',
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true
    }
  }),
  integrations: [react()],
  vite: {
    build: {
      rollupOptions: {
        external: ['@neondatabase/serverless']
      }
    }
  }
})
