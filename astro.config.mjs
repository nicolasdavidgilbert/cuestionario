import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import vercel from '@astrojs/vercel'

import sentry from '@sentry/astro';

export default defineConfig({
  site: 'https://cuestionario.online',
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true
    }
  }),
  integrations: [
    react(),
    sentry({
      project: 'javascript-astro',
      org: 'nicolas-dh',
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  vite: {
    build: {
      rollupOptions: {
        external: ['@neondatabase/serverless']
      }
    }
  }
})