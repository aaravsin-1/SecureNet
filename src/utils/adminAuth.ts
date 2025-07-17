import { User } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'aaravsinghal2005@gmail.com';
const ADMIN_ACCESS_CODE = '230171';

export const isAdmin = (user: User | null): boolean => {
  return user?.email === ADMIN_EMAIL;
};

export const verifyAdminAccess = (accessCode: string): boolean => {
  return accessCode === ADMIN_ACCESS_CODE;
};