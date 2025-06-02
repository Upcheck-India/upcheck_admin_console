'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RecruitmentNav from '../components/RecruitmentNav';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  AlertTriangle,
  Settings,
  Clock,
  Users
} from 'lucide-react';
import QuestionBuilder from '../components/QuestionBuilder';

export default function CreateTest() {
  const router = useRouter();
  const [testData, setTestData] = useState({
    title: '',
    description: '',
    timeLimit: 60, // in minutes
    passingScore: 70,
    securitySettings: {
      fullScreenRequired: true,
      maxWarnings: 3,
      actionOnMaxWarnings: 'terminate'
    },
    questions: []
  });
  
  const [currentStep, setCurrentStep] = useState(1); // 1: Basic Info, 2: Questions, 3: Settings
  const [isSaving, setIsSaving] = useState(false);
  
  // Handle question updates from QuestionBuilder
  const handleQuestionsChange = (questions) => {
    // Use a function to compare current questions with new ones to prevent unnecessary updates
    setTestData(prev => {
      // Only update if questions have actually changed
      if (JSON.stringify(prev.questions) !== JSON.stringify(questions)) {
        return { ...prev, questions };
      }
      return prev;
    });
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTestData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle security settings changes
  const handleSecurityChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setTestData(prev => ({
      ...prev,
      securitySettings: {
        ...prev.securitySettings,
        [name]: newValue
      }
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      // Prepare test data with required fields
      const testToCreate = {
        ...testData,
        status: 'active',
        createdAt: new Date().toISOString(),
        dueDate: testData.dueDate || null
      };
      
      // Call the API to create the test
      const response = await fetch('/api/recruitment/tests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testToCreate)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create test');
      }
      
      const createdTest = await response.json();
      
      // Navigate to the tests page after successful creation
      router.push('/recruitment');
    } catch (error) {
      console.error('Error saving test:', error);
      alert('Failed to save test. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Create New Test</h1>
        </div>
        <div className="bg-gray-100 h-2 rounded-full w-full mt-4">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${(currentStep / 3) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Step 1: Basic Information */}
      {currentStep === 1 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Test Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={testData.title}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Frontend Developer Assessment"
                required
              />
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={testData.description}
                onChange={handleInputChange}
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Provide instructions and details about this test"
              ></textarea>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="timeLimit" className="block text-sm font-medium text-gray-700 mb-1">
                  Time Limit (minutes)
                </label>
                <input
                  type="number"
                  id="timeLimit"
                  name="timeLimit"
                  value={testData.timeLimit}
                  onChange={handleInputChange}
                  min="5"
                  max="240"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label htmlFor="passingScore" className="block text-sm font-medium text-gray-700 mb-1">
                  Passing Score (%)
                </label>
                <input
                  type="number"
                  id="passingScore"
                  name="passingScore"
                  value={testData.passingScore}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              disabled={!testData.title}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Next: Add Questions
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Questions */}
      {currentStep === 2 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Test Questions</h2>
          <QuestionBuilder 
            initialQuestions={testData.questions} 
            onChange={handleQuestionsChange}
          />
          

          
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Next: Security Settings
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Security Settings */}
      {currentStep === 3 && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Security Settings</h2>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="fullScreenRequired"
                name="fullScreenRequired"
                checked={testData.securitySettings.fullScreenRequired}
                onChange={handleSecurityChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="fullScreenRequired" className="ml-2 block text-sm text-gray-900">
                Require full-screen mode
              </label>
            </div>
            
            <div>
              <label htmlFor="maxWarnings" className="block text-sm font-medium text-gray-700 mb-1">
                Maximum warnings before action
              </label>
              <input
                type="number"
                id="maxWarnings"
                name="maxWarnings"
                value={testData.securitySettings.maxWarnings}
                onChange={handleSecurityChange}
                min="1"
                max="10"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="actionOnMaxWarnings" className="block text-sm font-medium text-gray-700 mb-1">
                Action on maximum warnings
              </label>
              <select
                id="actionOnMaxWarnings"
                name="actionOnMaxWarnings"
                value={testData.securitySettings.actionOnMaxWarnings}
                onChange={handleSecurityChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="terminate">Terminate test</option>
                <option value="flag">Flag for review</option>
                <option value="notify">Notify administrator</option>
              </select>
            </div>
          </div>
          
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:bg-blue-400"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} className="mr-2" />
                  Save Test
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
