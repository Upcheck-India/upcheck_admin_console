'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RecruitmentNav from '../../components/RecruitmentNav';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Clock, Download, Save } from 'lucide-react';

export default function SubmissionDetails({ params }) {
  const { id } = params;
  const router = useRouter();
  const [submission, setSubmission] = useState(null);
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualScores, setManualScores] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch submission data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch submission from API
        const submissionResponse = await fetch(`/api/recruitment/submissions/${id}`);
        
        if (!submissionResponse.ok) {
          throw new Error('Failed to fetch submission');
        }
        
        const submissionData = await submissionResponse.json();
        setSubmission(submissionData);
        
        // Set candidate token cookie for middleware authentication if this is a candidate viewing their submission
        // We use the candidate email as a simple token since we already authenticated to get here
        if (submissionData.candidateEmail) {
          document.cookie = `candidate_token=${submissionData.candidateEmail}; path=/; max-age=86400; SameSite=Strict`;
        }
        
        // Initialize manual scores from existing data
        if (submissionData.manualScore) {
          setManualScores(submissionData.manualScore);
        }
        
        // Fetch test details
        const testResponse = await fetch(`/api/recruitment/tests/${submissionData.testId}`);
        
        if (!testResponse.ok) {
          throw new Error('Failed to fetch test details');
        }
        
        const testData = await testResponse.json();
        setTest(testData);
      } catch (error) {
        console.error('Error fetching data:', error);
        alert('Error: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not available';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Handle manual score change
  const handleScoreChange = (questionId, score) => {
    setManualScores(prev => ({
      ...prev,
      [questionId]: parseInt(score) || 0
    }));
  };

  // Save manual scores
  const saveScores = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);
      
      const response = await fetch(`/api/recruitment/submissions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          manualScore: manualScores,
          status: 'evaluated'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save scores');
      }
      
      // Update submission with the response
      const updatedSubmission = await response.json();
      setSubmission(updatedSubmission);
      setSaveSuccess(true);
      
      // Show success message briefly
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving scores:', error);
      alert('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Calculate total score
  const calculateTotalScore = () => {
    if (!submission || !test) return 0;
    
    let total = 0;
    
    // Add auto-scored points
    if (submission.autoScore) {
      Object.values(submission.autoScore).forEach(score => {
        total += score;
      });
    }
    
    // Add manual scores being edited
    Object.values(manualScores).forEach(score => {
      total += score;
    });
    
    return total;
  };

  // Calculate maximum possible score
  const calculateMaxScore = () => {
    if (!test) return 0;
    
    return test.questions.reduce((total, q) => total + (q.points || 0), 0);
  };

  // Determine if a question needs manual scoring
  const needsManualScoring = (question) => {
    return question.type === 'text' || 
           (question.type === 'mcq' && question.allowMultiple) || 
           question.manualScoring;
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <RecruitmentNav />
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (!submission || !test) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <RecruitmentNav />
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-700">Submission not found or error loading data.</p>
          </div>
          <div className="mt-4">
            <Link href="/recruitment/results" className="text-blue-500 hover:underline">
              Return to Results
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalScore = submission.totalScore || calculateTotalScore();
  const maxScore = calculateMaxScore();
  const scorePercentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const passingScore = test.passingScore || 70;
  const passed = scorePercentage >= passingScore;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <RecruitmentNav />
      
      {/* Back button and header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <Link 
            href="/recruitment/results" 
            className="inline-flex items-center text-blue-500 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Results
          </Link>
          <h1 className="text-2xl font-bold">{test.title} - Submission Review</h1>
          <p className="text-gray-600">Candidate: {submission.candidateName} ({submission.candidateEmail})</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex items-center space-x-4">
          <div className="bg-gray-100 rounded-lg px-4 py-2 text-center">
            <div className="text-sm text-gray-500">Submitted</div>
            <div className="font-medium">{formatDate(submission.submittedAt)}</div>
          </div>
          
          <div className="bg-gray-100 rounded-lg px-4 py-2 text-center">
            <div className="text-sm text-gray-500">Time Spent</div>
            <div className="font-medium flex items-center justify-center">
              <Clock className="h-4 w-4 mr-1" />
              {submission.timeSpent ? `${submission.timeSpent} min` : 'N/A'}
            </div>
          </div>
          
          <div className={`rounded-lg px-4 py-2 text-center ${passed ? 'bg-green-100' : 'bg-red-100'}`}>
            <div className="text-sm text-gray-500">Status</div>
            <div className={`font-medium flex items-center justify-center ${passed ? 'text-green-600' : 'text-red-600'}`}>
              {passed ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Passed
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-1" />
                  Failed
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Score summary */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h2 className="text-xl font-semibold">Score Summary</h2>
            <p className="text-gray-600">
              Passing score: {passingScore}%
            </p>
          </div>
          
          <div className="mt-4 md:mt-0">
            <div className="flex items-center">
              <div className="text-3xl font-bold mr-2">{scorePercentage}%</div>
              <div className="text-gray-500">
                ({totalScore} / {maxScore} points)
              </div>
            </div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="mt-4 h-4 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${passed ? 'bg-green-500' : 'bg-red-500'}`}
            style={{ width: `${scorePercentage}%` }}
          ></div>
        </div>
        
        {/* Security warnings */}
        {submission.securityWarnings > 0 && (
          <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
              <p className="text-yellow-700">
                {submission.securityWarnings} security warning{submission.securityWarnings > 1 ? 's' : ''} detected during test
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Questions and answers */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Questions and Answers</h2>
        
        <div className="space-y-8">
          {test.questions.map((question, index) => {
            const answer = submission.answers[question.id];
            const isManualScoring = needsManualScoring(question);
            const autoScore = submission.autoScore?.[question.id] || 0;
            const manualScore = manualScores[question.id] || 0;
            
            return (
              <div key={question.id} className="border-b pb-6 last:border-b-0 last:pb-0">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-medium">
                    Q{index + 1}. {question.text}
                  </h3>
                  <div className="text-sm bg-gray-100 rounded px-2 py-1">
                    {question.type === 'mcq' ? 'Multiple Choice' : 
                     question.type === 'single' ? 'Single Answer' : 'Text Answer'}
                    <span className="ml-2 text-gray-500">{question.points} pts</span>
                  </div>
                </div>
                
                {/* Candidate's answer */}
                <div className="mt-4">
                  <div className="text-sm text-gray-500 mb-1">Candidate's Answer:</div>
                  
                  {question.type === 'text' ? (
                    <div className="bg-gray-50 p-3 rounded border">
                      {typeof answer === 'object' ? JSON.stringify(answer) : (answer || <span className="text-gray-400 italic">No answer provided</span>)}
                    </div>
                  ) : question.type === 'mcq' ? (
                    <div className="space-y-2">
                      {question.options.map((option, i) => (
                        <div 
                          key={i} 
                          className={`p-2 rounded ${Array.isArray(answer) && answer.includes(option) ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}
                        >
                          {typeof option === 'object' ? (option.text || JSON.stringify(option)) : option}
                          {Array.isArray(answer) && answer.includes(option) && (
                            <span className="ml-2 text-blue-500">✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {question.options.map((option, i) => (
                        <div 
                          key={i} 
                          className={`p-2 rounded ${answer === option ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}
                        >
                          {typeof option === 'object' ? (option.text || JSON.stringify(option)) : option}
                          {answer === option && (
                            <span className="ml-2 text-blue-500">✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Correct answer */}
                <div className="mt-4">
                  <div className="text-sm text-gray-500 mb-1">Correct Answer:</div>
                  
                  {question.type === 'text' ? (
                    <div className="bg-green-50 p-3 rounded border border-green-200">
                      {typeof question.correctAnswer === 'object' ? JSON.stringify(question.correctAnswer) : (question.correctAnswer || <span className="text-gray-400 italic">Manual evaluation required</span>)}
                    </div>
                  ) : question.type === 'mcq' ? (
                    <div className="space-y-2">
                      {question.options.map((option, i) => (
                        <div 
                          key={i} 
                          className={`p-2 rounded ${Array.isArray(question.correctAnswer) && question.correctAnswer.includes(option) ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}
                        >
                          {typeof option === 'object' ? (option.text || JSON.stringify(option)) : option}
                          {Array.isArray(question.correctAnswer) && question.correctAnswer.includes(option) && (
                            <span className="ml-2 text-green-500">✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {question.options.map((option, i) => (
                        <div 
                          key={i} 
                          className={`p-2 rounded ${question.correctAnswer === option ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}
                        >
                          {typeof option === 'object' ? (option.text || JSON.stringify(option)) : option}
                          {question.correctAnswer === option && (
                            <span className="ml-2 text-green-500">✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Scoring */}
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    {isManualScoring ? (
                      <div className="flex items-center">
                        <span className="text-sm text-gray-500 mr-2">Manual Score:</span>
                        <input 
                          type="number" 
                          min="0" 
                          max={question.points} 
                          value={manualScore} 
                          onChange={(e) => handleScoreChange(question.id, e.target.value)}
                          className="border rounded w-16 px-2 py-1"
                        />
                        <span className="text-sm text-gray-500 ml-1">/ {question.points}</span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <span className="text-sm text-gray-500 mr-2">Auto Score:</span>
                        <span className="font-medium">{autoScore} / {question.points}</span>
                      </div>
                    )}
                  </div>
                  
                  {isManualScoring && (
                    <div className="text-sm text-gray-500">
                      Requires manual evaluation
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Save button */}
      <div className="flex justify-end mb-8">
        <button
          onClick={saveScores}
          disabled={saving}
          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
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
        
        {saveSuccess && (
          <div className="ml-4 text-green-600 flex items-center">
            <CheckCircle className="h-4 w-4 mr-1" />
            Saved successfully
          </div>
        )}
      </div>
    </div>
  );
}
