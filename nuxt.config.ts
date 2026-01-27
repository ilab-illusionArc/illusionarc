// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/hints',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxtjs/color-mode',
    '@nuxt/ui',
    '@vite-pwa/nuxt',
    '@nuxtjs/supabase',
    'nuxt-security'
  ],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      titleTemplate: '%s · illusion Arc',
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

  ui: {},

  pwa: {
    registerType: 'autoUpdate',
    includeAssets: [
      '/pwa/favicon.ico',
      '/pwa/apple-touch-icon.png',
      '/pwa/android-chrome-192x192.png',
      '/pwa/android-chrome-512x512.png'
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
        { src: '/pwa/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/pwa/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    }
  },

  supabase: {
    useSsrCookies: true,
    redirect: false
  },

  /**
   * IMPORTANT:
   * - NEVER expose the Supabase service role / secret key to the client.
   * - @nuxtjs/supabase uses SUPABASE_URL + SUPABASE_KEY (anon key) by default.
   *   Service role key is for server-only usage. :contentReference[oaicite:0]{index=0}
   */
  runtimeConfig: {
    // server-only
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

    // client-exposed (safe: anon key + url)
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_KEY
    }
  },

  colorMode: {
    preference: 'system',
    fallback: 'dark',
    classSuffix: ''
  },

  /**
   * SECURITY (nuxt-security)
   * - nuxt-security already registers secure defaults globally.
   * - Below is a “full hardening” baseline you can safely start with,
   *   then tighten CSP sources as you confirm what your site actually needs. :contentReference[oaicite:1]{index=1}
   */
  security: {
    // Strict CSP support (SSR uses nonces; SSG can use hashes/meta)
    nonce: true,
    sri: true,
    ssg: {
      meta: true,
      hashScripts: true,
      hashStyles: false,
      exportToPresets: true
    },
    corsHandler: false, // Disable CORS handling; configure via proxy/CDN if needed

    // Extra hardening utilities (enabled by default; keeping explicit)
    hidePoweredBy: true, // :contentReference[oaicite:2]{index=2}
    removeLoggers: true, // :contentReference[oaicite:3]{index=3}

    // Middleware protections
    rateLimiter: {
      // Built-in limiter is “basic”; still useful as an app-layer brake. :contentReference[oaicite:4]{index=4}
      tokensPerInterval: 150,
      interval: 300000, // 5 min
      headers: false,
      throwError: true
      // If you use Cloudflare, consider: ipHeader: 'cf-connecting-ip'
    },
    requestSizeLimiter: {
      maxRequestSizeInBytes: 2_000_000,
      maxUploadFileRequestInBytes: 8_000_000,
      throwError: true
    }, // :contentReference[oaicite:5]{index=5}

    // Optional “stronger” protections (safe to enable; may require small app changes)
    xssValidator: {},
    csrf: false, // disabled by default; enabling is a security win :contentReference[oaicite:6]{index=6}

    // Security headers (override defaults with stricter choices)
    headers: {
      /**
       * Clickjacking / framing:
       * - Default: SAMEORIGIN via xFrameOptions :contentReference[oaicite:7]{index=7}
       * - Also enforce with CSP frame-ancestors (more powerful) :contentReference[oaicite:8]{index=8}
       */
      xFrameOptions: 'SAMEORIGIN',

      /**
       * HSTS:
       * Only enable preload if you are 100% HTTPS on root + subdomains.
       * Default is already enabled by nuxt-security. :contentReference[oaicite:9]{index=9}
       */
      strictTransportSecurity: {
        maxAge: 31536000, // 1 year
        includeSubdomains: true,
        preload: false
      },

      /**
       * Privacy + API surface tightening
       */
      referrerPolicy: 'strict-origin-when-cross-origin', // :contentReference[oaicite:10]{index=10}
      permissionsPolicy: {
        // Lock down powerful APIs unless you truly use them
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
        'display-capture': [],
        fullscreen: ["self"] // if you need fullscreen, remove this line or set allowed origins
      }, // :contentReference[oaicite:11]{index=11}

      /**
       * Cross-origin isolation headers:
       * Default COEP is "credentialless" in nuxt-security. :contentReference[oaicite:12]{index=12}
       * Keep defaults unless you KNOW you need SharedArrayBuffer / crossOriginIsolated.
       * (If you do, we’ll configure COOP/COEP carefully per-route.)
       */
      // crossOriginEmbedderPolicy: 'credentialless',
      // crossOriginOpenerPolicy: 'same-origin',

      /**
       * CSP:
       * This is a strong “Nuxt-friendly” baseline (strict-dynamic + nonce).
       * Tighten connect-src/img-src/etc once you know every external domain you use. :contentReference[oaicite:13]{index=13}
       */
      contentSecurityPolicy: {
        'base-uri': ["'none'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'self'"],

        // Your pages
        'default-src': ["'self'"],

        // API / websocket (Supabase uses https + wss)
        'connect-src': ["'self'", 'https:', 'wss:'],

        // Images / fonts (Nuxt Image often uses data: for placeholders; keep it)
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'data:', 'https:'],

        // Styles: Nuxt UI / Tailwind often injects inline styles in dev.
        // Keep 'unsafe-inline' ONLY in style-src (not script-src).
        'style-src': ["'self'", 'https:', "'unsafe-inline'"],

        // ✅ The important part: SAFE script policy
        'script-src': [
          "'self'",
          "'nonce-{{nonce}}'"
        ],
        'script-src-attr': ["'none'"],

        // Workers (some libraries use blob workers)
        'worker-src': ["'self'", 'blob:'],

        // Optional extras
        'form-action': ["'self'"],
        'manifest-src': ["'self'"],
        'upgrade-insecure-requests': true
      }
    },
  },
  routeRules: {
    // ✅ Embeds: allow framing, avoid COOP/COEP issues
    '/embed/**': {
      security: {
        headers: {
          xFrameOptions: false,
          contentSecurityPolicy: {
            'frame-ancestors': ["'self'", 'https://illusionarc.com', 'https://www.illusionarc.com']
          },
          crossOriginEmbedderPolicy: false,
          crossOriginOpenerPolicy: false
        }
      }
    },

    // ✅ Arcade: allow framing (same as embed)
    '/arcade/**': {
      security: {
        headers: {
          xFrameOptions: false,
          contentSecurityPolicy: {
            'frame-ancestors': ["'self'", 'https://illusionarc.com', 'https://www.illusionarc.com']
          },
          crossOriginEmbedderPolicy: false,
          crossOriginOpenerPolicy: false
        }
      }
    },
    '/tournaments/**': {
      security: {
        headers: {
          xFrameOptions: false,
          contentSecurityPolicy: {
            'frame-ancestors': ["'self'", 'https://illusionarc.com', 'https://www.illusionarc.com']
          },
          crossOriginEmbedderPolicy: false,
          crossOriginOpenerPolicy: false
        }
      }
    },


    // ✅ Games: relaxed asset loading + allow framing
    '/games/**': {
      security: {
        headers: {
          xFrameOptions: false,
          contentSecurityPolicy: {
            'frame-ancestors': ["'self'", 'https://illusionarc.com', 'https://www.illusionarc.com'],
            'img-src': ["'self'", 'data:', 'https:', 'blob:'],
            'media-src': ["'self'", 'data:', 'https:', 'blob:'],
            'script-src': [
              "'self'",
              "'nonce-{{nonce}}'",
              'https://cdnjs.cloudflare.com',
              'https://cdn.jsdelivr.net'
            ],
            'style-src': ["'self'", 'https:', "'unsafe-inline'"]
          },
          crossOriginEmbedderPolicy: false,
          crossOriginOpenerPolicy: false
        }
      }
    },

    // ✅ Apps: default strict (inherits global)
    // But Panorama needs A-Frame => allow unsafe-eval ONLY there
    '/apps/panorama/**': {
      security: {
        headers: {
          contentSecurityPolicy: {
            'img-src': ["'self'", 'data:', 'https:', 'blob:'],
            'media-src': ["'self'", 'data:', 'https:', 'blob:'],
            'script-src': ["'self'", "'nonce-{{nonce}}'", "'unsafe-eval'"],
            'style-src': ["'self'", 'https:', "'unsafe-inline'"]
          }
        }
      }
    },

    // ✅ Admin is client-only
    '/admin/**': { ssr: false },
    '/apps/**': {
      security: {
        headers: {
          contentSecurityPolicy: {
            // allow local uploads
            'img-src': ["'self'", 'data:', 'https:', 'blob:'],
            'media-src': ["'self'", 'data:', 'https:', 'blob:'],

            // keep scripts strict; ONLY add unsafe-eval if you truly need A-Frame
            'script-src': ["'self'", "'nonce-{{nonce}}'"],

            // if Nuxt UI or inline styles need it
            'style-src': ["'self'", 'https:', "'unsafe-inline'"]
          }
        }
      }
    }
  },
  vite: {
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          // Supabase internal bundle warning (harmless)
          if (
            warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
            typeof warning.message === 'string' &&
            warning.message.includes('PostgrestError') &&
            warning.message.includes('@supabase/supabase-js')
          ) {
            return
          }

          warn(warning)
        }
      }
    }
  },
  typescript: {
    tsConfig: {
      include: ['~/types/**/*.d.ts', '~/types/**/*.ts']
    }
  }
})
