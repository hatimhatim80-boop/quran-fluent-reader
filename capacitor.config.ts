import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.9444b7b6261c4f408a4fa03f717ae338',
  appName: 'quran-fluent-reader',
  webDir: 'dist',
  server: {
    url: 'https://9444b7b6-261c-4f40-8a4f-a03f717ae338.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#F7F5F0',
      showSpinner: false,
    },
  },
};

export default config;
