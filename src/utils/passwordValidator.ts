
export interface PasswordValidation {
  isValid: boolean;
  score: number;
  errors: string[];
  suggestions: string[];
}

export const validatePassword = (password: string): PasswordValidation => {
  const errors: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else if (password.length >= 8) {
    score += 1;
  }

  if (password.length >= 12) {
    score += 1;
  }

  // Character type checks
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasLowercase) {
    errors.push('Password must contain lowercase letters');
  } else {
    score += 1;
  }

  if (!hasUppercase) {
    errors.push('Password must contain uppercase letters');
  } else {
    score += 1;
  }

  if (!hasNumbers) {
    errors.push('Password must contain numbers');
  } else {
    score += 1;
  }

  if (!hasSpecialChars) {
    errors.push('Password must contain special characters');
    suggestions.push('Try adding symbols like !@#$%^&*');
  } else {
    score += 1;
  }

  // Common patterns check
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /abc123/i,
    /admin/i,
  ];

  const hasCommonPattern = commonPatterns.some(pattern => pattern.test(password));
  if (hasCommonPattern) {
    errors.push('Password contains common patterns');
    suggestions.push('Avoid using common words or sequences');
    score -= 1;
  }

  // Repetitive characters
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password contains too many repeated characters');
    suggestions.push('Use more varied characters');
    score -= 1;
  }

  score = Math.max(0, Math.min(6, score));

  return {
    isValid: errors.length === 0 && score >= 4,
    score,
    errors,
    suggestions,
  };
};

export const getPasswordStrengthLabel = (score: number): string => {
  switch (score) {
    case 0:
    case 1:
      return 'Very Weak';
    case 2:
      return 'Weak';
    case 3:
      return 'Fair';
    case 4:
      return 'Good';
    case 5:
      return 'Strong';
    case 6:
      return 'Very Strong';
    default:
      return 'Unknown';
  }
};

export const getPasswordStrengthColor = (score: number): string => {
  switch (score) {
    case 0:
    case 1:
      return 'text-red-500';
    case 2:
      return 'text-orange-500';
    case 3:
      return 'text-yellow-500';
    case 4:
      return 'text-blue-500';
    case 5:
    case 6:
      return 'text-green-500';
    default:
      return 'text-gray-500';
  }
};
