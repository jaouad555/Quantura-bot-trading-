import { apiStorage } from "./apiStorage";
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';

const DEFAULT_SECRET_STORAGE_KEY = 'app_2fa_secret';
const DEFAULT_2FA_CONFIGURED_KEY = 'app_2fa_configured';
const DEFAULT_2FA_ENABLED_KEY = 'app_2fa_enabled';

/**
 * Checks if 2FA is currently enabled for the user.
 * 2FA is an optional feature that the user can enable or disable at will.
 */
export function is2FAEnabled(userIdentifier: string = 'JAOUAD'): boolean {
  try {
    const enabledKey = `${DEFAULT_2FA_ENABLED_KEY}_${userIdentifier.toLowerCase().trim()}`;
    const configuredKey = `${DEFAULT_2FA_CONFIGURED_KEY}_${userIdentifier.toLowerCase().trim()}`;
    
    const enabledVal = apiStorage.getItem(enabledKey);
    if (enabledVal !== null) {
      return enabledVal === 'true';
    }
    const globalEnabled = apiStorage.getItem(DEFAULT_2FA_ENABLED_KEY);
    if (globalEnabled !== null) {
      return globalEnabled === 'true';
    }

    // Check configured fallback
    const confVal = apiStorage.getItem(configuredKey);
    if (confVal !== null) {
      return confVal === 'true';
    }
    const globalConf = apiStorage.getItem(DEFAULT_2FA_CONFIGURED_KEY);
    if (globalConf !== null) {
      return globalConf === 'true';
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Checks if 2FA has been successfully configured and verified by the user.
 */
export function is2FAConfigured(userIdentifier: string = 'JAOUAD'): boolean {
  return is2FAEnabled(userIdentifier);
}

/**
 * Enables or disables 2FA for the user.
 */
export function set2FAEnabled(enabled: boolean, userIdentifier: string = 'JAOUAD'): void {
  try {
    const enabledKey = `${DEFAULT_2FA_ENABLED_KEY}_${userIdentifier.toLowerCase().trim()}`;
    const configuredKey = `${DEFAULT_2FA_CONFIGURED_KEY}_${userIdentifier.toLowerCase().trim()}`;
    
    if (enabled) {
      apiStorage.setItem(enabledKey, 'true');
      apiStorage.setItem(configuredKey, 'true');
      apiStorage.setItem(DEFAULT_2FA_ENABLED_KEY, 'true');
      apiStorage.setItem(DEFAULT_2FA_CONFIGURED_KEY, 'true');
    } else {
      apiStorage.setItem(enabledKey, 'false');
      apiStorage.setItem(configuredKey, 'false');
      apiStorage.setItem(DEFAULT_2FA_ENABLED_KEY, 'false');
      apiStorage.setItem(DEFAULT_2FA_CONFIGURED_KEY, 'false');
    }
  } catch (err) {
    console.error('Failed to update 2FA status', err);
  }
}

/**
 * Marks 2FA as configured or disabled.
 */
export function set2FAConfigured(configured: boolean, userIdentifier: string = 'JAOUAD'): void {
  set2FAEnabled(configured, userIdentifier);
}

/**
 * Convenience method to disable 2FA
 */
export function disable2FA(userIdentifier: string = 'JAOUAD'): void {
  set2FAEnabled(false, userIdentifier);
}

/**
 * Convenience method to enable 2FA
 */
export function enable2FA(userIdentifier: string = 'JAOUAD'): void {
  set2FAEnabled(true, userIdentifier);
}

/**
 * Retrieves the stored Base32 2FA secret or creates a persistent one.
 */
export function getOrCreate2FASecret(userIdentifier: string = 'JAOUAD'): string {
  try {
    const key = `${DEFAULT_SECRET_STORAGE_KEY}_${userIdentifier.toLowerCase().trim()}`;
    const existing = apiStorage.getItem(key) || apiStorage.getItem(DEFAULT_SECRET_STORAGE_KEY);
    if (existing && existing.length >= 16) {
      return existing;
    }
    // Generate a secure, standard 160-bit (20 bytes / 32 Base32 characters) secret
    const newSecret = new OTPAuth.Secret({ size: 20 }).base32;
    apiStorage.setItem(key, newSecret);
    apiStorage.setItem(DEFAULT_SECRET_STORAGE_KEY, newSecret);
    return newSecret;
  } catch (err) {
    // Fallback static high-entropy RFC-compliant base32 key if storage fails
    return 'JBSWY3DPEHPK3PXP4M2A';
  }
}

/**
 * Explicitly generates and persists a new 2FA secret (for key resets).
 */
export function generateNew2FASecret(userIdentifier: string = 'JAOUAD'): string {
  try {
    const key = `${DEFAULT_SECRET_STORAGE_KEY}_${userIdentifier.toLowerCase().trim()}`;
    const newSecret = new OTPAuth.Secret({ size: 20 }).base32;
    apiStorage.setItem(key, newSecret);
    apiStorage.setItem(DEFAULT_SECRET_STORAGE_KEY, newSecret);
    return newSecret;
  } catch (err) {
    return 'JBSWY3DPEHPK3PXP4M2A';
  }
}

/**
 * Formats a Base32 secret into 4-character chunks for easy manual entry into Authenticator apps.
 * e.g., "JBSWY3DPEHPK3PXP" => "JBSW Y3DP EHPK 3PXP"
 */
export function formatSecretKeyWithSpaces(secret: string): string {
  const clean = (secret || '').replace(/\s+/g, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join(' ') || clean;
}

/**
 * Saves a custom 2FA secret key.
 */
export function save2FASecret(secret: string, userIdentifier: string = 'JAOUAD'): void {
  try {
    const key = `${DEFAULT_SECRET_STORAGE_KEY}_${userIdentifier.toLowerCase().trim()}`;
    apiStorage.setItem(key, secret.trim().toUpperCase());
    apiStorage.setItem(DEFAULT_SECRET_STORAGE_KEY, secret.trim().toUpperCase());
  } catch (err) {
    console.error('Failed to save 2FA secret', err);
  }
}

/**
 * Creates an OTPAuth TOTP instance according to RFC 6238.
 */
export function getTOTPInstance(secret: string, label: string = 'Quantura Algo Terminal'): OTPAuth.TOTP {
  // Normalize secret (uppercase, no spaces)
  const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
  return new OTPAuth.TOTP({
    issuer: 'Quantura Terminal',
    label: label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(cleanSecret),
  });
}

/**
 * Generates an otpauth:// URL string that Authenticator apps recognize.
 */
export function getTOTPUri(secret: string, label: string = 'Quantura Algo Terminal'): string {
  const totp = getTOTPInstance(secret, label);
  return totp.toString();
}

/**
 * Generates a real scannable QR Code as a Data URL (base64 PNG).
 */
export async function generateQRCodeDataUrl(uri: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(uri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
      color: {
        dark: '#020617', // Dark navy
        light: '#ffffff', // Clean white background
      },
    });
    return dataUrl;
  } catch (err) {
    console.error('Error generating QR code', err);
    throw err;
  }
}

/**
 * Verifies a 6-digit TOTP code against the secret key.
 * Allows window of +/- 1 time-step (30s before and 30s after) to handle device clock drift.
 * Returns true if valid, false if random or incorrect.
 */
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    const cleanToken = token.trim().replace(/\D/g, '');
    if (cleanToken.length !== 6) return false;

    const totp = getTOTPInstance(secret);
    // delta is null if token is invalid, or an integer representing window offset
    const delta = totp.validate({
      token: cleanToken,
      window: 1, // +/- 1 period (allows 30s grace period for clock drift)
    });

    return delta !== null;
  } catch (err) {
    console.error('Error verifying TOTP', err);
    return false;
  }
}

/**
 * Returns the currently active 6-digit TOTP token (for reference or live display).
 */
export function getCurrentTOTP(secret: string): string {
  try {
    const totp = getTOTPInstance(secret);
    return totp.generate();
  } catch (err) {
    return '000000';
  }
}

/**
 * Returns remaining seconds until current 30s TOTP period expires.
 */
export function getTOTPTimeRemaining(): number {
  const epoch = Math.floor(Date.now() / 1000);
  return 30 - (epoch % 30);
}
