
import React from 'react';
import { validatePassword, getPasswordStrengthLabel, getPasswordStrengthColor } from '@/utils/passwordValidator';

interface PasswordStrengthProps {
  password: string;
  showDetails?: boolean;
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({ 
  password, 
  showDetails = true 
}) => {
  const validation = validatePassword(password);

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-muted rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              validation.score <= 1 ? 'bg-red-500' :
              validation.score <= 2 ? 'bg-orange-500' :
              validation.score <= 3 ? 'bg-yellow-500' :
              validation.score <= 4 ? 'bg-blue-500' :
              'bg-green-500'
            }`}
            style={{ width: `${(validation.score / 6) * 100}%` }}
          />
        </div>
        <span className={`text-sm font-medium ${getPasswordStrengthColor(validation.score)}`}>
          {getPasswordStrengthLabel(validation.score)}
        </span>
      </div>

      {showDetails && validation.errors.length > 0 && (
        <div className="text-sm text-destructive space-y-1">
          {validation.errors.map((error, index) => (
            <div key={index}>• {error}</div>
          ))}
        </div>
      )}

      {showDetails && validation.suggestions.length > 0 && (
        <div className="text-sm text-muted-foreground space-y-1">
          {validation.suggestions.map((suggestion, index) => (
            <div key={index}>💡 {suggestion}</div>
          ))}
        </div>
      )}
    </div>
  );
};
