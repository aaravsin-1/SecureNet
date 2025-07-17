
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface CaptchaProps {
  onVerify: (isVerified: boolean) => void;
  className?: string;
}

export const Captcha: React.FC<CaptchaProps> = ({ onVerify, className = '' }) => {
  const [challenge, setChallenge] = useState(generateChallenge());
  const [userAnswer, setUserAnswer] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  function generateChallenge() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operators = ['+', '-', '*'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    let answer: number;
    switch (operator) {
      case '+':
        answer = num1 + num2;
        break;
      case '-':
        answer = num1 - num2;
        break;
      case '*':
        answer = num1 * num2;
        break;
      default:
        answer = num1 + num2;
    }
    
    return {
      question: `${num1} ${operator} ${num2} = ?`,
      answer: answer.toString(),
    };
  }

  const handleAnswerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const answer = e.target.value;
    setUserAnswer(answer);
    
    if (answer === challenge.answer) {
      setIsVerified(true);
      onVerify(true);
    } else {
      setIsVerified(false);
      onVerify(false);
    }
  };

  const refreshChallenge = () => {
    setChallenge(generateChallenge());
    setUserAnswer('');
    setIsVerified(false);
    onVerify(false);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium text-primary">Security Check</label>
      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-muted p-3 rounded border text-center font-mono">
          {challenge.question}
        </div>
        <input
          type="text"
          value={userAnswer}
          onChange={handleAnswerChange}
          className="w-20 px-3 py-2 border rounded text-center"
          placeholder="Answer"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refreshChallenge}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      {isVerified && (
        <div className="text-sm text-green-600">✓ Verification successful</div>
      )}
    </div>
  );
};
