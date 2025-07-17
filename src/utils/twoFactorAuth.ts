
import { TOTP, Secret } from 'otpauth';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';

export const generateTOTPSecret = (): string => {
  return new Secret().base32;
};

export const generateQRCode = async (secret: string, email: string, appName: string = 'Underground Network'): Promise<string> => {
  const totp = new TOTP({
    issuer: appName,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });

  const qrCodeUrl = await QRCode.toDataURL(totp.toString());
  return qrCodeUrl;
};

export const verifyTOTP = (token: string, secret: string): boolean => {
  try {
    const totp = new TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });

    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
};

export const generateBackupCodes = (): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
};

export const setup2FA = async (secret: string, backupCodes: string[]): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('two_factor_auth')
      .insert({
        user_id: user.id,
        secret,
        backup_codes: backupCodes,
        is_enabled: true,
      });

    return !error;
  } catch (error) {
    console.error('2FA setup error:', error);
    return false;
  }
};

export const disable2FA = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('two_factor_auth')
      .delete()
      .eq('user_id', user.id);

    return !error;
  } catch (error) {
    console.error('2FA disable error:', error);
    return false;
  }
};

export const get2FAStatus = async (): Promise<{ enabled: boolean; hasSetup: boolean }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { enabled: false, hasSetup: false };

    const { data, error } = await supabase
      .from('two_factor_auth')
      .select('is_enabled')
      .eq('user_id', user.id)
      .single();

    if (error) return { enabled: false, hasSetup: false };

    return { enabled: data.is_enabled, hasSetup: true };
  } catch (error) {
    return { enabled: false, hasSetup: false };
  }
};
