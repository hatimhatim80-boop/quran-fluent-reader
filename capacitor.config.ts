import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.9444b7b6261c4f408a4fa03f717ae338',
  appName: 'quran-fluent-reader',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#F7F5F0',
      showSpinner: false,
    },
    CapacitorUpdater: {
      autoUpdate: false, // نتحكم يدوياً
    },
  },
};

export default config;
