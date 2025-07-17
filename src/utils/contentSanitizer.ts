
import DOMPurify from 'dompurify';

// Configure DOMPurify with safe defaults
const sanitizeConfig = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 'i', 'b', 
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
  ],
  ALLOWED_ATTR: ['class'],
  FORBID_SCRIPTS: true,
  FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
};

export const sanitizeContent = (content: string): string => {
  if (!content || typeof content !== 'string') return '';
  
  // Remove potential XSS patterns
  let sanitized = content
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '');

  // Use DOMPurify for HTML sanitization
  sanitized = DOMPurify.sanitize(sanitized, sanitizeConfig);
  
  return sanitized.trim();
};

export const sanitizeTitle = (title: string): string => {
  if (!title || typeof title !== 'string') return '';
  
  // Strip all HTML tags from titles
  return DOMPurify.sanitize(title, { ALLOWED_TAGS: [] }).trim();
};

export const validateContentLength = (content: string, maxLength: number = 10000): boolean => {
  return content && content.length <= maxLength;
};

export const detectSpam = (content: string): boolean => {
  const spamPatterns = [
    /(.)\1{20,}/i, // Repeated characters
    /(https?:\/\/[^\s]+){5,}/i, // Too many URLs
    /\b(viagra|casino|lottery|prize|winner|congratulations)\b/i, // Common spam words
    /[A-Z]{20,}/, // Too much uppercase
  ];
  
  return spamPatterns.some(pattern => pattern.test(content));
};
