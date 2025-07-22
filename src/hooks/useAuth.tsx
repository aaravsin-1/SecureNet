
import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { auditAuth } from '@/utils/auditLogger';
import { generateEncryptionKey } from '@/utils/encryption';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  encryptionKey: string | null;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Log auth events
        if (event === 'SIGNED_OUT') {
          setEncryptionKey(null);
          sessionStorage.removeItem('encryption_key');
          setTimeout(() => {
            auditAuth.logout();
          }, 0);
        } else if (event === 'SIGNED_IN') {
          // Generate or retrieve encryption key
          let key = sessionStorage.getItem('encryption_key');
          if (!key) {
            key = generateEncryptionKey();
            sessionStorage.setItem('encryption_key', key);
          }
          setEncryptionKey(key);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Restore encryption key if user is logged in
      if (session?.user) {
        let key = sessionStorage.getItem('encryption_key');
        if (!key) {
          key = generateEncryptionKey();
          sessionStorage.setItem('encryption_key', key);
        }
        setEncryptionKey(key);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    if (error) {
      toast({
        title: "Access Denied",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account Created",
        description: "Check your email to verify your account",
      });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Authentication Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Access Granted",
        description: "Welcome to the secure network",
      });
    }

    return { error };
  };

  const signOut = async () => {
    setEncryptionKey(null);
    sessionStorage.removeItem('encryption_key');
    await supabase.auth.signOut();
    toast({
      title: "Connection Terminated",
      description: "You have been logged out securely",
    });
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, encryptionKey, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
