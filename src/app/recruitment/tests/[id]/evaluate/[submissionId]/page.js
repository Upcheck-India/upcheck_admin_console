'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RecruitmentNav from '../../../../components/RecruitmentNav';
import { 
  ArrowLeft, 
  Save, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Clock,
  User,
  FileText
} from 'lucide-react';

export default function EvaluateSubmission({ params }) {
  const router = useRouter();
  const { id, submissionId } = params;
  
  const [submission, setSubmission] = useState(null);
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState({});
  const [feedback, setFeedback] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [maxPossibleScore, setMaxPossibleScore] = useState(0);
  
  // Fetch submission and test data
  useEffect(() => {
    // This would be replaced with actual API calls
    const fetchData = async () => {
      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Mock test data
        const mockTest = {
          id,
          title: 'Frontend Developer Assessment',
          description: 'This test evaluates candidates on their knowledge of HTML, CSS, JavaScript, and React fundamentals.',
          passingScore: 70,
          questions: [
            { 
              id: 'q1', 
              type: 'mcq', 
              text: 'What is the correct way to create a React component?',
              options: [
                { id: 'a', text: 'class MyComponent extends React.Component {}' },
                { id: 'b', text: 'function MyComponent() {}' },
                { id: 'c', text: 'const MyComponent = () => {}' },
                { id: 'd', text: 'All of the above' }
              ],
              correctOptions: ['d'],
              points: 10
            },
            { 
              id: 'q2', 
              type: 'text', 
              text: 'Explain the concept of closures in JavaScript.',
              points: 20
            },
            { 
              id: 'q3', 
              type: 'single', 
              text: 'Which of these is NOT a valid CSS selector?',
              options: [
                { id: 'a', text: '.class-name' },
                { id: 'b', text: '#id-name' },
                { id: 'c', text: '::first-line' },
                { id: 'd', text: '%%element' }
              ],
              correctOption: 'd',
              points: 10
            }
          ]
        };
        
        // Mock submission data
        const mockSubmission = {
          id: submissionId,
          testId: id,
          candidateName: 'John Doe',
          candidateEmail: 'john@example.com',
          submittedAt: '2025-06-02T14:30:00Z',
          timeSpent: 42, // minutes
          securityWarnings: 1,
          answers: {
            q1: ['d'], // Correct
            q2: 'A closure is a function that has access to its own scope, the scope of the outer function, and the global scope. It allows a function to access variables from an enclosing scope even after the outer function has returned.', // Needs manual evaluation
            q3: 'd' // Correct
          },
          autoScore: {
            q1: 10, // Full points
            q3: 10  // Full points
          }
        };
        
        setTest(mockTest);
        setSubmission(mockSubmission);
        
        // Initialize scores with auto-scored values
        const initialScores = {};
        let initialMaxScore = 0;
        let initialTotalScore = 0;
        
        mockTest.questions.forEach(question => {
          initialMaxScore += question.points;
          
          if (mockSubmission.autoScore && mockSubmission.autoScore[question.id] !== undefined) {
            // For auto-scored questions
            initialScores[question.id] = mockSubmission.autoScore[question.id];
            initialTotalScore += mockSubmission.autoScore[question.id];
          } else if (question.type === 'text') {
            // For text questions that need manual scoring
            initialScores[question.id] = 0;
          }
        });
        
        setScores(initialScores);
        setMaxPossibleScore(initialMaxScore);
        setTotalScore(initialTotalScore);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, submissionId]);
  
  // Update total score when individual scores change
  useEffect(() => {
    if (test) {
      let total = 0;
      Object.keys(scores).forEach(questionId => {
        total += scores[questionId];
      });
      setTotalScore(total);
    }
  }, [scores, test]);
  
  // Handle score change for a question
  const handleScoreChange = (questionId, value) => {
    const question = test.questions.find(q => q.id === questionId);
    const maxPoints = question ? question.points : 0;
    const newScore = Math.min(Math.max(0, parseInt(value) || 0), maxPoints);
    
    setScores(prev => ({
      ...prev,
      [questionId]: newScore
    }));
  };
  
  // Handle feedback change for a question
  const handleFeedbackChange = (questionId, value) => {
    setFeedback(prev => ({
      ...prev,
      [questionId]: value
    }));
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not available';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Calculate percentage score
  const calculatePercentage = () => {
    if (maxPossibleScore === 0) return 0;
    return Math.round((totalScore / maxPossibleScore) * 100);
  };
  
  // Handle save evaluation
  const handleSaveEvaluation = async () => {
    setIsSaving(true);
    
    try {
      // This would be an API call in a real application
      console.log('Saving evaluation:', {
        submissionId,
        scores,
        feedback,
        totalScore,
        percentage: calculatePercentage()
      });
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Redirect to the test details page
      router.push(`/recruitment/tests/${id}`);
    } catch (error) {
      console.error('Error saving evaluation:', error);
      alert('Failed to save evaluation. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (!submission || !test) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                Submission not found. The submission may have been deleted or you don't have permission to view it.
              </p>
              <Link 
                href={`/recruitment/tests/${id}`} 
                className="mt-2 inline-flex text-sm text-red-700 underline"
              >
                Return to test details
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <Link 
            href={`/recruitment/tests/${id}`} 
            className="mr-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Evaluate Submission</h1>
            <p className="text-gray-600 mt-1">{test.title}</p>
          </div>
        </div>
      </div>
      
      {/* Candidate Info */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Candidate Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-start">
              <User className="h-5 w-5 text-gray-400 mt-0.5 mr-2" />
              <div>
                <p className="text-sm font-medium text-gray-500">Name</p>
                <p className="text-lg font-medium">{submission.candidateName}</p>
              </div>
            </div>
          </div>
          
          <div>
            <div className="flex items-start">
              <FileText className="h-5 w-5 text-gray-400 mt-0.5 mr-2" />
              <div>
                <p className="text-sm font-medium text-gray-500">Email</p>
                <p className="text-lg">{submission.candidateEmail}</p>
              </div>
            </div>
          </div>
          
          <div>
            <div className="flex items-start">
              <Clock className="h-5 w-5 text-gray-400 mt-0.5 mr-2" />
              <div>
                <p className="text-sm font-medium text-gray-500">Submitted</p>
                <p className="text-lg">{formatDate(submission.submittedAt)}</p>
              </div>
            </div>
          </div>
          
          <div>
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-gray-400 mt-0.5 mr-2" />
              <div>
                <p className="text-sm font-medium text-gray-500">Security Warnings</p>
                <p className="text-lg">{submission.securityWarnings || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Evaluation Summary */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Evaluation Summary</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Current Score</p>
            <div className="flex items-baseline">
              <p className="text-3xl font-bold">{calculatePercentage()}%</p>
              <p className="text-gray-500 ml-2">
                ({totalScore} / {maxPossibleScore} points)
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-sm font-medium text-gray-500">Status</p>
            {calculatePercentage() >= test.passingScore ? (
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-5 w-5 mr-1" />
                <span className="font-medium">Passed</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600">
                <XCircle className="h-5 w-5 mr-1" />
                <span className="font-medium">Failed</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className={`h-2.5 rounded-full ${calculatePercentage() >= test.passingScore ? 'bg-green-600' : 'bg-red-600'}`}
            style={{ width: `${calculatePercentage()}%` }}
          ></div>
        </div>
        
        <p className="text-sm text-gray-500 mt-2">
          Passing score: {test.passingScore}%
        </p>
      </div>
      
      {/* Questions and Answers */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Questions and Answers</h2>
        
        <div className="space-y-8">
          {test.questions.map((question, index) => {
            const answer = submission.answers[question.id];
            const isAutoScored = question.type !== 'text';
            const isCorrect = 
              (question.type === 'mcq' && 
               JSON.stringify(answer?.sort()) === JSON.stringify(question.correctOptions.sort())) ||
              (question.type === 'single' && answer === question.correctOption);
            
            return (
              <div key={question.id} className="border-b border-gray-200 pb-6 last:border-0 last:pb-0">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded mr-2">
                      {question.type === 'mcq' ? 'Multiple Choice' : 
                       question.type === 'text' ? 'Text Answer' : 'Single Choice'}
                    </span>
                    <span className="text-gray-500 text-sm">Question {index + 1}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-500">{question.points} points</span>
                </div>
                
                <p className="text-gray-900 font-medium mb-3">{question.text}</p>
                
                {/* Display answer based on question type */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Candidate's Answer:</p>
                  
                  {question.type === 'text' && (
                    <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                      <p className="text-gray-800 whitespace-pre-wrap">{answer || 'No answer provided'}</p>
                    </div>
                  )}
                  
                  {question.type === 'mcq' && (
                    <div className="space-y-2">
                      {question.options.map(option => {
                        const isSelected = answer && answer.includes(option.id);
                        const isCorrectOption = question.correctOptions.includes(option.id);
                        
                        return (
                          <div 
                            key={option.id} 
                            className={`p-2 rounded-md flex items-start ${isSelected ? (isCorrectOption ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200') : 'bg-gray-50 border border-gray-200'}`}
                          >
                            <div className="mr-2 mt-0.5">
                              {isSelected ? (
                                isCorrectOption ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                )
                              ) : isCorrectOption ? (
                                <div className="h-4 w-4 border-2 border-green-600 rounded-full" />
                              ) : (
                                <div className="h-4 w-4 border border-gray-300 rounded-full" />
                              )}
                            </div>
                            <span className={`text-sm ${isSelected && !isCorrectOption ? 'text-red-800' : isCorrectOption ? 'text-green-800' : 'text-gray-800'}`}>
                              {option.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {question.type === 'single' && (
                    <div className="space-y-2">
                      {question.options.map(option => {
                        const isSelected = answer === option.id;
                        const isCorrectOption = question.correctOption === option.id;
                        
                        return (
                          <div 
                            key={option.id} 
                            className={`p-2 rounded-md flex items-start ${isSelected ? (isCorrectOption ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200') : 'bg-gray-50 border border-gray-200'}`}
                          >
                            <div className="mr-2 mt-0.5">
                              {isSelected ? (
                                isCorrectOption ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                )
                              ) : isCorrectOption ? (
                                <div className="h-4 w-4 border-2 border-green-600 rounded-full" />
                              ) : (
                                <div className="h-4 w-4 border border-gray-300 rounded-full" />
                              )}
                            </div>
                            <span className={`text-sm ${isSelected && !isCorrectOption ? 'text-red-800' : isCorrectOption ? 'text-green-800' : 'text-gray-800'}`}>
                              {option.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* Scoring section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor={`score-${question.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                      Score
                    </label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        id={`score-${question.id}`}
                        value={scores[question.id] || 0}
                        onChange={(e) => handleScoreChange(question.id, e.target.value)}
                        className={`w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isAutoScored ? 'bg-gray-100' : ''}`}
                        min="0"
                        max={question.points}
                        disabled={isAutoScored}
                      />
                      <span className="text-gray-500 ml-2">/ {question.points}</span>
                      {isAutoScored && (
                        <span className="ml-3 text-xs text-gray-500 italic">Auto-scored</span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor={`feedback-${question.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                      Feedback (Optional)
                    </label>
                    <textarea
                      id={`feedback-${question.id}`}
                      value={feedback[question.id] || ''}
                      onChange={(e) => handleFeedbackChange(question.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="2"
                      placeholder="Provide feedback on this answer..."
                    ></textarea>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex justify-end space-x-4">
        <Link
          href={`/recruitment/tests/${id}`}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </Link>
        
        <button
          onClick={handleSaveEvaluation}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Evaluation
            </>
          )}
        </button>
      </div>
    </div>
  );
}
