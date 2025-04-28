'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Brain, Users, TrendingUp, Lock, AlertTriangle } from 'lucide-react';
import useTestFullScreen from '../../hooks/useTestFullScreen';
import FullScreenWarning from './components/FullScreenWarning';
import TestRevoked from './components/TestRevoked';

const roles = [
  { id: 'content', name: 'Content Management', icon: FileText, active: true },
  { id: 'technical', name: 'Technical', icon: Brain, active: false },
  { id: 'marketing', name: 'Marketing', icon: TrendingUp, active: false },
  { id: 'hr', name: 'Human Resources', icon: Users, active: false },
  { id: 'product', name: 'Product Management', icon: Lock, active: false }
];

export default function RecruitmentTest() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [testStarted, setTestStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentAnswers, setCurrentAnswers] = useState({});
  const [applicantId, setApplicantId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes
  const { 
    isFullScreen, 
    enterFullScreen, 
    exitFullScreen, 
    warningCount, 
    showWarning, 
    dismissWarning,
    resetWarningCount,
    isRevoked 
  } = useTestFullScreen();
  const router = useRouter();

  useEffect(() => {
    let timer;
    if (testStarted && timeLeft > 0 && !isRevoked) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleSubmit();
    }
    return () => clearInterval(timer);
  }, [testStarted, timeLeft, isRevoked]);
  
  // Effect to handle test revocation
  useEffect(() => {
    if (isRevoked && testStarted) {
      handleRevoke();
    }
  }, [isRevoked, testStarted]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/recruitment/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicantId, password })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Invalid credentials');
      }

      const data = await res.json();
      if (data.hasAttempted) {
        router.push('/recruitment/completed');
        return;
      }

      setIsLoggedIn(true);
    } catch (error) {
      setError(error.message);
    }
  };

  const handleTestStart = async (role) => {
    try {
      const res = await fetch(`/api/recruitment/questions/${role}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || 'Failed to fetch questions');
      
      setQuestions(data.questions);
      setSelectedRole(role);
      resetWarningCount();
      await enterFullScreen();
      setTestStarted(true);
    } catch (error) {
      setError(error.message);
    }
  };
  
  const handleRevoke = async () => {
    try {
      await exitFullScreen();
      
      // Call API to revoke the test
      const res = await fetch('/api/recruitment/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicantId })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to revoke test');
      }
    } catch (error) {
      console.error('Error revoking test:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      const res = await fetch('/api/recruitment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantId,
          role: selectedRole,
          answers: currentAnswers,
          timeSpent: 1800 - timeLeft // in seconds
        })
      });

      if (!res.ok) throw new Error('Failed to submit test');
      
      await exitFullScreen();
      router.push('/recruitment/completed');
    } catch (error) {
      setError(error.message);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Upcheck Recruitment Test
          </h2>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Applicant ID
                </label>
                <input
                  type="text"
                  value={applicantId}
                  onChange={(e) => setApplicantId(e.target.value)}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Start Test
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (!testStarted) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Select Your Role
          </h1>
          
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <strong>Important:</strong> This test must be taken in full-screen mode. Exiting full-screen, switching tabs, or opening other applications during the test will trigger warnings. After 5 warnings, your test will be automatically revoked.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => role.active && handleTestStart(role.id)}
                disabled={!role.active}
                className={`p-6 rounded-lg shadow-sm border-2 ${
                  role.active
                    ? 'border-blue-500 hover:border-blue-600 cursor-pointer'
                    : 'border-gray-200 opacity-50 cursor-not-allowed'
                }`}
              >
                <role.icon className="w-8 h-8 mb-4 text-blue-500" />
                <h3 className="text-lg font-medium text-gray-900">
                  {role.name}
                </h3>
                {!role.active && (
                  <span className="text-sm text-gray-500">Coming soon</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isRevoked && testStarted) {
    return <TestRevoked />;
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      {showWarning && testStarted && (
        <FullScreenWarning 
          warningCount={warningCount} 
          maxWarnings={5} 
          onDismiss={dismissWarning} 
          onResume={enterFullScreen} 
        />
      )}
      
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {roles.find(r => r.id === selectedRole)?.name} Test
          </h1>
          <div className="text-lg font-medium">
            Time Left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
        </div>

        <div className="space-y-8">
          {questions.map((question, index) => (
            <div key={index} className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {index + 1}. {question.text}
              </h3>
              <div className="space-y-4">
                {question.type === 'multiple-choice' ? (
                  question.options.map((option, optIndex) => (
                    <label key={optIndex} className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name={`question-${index}`}
                        value={option}
                        checked={currentAnswers[index] === option}
                        onChange={(e) => setCurrentAnswers({
                          ...currentAnswers,
                          [index]: e.target.value
                        })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700">{option}</span>
                    </label>
                  ))
                ) : (
                  <textarea
                    value={currentAnswers[index] || ''}
                    onChange={(e) => setCurrentAnswers({
                      ...currentAnswers,
                      [index]: e.target.value
                    })}
                    rows="4"
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Type your answer here..."
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSubmit}
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Submit Test
          </button>
        </div>
      </div>
    </div>
  );
}