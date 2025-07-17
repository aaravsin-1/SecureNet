
import { supabase } from '@/integrations/supabase/client';

interface RateLimitConfig {
  maxAttempts: number;
  windowMinutes: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: { maxAttempts: 5, windowMinutes: 15 },
  signup: { maxAttempts: 3, windowMinutes: 60 },
  post_create: { maxAttempts: 10, windowMinutes: 60 },
  comment_create: { maxAttempts: 20, windowMinutes: 60 },
  file_upload: { maxAttempts: 5, windowMinutes: 30 },
};

export const checkRateLimit = async (action: string, identifier: string): Promise<boolean> => {
  const config = RATE_LIMITS[action];
  if (!config) return true;

  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - config.windowMinutes);

  try {
    // Check current count
    const { data: existing, error } = await supabase
      .from('rate_limit_tracker')
      .select('count')
      .eq('identifier', identifier)
      .eq('action', action)
      .gte('window_start', windowStart.toISOString())
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Rate limit check error:', error);
      return true; // Allow on error
    }

    if (existing && existing.count >= config.maxAttempts) {
      return false; // Rate limited
    }

    // Increment or create counter
    if (existing) {
      await supabase
        .from('rate_limit_tracker')
        .update({ count: existing.count + 1 })
        .eq('identifier', identifier)
        .eq('action', action)
        .gte('window_start', windowStart.toISOString());
    } else {
      await supabase
        .from('rate_limit_tracker')
        .insert({
          identifier,
          action,
          count: 1,
          window_start: new Date().toISOString(),
        });
    }

    return true;
  } catch (error) {
    console.error('Rate limiting error:', error);
    return true; // Allow on error
  }
};

export const getRateLimitStatus = async (action: string, identifier: string): Promise<{ remaining: number; resetTime: Date | null }> => {
  const config = RATE_LIMITS[action];
  if (!config) return { remaining: 999, resetTime: null };

  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - config.windowMinutes);

  try {
    const { data: existing } = await supabase
      .from('rate_limit_tracker')
      .select('count, window_start')
      .eq('identifier', identifier)
      .eq('action', action)
      .gte('window_start', windowStart.toISOString())
      .single();

    if (!existing) {
      return { remaining: config.maxAttempts, resetTime: null };
    }

    const remaining = Math.max(0, config.maxAttempts - existing.count);
    const resetTime = new Date(existing.window_start);
    resetTime.setMinutes(resetTime.getMinutes() + config.windowMinutes);

    return { remaining, resetTime };
  } catch (error) {
    return { remaining: config.maxAttempts, resetTime: null };
  }
};
