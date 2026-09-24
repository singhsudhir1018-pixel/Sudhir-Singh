import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Network } from '@capacitor/network';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';

export interface MobileNetworkState {
  connected: boolean;
  connectionType: string;
}

class NativeMobileService {
  private isNative = Capacitor.isNativePlatform();

  /**
   * Initialize native mobile hardware listeners and styles
   */
  public async initNativeFeatures(onNavigateBack?: () => boolean): Promise<void> {
    if (!this.isNative) {
      return;
    }

    try {
      // 1. Android Status Bar styling (Emerald-700 branding #047857)
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#047857' });
      await StatusBar.setOverlaysWebView({ overlay: false });
    } catch {
      // Status bar not available or not supported on this platform
    }

    try {
      // 2. Hardware Android Back Button Handler
      App.addListener('backButton', ({ canGoBack }) => {
        // If consumer callback handled closing a modal or custom back action
        if (onNavigateBack && onNavigateBack()) {
          return;
        }

        if (canGoBack) {
          window.history.back();
        } else {
          // If on root page, exit or minimize app
          App.exitApp();
        }
      });
    } catch {
      // App listener fallback
    }

    try {
      // 3. Request permissions for Local Notifications
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
    } catch {
      // Local notifications fallback
    }
  }

  /**
   * Monitor Network Connectivity (Online/Offline)
   */
  public async listenNetworkStatus(callback: (status: MobileNetworkState) => void): Promise<() => void> {
    try {
      const status = await Network.getStatus();
      callback({
        connected: status.connected,
        connectionType: status.connectionType,
      });

      const listener = await Network.addListener('networkStatusChange', (s) => {
        callback({
          connected: s.connected,
          connectionType: s.connectionType,
        });
      });

      return () => {
        listener.remove();
      };
    } catch {
      callback({ connected: navigator.onLine, connectionType: 'unknown' });
      const onOnline = () => callback({ connected: true, connectionType: 'wifi' });
      const onOffline = () => callback({ connected: false, connectionType: 'none' });
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }
  }

  /**
   * Schedule Native Farm Task Reminder
   */
  public async scheduleNotification(title: string, body: string, delayMinutes = 1): Promise<void> {
    if (!this.isNative) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Math.floor(Math.random() * 1000000),
            schedule: { at: new Date(Date.now() + delayMinutes * 60 * 1000) },
            sound: undefined,
            attachments: undefined,
            actionTypeId: '',
            extra: null,
          },
        ],
      });
    } catch (e) {
      console.warn('Failed to schedule local notification:', e);
    }
  }

  /**
   * Capture photo via Native Camera for receipts or leases
   */
  public async takePhoto(): Promise<string | null> {
    try {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt,
      });

      return image.base64String ? `data:image/jpeg;base64,${image.base64String}` : null;
    } catch {
      return null;
    }
  }

  /**
   * Safe native key-value storage
   */
  public async setStorage(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  public async getStorage(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  }
}

export const nativeMobileService = new NativeMobileService();
