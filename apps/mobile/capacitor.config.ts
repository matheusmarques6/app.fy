import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // PLACEHOLDER: Override per tenant at build time (e.g., com.clientname.app)
  appId: 'PLACEHOLDER_APP_ID',
  appName: 'PLACEHOLDER_APP_NAME',
  webDir: 'dist',
  server: {
    // Overridden per tenant at build time
    url: undefined,
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#050505',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#050505',
    },
  },
};

export default config;
