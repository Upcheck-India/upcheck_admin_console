'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Clock, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Maximize,
  Minimize
} from 'lucide-react';

export default function TakeTest({ params }) {
  // Use React.use() for params.token in the future as per Next.js recommendation
  const token = params.token;
  const router = useRouter();
  
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [readyToStart, setReadyToStart] = useState(false);
  const [candidate, setCandidate] = useState(null);
  const [error, setError] = useState('');
  
  const fullscreenRef = useRef(null);
  const timerRef = useRef(null);
  
  // Handle username/password login
  const authenticate = async () => {
    try {
      setAuthError('');
      setLoading(true);
      
      // Authenticate with username and password
      const authResponse = await fetch('/api/recruitment/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username, 
          password,
          token // Include token as a fallback
        }),
      });
      
      if (!authResponse.ok) {
        const errorData = await authResponse.json();
        
        // If test was already completed, redirect to submission page
        if (errorData.error === 'Test already completed' && errorData.submissionId) {
          alert('This test has already been submitted. Redirecting to your submission.');
          router.push(`/recruitment/submissions/${errorData.submissionId}`);
          return;
        }
        
        throw new Error(errorData.error || 'Invalid credentials');
      }
      
      const authData = await authResponse.json();
      setTest(authData.test);
      setCandidate(authData.candidate);
      setCandidateName(authData.candidate.name);
      setCandidateEmail(authData.candidate.email);
      setIsAuthenticated(true);
      
      // Set candidate token cookie for middleware authentication
      document.cookie = `candidate_token=${token}; path=/; max-age=86400; SameSite=Strict`;
      
      // Initialize timer if test has time limit
      if (authData.test.timeLimit) {
        setTimeRemaining(authData.test.timeLimit * 60); // Convert minutes to seconds
      }
      
      // Initialize empty answers object
      const initialAnswers = {};
      authData.test.questions.forEach(question => {
        initialAnswers[question.id] = '';
      });
      setAnswers(initialAnswers);
    } catch (error) {
      console.error('Authentication error:', error);
      setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Try to authenticate with token first, then show login form if needed
  useEffect(() => {
    const authenticateWithToken = async () => {
      try {
        setLoading(true);
        
        // Try to authenticate with token first
        const authResponse = await fetch('/api/recruitment/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });
        
        if (!authResponse.ok) {
          const errorData = await authResponse.json();
          
          // If test was already completed, redirect to submission page
          if (errorData.error === 'Test already completed' && errorData.submissionId) {
            alert('This test has already been submitted.');
            return;
          }
        } else {
          // Token authentication successful
          const authData = await authResponse.json();
          setTest(authData.test);
          setCandidate(authData.candidate);
          setCandidateName(authData.candidate.name);
          setCandidateEmail(authData.candidate.email);
          setIsAuthenticated(true);
          
          // Set candidate token cookie for middleware authentication
          document.cookie = `candidate_token=${token}; path=/; max-age=86400; SameSite=Strict`;
          
          // Initialize timer if test has time limit
          if (authData.test.timeLimit) {
            setTimeRemaining(authData.test.timeLimit * 60); // Convert minutes to seconds
          }
          
          // Initialize empty answers object
          const initialAnswers = {};
          authData.test.questions.forEach(question => {
            initialAnswers[question.id] = '';
          });
          setAnswers(initialAnswers);
          return;
        }
        
        // If token auth failed, still try to get basic test info
        const response = await fetch(`/api/recruitment/token/${token}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          
          // If test was already submitted, redirect to the submission page
          if (errorData.error === 'Test already submitted' && errorData.submissionId) {
            alert('This test has already been submitted. Redirecting to your submission.');
            router.push(`/recruitment/submissions/${errorData.submissionId}`);
            return;
          }
          
          throw new Error(errorData.error || 'Failed to fetch test data');
        }
        
        const data = await response.json();
        setTest(data);
        
        // Don't set isAuthenticated here - user will need to log in with credentials
      } catch (error) {
        console.error('Error fetching test:', error);
        alert('Error: ' + error.message);
        router.push('/');
      } finally {
        setLoading(false);
      }
    };
    
    const authenticate = async () => {
      try {
        const response = await fetch('/api/recruitment/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password }),
        });
        
        if (response.ok) {
          const data = await response.json();
          setTest(data.test);
          setCandidate(data.candidate);
          setCandidateName(data.candidate.name);
          setCandidateEmail(data.candidate.email);
          setIsAuthenticated(true);
        } else {
          setAuthError('Invalid username or password');
        }
      } catch (error) {
        console.error('Error authenticating:', error);
        setAuthError('Error authenticating');
      }
    };
    
    authenticateWithToken();
  }, [token, router, username, password, isAuthenticated]);
  
  // Timer effect
  useEffect(() => {
    if (!loading && test && test.duration && timeRemaining > 0 && !testSubmitted) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Auto-submit when time expires
            clearInterval(timerRef.current);
            handleSubmitTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [loading, test, testSubmitted]);
  
  // Security settings effect
  useEffect(() => {
    if (!loading && test) {
      // Set up event listeners for fullscreen changes
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('mozfullscreenchange', handleFullscreenChange);
      document.addEventListener('msfullscreenchange', handleFullscreenChange);
      
      // Set up event listener for visibility changes (tab switching)
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // We'll show a button for the user to enter fullscreen mode if required
      // This avoids the 'API can only be initiated by a user gesture' error
      // The fullscreen will be prompted via a button click instead of automatic activation
      
      return () => {
        // Clean up event listeners
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
        document.removeEventListener('msfullscreenchange', handleFullscreenChange);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [loading, test, isFullscreen]);
    
  // Clean up function for main useEffect
  useEffect(() => {
    return () => {
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  // Start timer when test is loaded
  useEffect(() => {
    if (test && isAuthenticated && !testSubmitted) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Time's up, submit the test
            clearInterval(timerRef.current);
            handleSubmitTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [test, isAuthenticated, testSubmitted]);
  
  // Format time remaining
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle fullscreen change
  const handleFullscreenChange = () => {
    const isDocFullscreen = 
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;
    
    setIsFullscreen(!!isDocFullscreen);
    
    if (test?.securitySettings.fullScreenRequired && !isDocFullscreen && isAuthenticated) {
      // User exited fullscreen
      triggerWarning('You must stay in fullscreen mode during the test.');
    }
  };
  
  // Handle visibility change (tab switching)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden' && isAuthenticated && !testSubmitted) {
      triggerWarning('Switching tabs or windows is not allowed during the test.');
    }
  };
  
  // Toggle fullscreen with additional safeguards
  const toggleFullscreen = () => {
    try {
      if (!isFullscreen && fullscreenRef.current) {
        console.log('Attempting to enter fullscreen mode');
        // Try to enter fullscreen mode with various browser prefixes
        if (fullscreenRef.current.requestFullscreen) {
          fullscreenRef.current.requestFullscreen();
        } else if (fullscreenRef.current.webkitRequestFullscreen) {
          fullscreenRef.current.webkitRequestFullscreen();
        } else if (fullscreenRef.current.mozRequestFullScreen) {
          fullscreenRef.current.mozRequestFullScreen();
        } else if (fullscreenRef.current.msRequestFullscreen) {
          fullscreenRef.current.msRequestFullscreen();
        } else {
          console.warn('Fullscreen API not supported by this browser');
        }
      } else if (document && isFullscreen) {
        console.log('Attempting to exit fullscreen mode');
        // Only attempt to exit if document exists and we're in fullscreen mode
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        } else {
          console.warn('Exit fullscreen API not supported by this browser');
        }
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
      // If fullscreen fails, still allow the test to proceed
      setReadyToStart(true);
    }
  };
  
  // Trigger a warning
  const triggerWarning = (message) => {
    setWarningCount(prev => {
      const newCount = prev + 1;
      
      // Check if max warnings reached
      if (test && newCount >= test.securitySettings.maxWarnings) {
        if (test.securitySettings.actionOnMaxWarnings === 'terminate') {
          // Terminate the test
          handleSubmitTest();
        }
      }
      
      return newCount;
    });
    
    setShowWarning(true);
    setTimeout(() => setShowWarning(false), 5000);
  };
  
  // Handle answer change
  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };
  
  // Navigate to previous question
  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };
  
  // Navigate to next question
  const goToNextQuestion = () => {
    if (test && currentQuestionIndex < test.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };
  
  // Handle test submission
  const handleSubmitTest = async () => {
    try {
      setLoading(true);
      
      // Calculate time spent in seconds
      const timeSpent = test.duration * 60 - timeRemaining;
      
      // Prepare submission data
      const submissionData = {
        testId: test.id,
        candidateEmail: candidateEmail,
        candidateName: candidateName,
        answers,
        timeSpent
      };
      
      // Add invitationId if available
      if (test.invitation?.id) {
        submissionData.invitationId = test.invitation.id;
      } else if (candidate?.id) {
        // If candidate exists but not through invitation
        submissionData.candidateId = candidate.id;
      }
      
      console.log('Submitting test with data:', submissionData);
      
      // Submit test to API
      const response = await fetch('/api/recruitment/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submissionData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit test');
      }
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      setTestSubmitted(true);
    } catch (error) {
      console.error('Error submitting test:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle authentication form submission
  const handleAuthentication = (e) => {
    e.preventDefault();
    
    if (candidateName && candidateEmail) {
      setIsAuthenticated(true);
      
      // We'll show a button for fullscreen mode instead of automatically entering it
      setReadyToStart(true);
    }
  };
  
  // Render current question
  const renderQuestion = () => {
    if (!test || currentQuestionIndex >= test.questions.length) return null;
    
    const question = test.questions[currentQuestionIndex];
    
    return (
      <div className="mb-8">
        <div className="text-lg font-medium mb-4">
          <span className="text-blue-600 mr-2">Question {currentQuestionIndex + 1}:</span>
          {question.text}
        </div>
        
        {question.type === 'mcq' && (
          <div className="space-y-3">
            {question.options.map(option => (
              <label key={option.id} className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={answers[question.id]?.includes(option.id) || false}
                  onChange={(e) => {
                    const currentAnswers = answers[question.id] || [];
                    if (e.target.checked) {
                      handleAnswerChange(question.id, [...currentAnswers, option.id]);
                    } else {
                      handleAnswerChange(
                        question.id,
                        currentAnswers.filter(id => id !== option.id)
                      );
                    }
                  }}
                  className="h-5 w-5 text-blue-600 border-gray-300 rounded mt-0.5"
                />
                <span className="ml-3">{option.text}</span>
              </label>
            ))}
          </div>
        )}
        
        {question.type === 'single' && (
          <div className="space-y-3">
            {question.options.map(option => (
              <label key={option.id} className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  checked={answers[question.id] === option.id}
                  onChange={() => handleAnswerChange(question.id, option.id)}
                  className="h-5 w-5 text-blue-600 border-gray-300 mt-0.5"
                />
                <span className="ml-3">{option.text}</span>
              </label>
            ))}
          </div>
        )}
        
        {question.type === 'text' && (
          <textarea
            value={answers[question.id] || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            rows="6"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type your answer here..."
          ></textarea>
        )}
      </div>
    );
  };
  
  // Calculate progress
  const calculateProgress = () => {
    if (!test) return 0;
    
    const answeredQuestions = Object.keys(answers).length;
    return Math.round((answeredQuestions / test.questions.length) * 100);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (!test) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-center text-gray-900 mb-2">Test Not Found</h2>
          <p className="text-gray-600 text-center mb-6">
            The test you're looking for doesn't exist or the link has expired.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }
  
  // Authentication screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto mb-4 relative">
              <Image 
                src="/Upcheck_logo_thumbnail.png" 
                alt="Organization Logo" 
                layout="fill"
                objectFit="contain"
              />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{test ? test.title : 'Candidate Login'}</h2>
            <p className="text-gray-600 mt-1">{test ? test.description : 'Please login to access your test'}</p>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            authenticate();
          }} className="space-y-4">
            {authError && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{authError}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your.email@example.com"
                required
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                required
              />
            </div>
            
            {test && (
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      This test will take approximately {test.timeLimit} minutes to complete.
                      {test.securitySettings && test.securitySettings.fullScreenRequired && ' You will be required to stay in fullscreen mode during the test.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <button
              type="submit"
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Login to Continue
            </button>
            
            <p className="text-xs text-gray-500 text-center mt-4">
              Your test administrator should have provided you with login credentials.
              If you don't have them, please contact your administrator.
            </p>
          </form>
        </div>
      </div>
    );
  }
  
  // If authenticated but not ready to start, show the start screen
  if (isAuthenticated && !readyToStart) {
    return (
      <div ref={fullscreenRef} className="min-h-screen flex justify-center items-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto mb-4 relative">
              <Image 
                src="/Upcheck_logo_thumbnail.png" 
                alt="Organization Logo" 
                layout="fill"
                objectFit="contain"
              />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{test.title}</h2>
            <p className="text-gray-600 mt-1">{test.description}</p>
          </div>
          
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <strong>Test Instructions:</strong>
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  {test.securitySettings?.fullScreenRequired ? 
                    'This test requires fullscreen mode. You will need to click the button below to start the test in fullscreen mode.' : 
                    'You are about to start the test. Click the button below when you are ready.'}
                </p>
                {test.timeLimit && (
                  <p className="text-sm text-blue-700 mt-1">
                    <strong>Time Limit:</strong> {Math.floor(test.timeLimit / 60)} minutes
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <button
            onClick={() => {
              if (test.securitySettings?.fullScreenRequired) {
                toggleFullscreen();
              }
              setReadyToStart(true);
            }}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            {test.securitySettings?.fullScreenRequired ? (
              <>
                <Maximize className="mr-2 h-5 w-5" />
                Start Test in Fullscreen Mode
              </>
            ) : (
              'Start Test'
            )}
          </button>
        </div>
      </div>
    );
  }
  
  // Test completion screen
  if (testSubmitted) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Test Submitted!</h2>
          <p className="text-gray-600 mb-6">
            Thank you for completing the test. Your responses have been recorded.
          </p>
          <button
            onClick={() => router.push('/')}
            className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }
  
  // Main test interface
  return (
    <div ref={fullscreenRef} className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm p-4 flex justify-between items-center">
        <div className="flex items-center">
          <div className="w-8 h-8 relative mr-3">
            <Image 
              src="/Upcheck_logo_thumbnail.png" 
              alt="Organization Logo" 
              layout="fill"
              objectFit="contain"
            />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">{test.title}</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-blue-50 px-3 py-1 rounded-full">
            <Clock className="h-4 w-4 text-blue-600 mr-1" />
            <span className="text-sm font-medium text-blue-800">{formatTime(timeRemaining)}</span>
          </div>
          
          <button 
            onClick={toggleFullscreen}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </header>
      
      {/* Warning notification */}
      {showWarning && (
        <div className="fixed top-4 right-4 bg-red-100 border-l-4 border-red-500 p-4 max-w-md rounded-md shadow-lg z-50 animate-fade-in-out">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                Warning {warningCount} of {test.securitySettings.maxWarnings}: You must stay in fullscreen mode during the test.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Main content */}
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <div className="bg-white rounded-xl shadow-lg p-6">
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Question {currentQuestionIndex + 1} of {test.questions.length}
              </span>
              <span className="text-sm font-medium text-gray-700">
                {calculateProgress()}% Complete
              </span>
            </div>
            <div className="bg-gray-200 h-2 rounded-full">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${calculateProgress()}%` }}
              ></div>
            </div>
          </div>
          
          {/* Question */}
          {renderQuestion()}
          
          {/* Navigation buttons */}
          <div className="flex justify-between">
            <button
              onClick={goToPreviousQuestion}
              disabled={currentQuestionIndex === 0}
              className="px-4 py-2 flex items-center text-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-5 w-5 mr-1" />
              Previous
            </button>
            
            {currentQuestionIndex < test.questions.length - 1 ? (
              <button
                onClick={goToNextQuestion}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                Next
                <ChevronRight className="h-5 w-5 ml-1" />
              </button>
            ) : (
              <button
                onClick={handleSubmitTest}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
              >
                Submit Test
                <CheckCircle className="h-5 w-5 ml-1" />
              </button>
            )}
          </div>
        </div>
      </main>
      
      {/* Question navigation sidebar */}
      <div className="fixed bottom-4 left-4 bg-white rounded-xl shadow-lg p-4 z-10">
        <div className="grid grid-cols-5 gap-2">
          {test.questions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentQuestionIndex(index)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentQuestionIndex === index ? 'bg-blue-600 text-white' : answers[test.questions[index].id] ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
