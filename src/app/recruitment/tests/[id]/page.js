'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RecruitmentNav from '../../components/RecruitmentNav';
import { 
  Plus,
  ArrowLeft, 
  Edit, 
  Trash2, 
  Copy, 
  Send, 
  Users, 
  CheckCircle,
  Clock,
  Settings,
  AlertTriangle,
  Eye,
  Download
} from 'lucide-react';

export default function TestDetails({ params }) {
  const router = useRouter();
  const { id } = params;
  
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [candidatePassword, setCandidatePassword] = useState('');
  const [isCreatingCandidate, setIsCreatingCandidate] = useState(false);
  
  // Fetch test data
  useEffect(() => {
    const fetchTest = async () => {
      try {
        setLoading(true);
        
        // Fetch test data from API
        const response = await fetch(`/api/recruitment/tests/${id}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch test');
        }
        
        const data = await response.json();
        setTest(data);
        
      } catch (error) {
        console.error('Error fetching test:', error);
        alert('Error: ' + error.message);
        router.push('/recruitment');
      } finally {
        setLoading(false);
      }
    };
    // Call the fetch function
    fetchTest();
  }, [id]);
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Handle invite submission
  const handleInvite = async (e) => {
    e.preventDefault();
    
    if (!inviteEmail) {
      alert('Please enter an email address');
      return;
    }
    
    try {
      setIsInviting(true);
      
      const response = await fetch('/api/recruitment/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testId: id,
          email: inviteEmail,
          name: inviteName || undefined
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }
      
      // Update the test data with the new candidate
      setTest(prevTest => ({
        ...prevTest,
        candidates: [...prevTest.candidates, data.invitation]
      }));
      
      setInviteLink(data.inviteLink);
      setInviteEmail('');
      setInviteName('');
      
      // Don't close the modal yet, show the invite link
    } catch (error) {
      console.error('Error sending invitation:', error);
      alert('Error: ' + error.message);
    } finally {
      setIsInviting(false);
    }
  };
  
  // Handle candidate creation with credentials
  const handleCreateCandidate = async (e) => {
    e.preventDefault();
    
    if (!candidateEmail) {
      alert('Please enter an email address');
      return;
    }
    
    try {
      setIsCreatingCandidate(true);
      
      const response = await fetch('/api/recruitment/candidates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testId: id,
          email: candidateEmail,
          name: candidateName || undefined,
          password: candidatePassword || undefined // If not provided, a random password will be generated
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create candidate');
      }
      
      // Update the test data with the new candidate
      setTest(prevTest => ({
        ...prevTest,
        candidates: [...prevTest.candidates, data.candidate]
      }));
      
      // Show success message with credentials
      alert(`Candidate created successfully!

Username: ${data.candidate.email}
Password: ${data.candidate.password}
Invite Link: ${window.location.origin}${data.candidate.inviteLink}`);
      
      // Reset form and close modal
      setCandidateEmail('');
      setCandidateName('');
      setCandidatePassword('');
      setShowCandidateModal(false);
    } catch (error) {
      console.error('Error creating candidate:', error);
      alert('Error: ' + error.message);
    } finally {
      setIsCreatingCandidate(false);
    }
  };
  
  // Generate invite link
  const generateInviteLink = (token) => {
    if (!token) {
      return 'Token required to generate invite link';
    }
    return `${window.location.origin}/recruitment/take/${token}`;
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
  
  if (!test) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <RecruitmentNav />
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                Test not found. The test may have been deleted or you don't have permission to view it.
              </p>
              <Link 
                href="/recruitment" 
                className="mt-2 inline-flex text-sm text-red-700 underline"
              >
                Return to recruitment dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <RecruitmentNav />
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <Link 
            href="/recruitment" 
            className="mr-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{test.title}</h1>
            <div className="flex items-center mt-1">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                test.status === 'active' ? 'bg-green-100 text-green-800' :
                test.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
              </span>
              <span className="text-gray-500 text-sm ml-4">
                Created: {formatDate(test.createdAt)}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-between mt-4 gap-4">
          <div className="flex space-x-2">
            <button 
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center"
              onClick={() => router.push(`/recruitment/tests/${id}/edit`)}
            >
              <Edit size={16} className="mr-1" />
              Edit
            </button>
            
            <button 
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center"
              onClick={() => setShowInviteModal(true)}
            >
              <Send size={16} className="mr-1" />
              Invite
            </button>
            
            <button 
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center"
            >
              <Download size={16} className="mr-1" />
              Export Results
            </button>
          </div>
          
          <div className="flex space-x-2">
            <button 
              className="px-3 py-1.5 border border-red-300 rounded-lg text-sm text-red-700 hover:bg-red-50 transition-colors flex items-center"
            >
              <Trash2 size={16} className="mr-1" />
              Delete
            </button>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('candidates')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'candidates' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Candidates
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'questions' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Questions
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'settings' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Settings
          </button>
        </nav>
      </div>
      
      {/* Tab content */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Users className="h-5 w-5 text-blue-500 mr-2" />
                  <h3 className="text-sm font-medium text-gray-700">Candidates</h3>
                </div>
                <p className="text-2xl font-semibold">{test.candidates.length}</p>
                <div className="mt-2 text-sm text-gray-500">
                  <span className="text-green-600 font-medium">{test.candidates.filter(c => c.status === 'completed').length}</span> completed
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <h3 className="text-sm font-medium text-gray-700">Passing Score</h3>
                </div>
                <p className="text-2xl font-semibold">{test.passingScore}%</p>
                <div className="mt-2 text-sm text-gray-500">
                  <span className="text-green-600 font-medium">
                    {test.candidates.filter(c => c.score && c.score >= test.passingScore).length}
                  </span> candidates passed
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Clock className="h-5 w-5 text-orange-500 mr-2" />
                  <h3 className="text-sm font-medium text-gray-700">Time Limit</h3>
                </div>
                <p className="text-2xl font-semibold">{test.timeLimit} min</p>
                <div className="mt-2 text-sm text-gray-500">
                  Due: {formatDate(test.dueDate)}
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600">{test.description || 'No description provided.'}</p>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
                  onClick={() => setShowInviteModal(true)}
                >
                  <div className="p-2 bg-blue-100 rounded-full mr-3">
                    <Send className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium">Invite Candidates</h4>
                    <p className="text-sm text-gray-500">Send test invitations via email</p>
                  </div>
                </button>
                
                <button 
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
                >
                  <div className="p-2 bg-purple-100 rounded-full mr-3">
                    <Eye className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium">Preview Test</h4>
                    <p className="text-sm text-gray-500">See how candidates will view the test</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Candidates tab */}
        {activeTab === 'candidates' && (
          <div className="p-6">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Test Candidates</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowCandidateModal(true)}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center"
                >
                  <Users size={16} className="mr-1" />
                  Create Candidate
                </button>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center"
                >
                  <Plus size={16} className="mr-1" />
                  Invite Candidate
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {test.candidates.map((candidate) => (
                    <tr key={candidate.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{candidate.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{candidate.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          candidate.status === 'completed' ? 'bg-green-100 text-green-800' :
                          candidate.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {candidate.status === 'in_progress' ? 'In Progress' : 
                           candidate.status === 'completed' ? 'Completed' : 'Invited'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {candidate.score !== null ? `${candidate.score}%` : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {candidate.token && (
                          <button 
                            className="text-green-600 hover:text-green-900 mr-3"
                            onClick={() => {
                              navigator.clipboard.writeText(generateInviteLink(candidate.token));
                              alert('Invitation link copied to clipboard!');
                            }}
                          >
                            Copy Link
                          </button>
                        )}
                        <button className="text-blue-600 hover:text-blue-900 mr-3">
                          View
                        </button>
                        <button className="text-red-600 hover:text-red-900">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Questions tab */}
        {activeTab === 'questions' && (
          <div className="p-6">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Test Questions</h3>
              <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center">
                <Plus size={16} className="mr-1" />
                Add Question
              </button>
            </div>
            
            <div className="space-y-4">
              {test.questions.map((question, index) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center mb-2">
                        <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded mr-2">
                          {question.type === 'mcq' ? 'Multiple Choice' : 
                           question.type === 'text' ? 'Text Answer' : 'Single Choice'}
                        </span>
                        <span className="text-gray-500 text-sm">Question {index + 1}</span>
                      </div>
                      <p className="text-gray-900">{question.text}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <Edit size={16} />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Settings tab */}
        {activeTab === 'settings' && (
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Security Settings</h3>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="fullScreenRequired"
                    checked={test.securitySettings.fullScreenRequired}
                    readOnly
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="fullScreenRequired" className="ml-2 block text-sm text-gray-900">
                    Require full-screen mode
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Maximum warnings before action
                  </label>
                  <div className="text-sm text-gray-900">{test.securitySettings.maxWarnings}</div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action on maximum warnings
                  </label>
                  <div className="text-sm text-gray-900">
                    {test.securitySettings.actionOnMaxWarnings === 'terminate' ? 'Terminate test' :
                     test.securitySettings.actionOnMaxWarnings === 'flag' ? 'Flag for review' :
                     'Notify administrator'}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Test Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time Limit
                  </label>
                  <div className="text-sm text-gray-900">{test.timeLimit} minutes</div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Passing Score
                  </label>
                  <div className="text-sm text-gray-900">{test.passingScore}%</div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <div className="text-sm text-gray-900">{formatDate(test.dueDate)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Invite Candidate</h3>
            
            {!inviteLink ? (
              <form onSubmit={handleInvite}>
                <div className="mb-4">
                  <label htmlFor="inviteName" className="block text-sm font-medium text-gray-700 mb-1">
                    Name (optional)
                  </label>
                  <input
                    type="text"
                    id="inviteName"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter candidate name"
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="inviteEmail"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter email address"
                    required
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={isInviting}
                  >
                    {isInviting ? 'Sending...' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">Invitation created successfully!</p>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invitation Link
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink);
                        alert('Link copied to clipboard!');
                      }}
                      className="px-3 py-2 border border-l-0 border-gray-300 rounded-r-md shadow-sm text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Share this link with the candidate to allow them to take the test.
                  </p>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteLink('');
                    }}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Candidate Creation Modal */}
      {showCandidateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create Candidate with Credentials</h3>
            
            <form onSubmit={handleCreateCandidate}>
              <div className="mb-4">
                <label htmlFor="candidateName" className="block text-sm font-medium text-gray-700 mb-1">
                  Name (optional)
                </label>
                <input
                  type="text"
                  id="candidateName"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter candidate name"
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="candidateEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address (Username)
                </label>
                <input
                  type="email"
                  id="candidateEmail"
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter email address"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  This will be used as the candidate's username for login.
                </p>
              </div>
              
              <div className="mb-4">
                <label htmlFor="candidatePassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Password (optional)
                </label>
                <input
                  type="text"
                  id="candidatePassword"
                  value={candidatePassword}
                  onChange={(e) => setCandidatePassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter password or leave empty for auto-generated"
                />
                <p className="mt-1 text-xs text-gray-500">
                  If left empty, a secure random password will be generated.
                </p>
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCandidateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  disabled={isCreatingCandidate}
                >
                  {isCreatingCandidate ? 'Creating...' : 'Create Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
