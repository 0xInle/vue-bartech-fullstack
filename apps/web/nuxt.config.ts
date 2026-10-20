import tailwindcss from "@tailwindcss/vite";
import { definePreset } from "@primeuix/themes";
import Aura from "@primeuix/themes/aura";
import { primeVueRussianLocale } from "./primevue-locale";

const BarTechTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50: "{emerald.50}",
      100: "{emerald.100}",
      200: "{emerald.200}",
      300: "{emerald.300}",
      400: "{emerald.400}",
      500: "{emerald.500}",
      600: "{emerald.600}",
      700: "{emerald.700}",
      800: "{emerald.800}",
      900: "{emerald.900}",
      950: "{emerald.950}",
    },
    colorScheme: {
      light: {
        surface: {
          0: "#ffffff",
          50: "{zinc.50}",
          100: "{zinc.100}",
          200: "{zinc.200}",
          300: "{zinc.300}",
          400: "{zinc.400}",
          500: "{zinc.500}",
          600: "{zinc.600}",
          700: "{zinc.700}",
          800: "{zinc.800}",
          900: "{zinc.900}",
          950: "{zinc.950}",
        },
      },
      dark: {
        surface: {
          0: "#ffffff",
          50: "{zinc.50}",
          100: "{zinc.100}",
          200: "{zinc.200}",
          300: "{zinc.300}",
          400: "{zinc.400}",
          500: "{zinc.500}",
          600: "{zinc.600}",
          700: "{zinc.700}",
          800: "{zinc.800}",
          900: "{zinc.900}",
          950: "{zinc.950}",
        },
      },
    },
  },
});

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  app: {
    head: {
      link: [{ rel: "icon", type: "image/png", href: "/favicon.png" }],
    },
  },
  devtools: { enabled: false },
  css: ["~/assets/css/main.css"],
  modules: ["@primevue/nuxt-module", "@vite-pwa/nuxt", "nuxt-security"],
  security: {
    strict: true,
    nonce: true,
    headers: {
      contentSecurityPolicy: {
        "base-uri": ["'none'"],
        "connect-src": ["'self'"],
        "default-src": ["'none'"],
        "font-src": ["'self'", "data:"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"],
        "img-src": ["'self'", "data:"],
        "manifest-src": ["'self'"],
        "object-src": ["'none'"],
        "script-src": ["'self'", "'strict-dynamic'", "'nonce-{{nonce}}'"],
        "script-src-attr": ["'none'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "upgrade-insecure-requests": process.env.NODE_ENV === "production",
        "worker-src": ["'self'"],
      },
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: false,
    },
    requestSizeLimiter: false,
    rateLimiter: false,
    xssValidator: false,
    corsHandler: false,
    allowedMethodsRestricter: false,
    csrf: false,
    removeLoggers: false,
  },
  primevue: {
    autoImport: true,
    components: {
      include: [
        "Button",
        "Card",
        "AutoComplete",
        "CascadeSelect",
        "MultiSelect",
        "Textarea",
        "Divider",
        "Drawer",
        "FloatLabel",
        "InputText",
        "Message",
        "Password",
        "PanelMenu",
        "ProgressSpinner",
        "Select",
        "Tag",
      ],
    },
    composables: { include: [] },
    options: {
      theme: {
        preset: BarTechTheme,
        options: { darkModeSelector: ".app-dark" },
      },
      locale: primeVueRussianLocale,
    },
  },
  vite: {
    devtools: false,
    plugins: [tailwindcss()],
  },
  pwa: {
    registerType: "prompt",
    client: {
      installPrompt: "indiebar:pwa-install-dismissed",
    },
    manifest: {
      name: "IndieBar",
      short_name: "IndieBar",
      description: "Рабочее пространство бара",
      lang: "ru",
      display: "standalone",
      start_url: "/",
      theme_color: "#17211e",
      background_color: "#f7f8f7",
      icons: [
        {
          src: "/pwa-icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any",
        },
      ],
    },
    workbox: {
      globPatterns: ["**/*.{js,css,svg,png,ico,woff2}"],
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: "",
      siteUrl: "",
    },
  },
  routeRules: {
    "/invitations": {
      security: { headers: { referrerPolicy: "no-referrer" } },
      headers: {
        "cache-control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
    "/invitations/**": {
      security: { headers: { referrerPolicy: "no-referrer" } },
      headers: {
        "cache-control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
    "/app/**": {
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    },
    "/internal/**": {
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    },
  },
  build: {
    transpile: ["@bartech/api-client"],
  },
  nitro: {
    devProxy: {
      "/api": "http://localhost:3001/api",
    },
  },
});
