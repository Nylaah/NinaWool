import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base relative : fonctionne sur https://<pseudo>.github.io/NinaWool/ comme sur un domaine perso.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'NinaWool — peluches au crochet',
        short_name: 'NinaWool',
        description: 'Peluches au crochet faites main, sur commande.',
        lang: 'fr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#FAF5EC',
        theme_color: '#B8405E',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Faire une demande', url: './#/demande' },
          { name: 'Suivre ma commande', url: './#/suivi' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Les données Supabase ne sont jamais mises en cache : toujours fraîches.
        navigateFallback: 'index.html',
      },
    }),
  ],
})
