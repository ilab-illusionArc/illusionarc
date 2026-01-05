// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/hints',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxt/ui',
    '@vite-pwa/nuxt',
  ],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      titleTemplate: '%s · Illusion Arc',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#070A12' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' }
      ]
    },
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' }
  },

  ui: {
    // keep defaults for now; we’ll theme components more in later steps
  },
  pwa: {
    registerType: 'autoUpdate',

    // Put these files in /public (see next section)
    includeAssets: [
      'favicon.ico',
      'apple-touch-icon.png',
      'android-chrome-192x192.png',
      'android-chrome-512x512.png',
      'android-chrome-512x512.png'
    ],

    manifest: {
      name: 'illusion Arc',
      short_name: 'iArc',
      description: 'illusion Arc - Play Free Arcade Games Online',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#402a71',
      theme_color: '#402a71',
      icons: [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    }
  }
})