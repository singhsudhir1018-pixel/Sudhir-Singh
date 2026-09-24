import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agrifarm.app',
  appName: 'AgriFarm Management',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    StatusBar: {
      backgroundColor: '#047857', // Tailwind emerald-700
      style: 'DARK',
      overlaysWebView: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_name',
      iconColor: '#047857',
    },
  },
};

export default config;
