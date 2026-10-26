import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export interface BiometricStatus {
  isAvailable: boolean;
  hasHardware: boolean;
  isEnrolled: boolean;
  biometryType: 'FaceID' | 'TouchID' | 'Biometrics' | 'None';
}

export const biometricsService = {
  checkStatus: async (): Promise<BiometricStatus> => {
    if (Platform.OS === 'web') {
      return {
        isAvailable: false,
        hasHardware: false,
        isEnrolled: false,
        biometryType: 'None',
      };
    }

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      let biometryType: BiometricStatus['biometryType'] = 'Biometrics';
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometryType = 'FaceID';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometryType = 'TouchID';
      }

      return {
        isAvailable: hasHardware && isEnrolled,
        hasHardware,
        isEnrolled,
        biometryType: isEnrolled ? biometryType : 'None',
      };
    } catch {
      return {
        isAvailable: false,
        hasHardware: false,
        isEnrolled: false,
        biometryType: 'None',
      };
    }
  },

  authenticate: async (
    promptMessage: string = 'Confirm identity to access RSG Guard Platform'
  ): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return true;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
      });

      return result.success;
    } catch {
      return false;
    }
  },
};
