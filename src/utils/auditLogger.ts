
import { supabase } from '@/integrations/supabase/client';

export interface AuditLogData {
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
}

export const logAuditEvent = async (data: AuditLogData): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Get user's IP and user agent (in a real app, these would come from headers)
    const userAgent = navigator.userAgent;
    
    await supabase.rpc('log_audit_event', {
      p_user_id: user.id,
      p_action: data.action,
      p_resource_type: data.resourceType,
      p_resource_id: data.resourceId || null,
      p_details: data.details ? JSON.stringify(data.details) : null,
      p_ip_address: null, // Would be set server-side in production
      p_user_agent: userAgent,
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
};

// Helper functions for common audit events
export const auditAuth = {
  login: (method: string) => logAuditEvent({
    action: 'login',
    resourceType: 'auth',
    details: { method }
  }),
  logout: () => logAuditEvent({
    action: 'logout',
    resourceType: 'auth'
  }),
  signup: (email: string) => logAuditEvent({
    action: 'signup',
    resourceType: 'auth',
    details: { email }
  }),
  passwordChange: () => logAuditEvent({
    action: 'password_change',
    resourceType: 'auth'
  }),
  enable2FA: () => logAuditEvent({
    action: 'enable_2fa',
    resourceType: 'auth'
  }),
  disable2FA: () => logAuditEvent({
    action: 'disable_2fa',
    resourceType: 'auth'
  }),
};

export const auditContent = {
  createPost: (postId: string, topicId: string) => logAuditEvent({
    action: 'create',
    resourceType: 'post',
    resourceId: postId,
    details: { topicId }
  }),
  updatePost: (postId: string) => logAuditEvent({
    action: 'update',
    resourceType: 'post',
    resourceId: postId
  }),
  deletePost: (postId: string) => logAuditEvent({
    action: 'delete',
    resourceType: 'post',
    resourceId: postId
  }),
  createComment: (commentId: string, postId: string) => logAuditEvent({
    action: 'create',
    resourceType: 'comment',
    resourceId: commentId,
    details: { postId }
  }),
};

export const auditFile = {
  upload: (filename: string, size: number) => logAuditEvent({
    action: 'upload',
    resourceType: 'file',
    details: { filename, size }
  }),
  download: (filename: string) => logAuditEvent({
    action: 'download',
    resourceType: 'file',
    details: { filename }
  }),
};
