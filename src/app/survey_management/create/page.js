'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ClipboardList, ChevronLeft, ChevronRight, Save,
  AlertCircle, X, Plus, Trash2, HelpCircle, CheckCircle,
  Edit2, ArrowLeft, Layout, Settings, Users, FileText
} from 'lucide-react';
import Link from 'next/link';

const CreateSurvey = () => {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'General',
    status: 'draft',
    questions: [],
    settings: {
      allowAnonymous: true,
      requireLogin: false,
      showProgressBar: true,
      shuffleQuestions: false,
      responseLimit: 0, // 0 means unlimited
      startDate: null,
      endDate: null,
      thankYouMessage: 'Thank you for completing the survey!'
    }
  });
  
  const CATEGORIES = [
    'Agriculture',
    'Technology',
    'Consumer',
    'Healthcare',
    'Education',
    'Business',
    'General'
  ];

  const QUESTION_TYPES = [
    { value: 'text', label: 'Short Text', icon: 'FileText' },
    { value: 'paragraph', label: 'Paragraph', icon: 'FileText' },
    { value: 'singleChoice', label: 'Single Choice', icon: 'Circle' },
    { value: 'multipleChoice', label: 'Multiple Choice', icon: 'CheckSquare' },
    { value: 'dropdown', label: 'Dropdown', icon: 'ChevronDown' },
    { value: 'rating', label: 'Rating', icon: 'Star' },
    { value: 'date', label: 'Date', icon: 'Calendar' },
    { value: 'number', label: 'Number', icon: 'Hash' },
    { value: 'email', label: 'Email', icon: 'Mail' },
    { value: 'phone', label: 'Phone', icon: 'Phone' },
    { value: 'file', label: 'File Upload', icon: 'Upload' },
  ];

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('Session check failed');
      }

      const data = await response.json();
      
      if (!data.user || !data.user.role) {
        router.push('/login');
        return;
      }

      setCurrentUser(data.user);
      // Only allow admin roles to access this page
      if (data.user.role === 'Console admin' || data.user.role === 'Admin') {
        setLoading(false);
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      router.push('/login');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [name]: type === 'checkbox' ? checked : value
      }
    }));
  };

  const addQuestion = () => {
    const newQuestion = {
      id: Date.now().toString(),
      type: 'text',
      title: '',
      description: '',
      required: false,
      options: []
    };

    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));
  };

  const removeQuestion = (questionId) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== questionId)
    }));
  };

  const updateQuestion = (questionId, field, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id === questionId) {
          return { ...q, [field]: value };
        }
        return q;
      })
    }));
  };

  const addOption = (questionId) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id === questionId) {
          return {
            ...q,
            options: [...q.options, { id: Date.now().toString(), text: '' }]
          };
        }
        return q;
      })
    }));
  };

  const updateOption = (questionId, optionId, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id === questionId) {
          return {
            ...q,
            options: q.options.map(opt => {
              if (opt.id === optionId) {
                return { ...opt, text: value };
              }
              return opt;
            })
          };
        }
        return q;
      })
    }));
  };

  const removeOption = (questionId, optionId) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id === questionId) {
          return {
            ...q,
            options: q.options.filter(opt => opt.id !== optionId)
          };
        }
        return q;
      })
    }));
  };

  const nextStep = () => {
    if (currentStep === 1 && (!formData.title || !formData.description)) {
      setError('Please fill in all required fields');
      return;
    }
    if (currentStep === 2 && formData.questions.length === 0) {
      setError('Please add at least one question');
      return;
    }
    setError(null);
    setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/surveys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role
        },
        body: JSON.stringify({
          ...formData,
          createdBy: currentUser?._id,
          createdAt: new Date()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create survey');
      }

      // Redirect to survey management page
      router.push('/survey_management');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <Link href="/survey_management" className="text-blue-500 hover:text-blue-700 flex items-center">
          <ArrowLeft className="mr-1" /> Back to Surveys
        </Link>
        <h1 className="text-2xl font-bold flex items-center">
          <ClipboardList className="mr-2" /> Create New Survey
        </h1>
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 flex items-start">
          <AlertCircle className="mr-2 h-5 w-5 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="p-6">
          <div className="flex justify-between mb-8">
            <div className="flex space-x-4">
              <div 
                className={`flex flex-col items-center ${currentStep === 1 ? 'text-blue-500' : 'text-gray-500'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentStep === 1 ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <FileText className="h-5 w-5" />
                </div>
                <span className="text-sm mt-1">Basic Info</span>
              </div>
              <div 
                className={`flex flex-col items-center ${currentStep === 2 ? 'text-blue-500' : 'text-gray-500'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentStep === 2 ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <Layout className="h-5 w-5" />
                </div>
                <span className="text-sm mt-1">Questions</span>
              </div>
              <div 
                className={`flex flex-col items-center ${currentStep === 3 ? 'text-blue-500' : 'text-gray-500'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentStep === 3 ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <Settings className="h-5 w-5" />
                </div>
                <span className="text-sm mt-1">Settings</span>
              </div>
              <div 
                className={`flex flex-col items-center ${currentStep === 4 ? 'text-blue-500' : 'text-gray-500'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentStep === 4 ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <CheckCircle className="h-5 w-5" />
                </div>
                <span className="text-sm mt-1">Review</span>
              </div>
            </div>
          </div>

          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Survey Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Enter survey title"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Enter survey description"
                    rows="4"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  ></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Questions */}
          {currentStep === 2 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Survey Questions</h2>
                <button
                  onClick={addQuestion}
                  className="px-3 py-2 bg-blue-500 text-white rounded-md flex items-center hover:bg-blue-600"
                >
                  <Plus className="mr-1 h-4 w-4" /> Add Question
                </button>
              </div>

              {formData.questions.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <HelpCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No questions added yet</h3>
                  <p className="text-gray-500 mb-6">Start adding questions to your survey.</p>
                  <button
                    onClick={addQuestion}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md inline-flex items-center hover:bg-blue-600"
                  >
                    <Plus className="mr-1 h-4 w-4" /> Add First Question
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {formData.questions.map((question, index) => (
                    <div key={question.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-medium">Question {index + 1}</h3>
                        <button
                          onClick={() => removeQuestion(question.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Question Type
                          </label>
                          <select
                            value={question.type}
                            onChange={(e) => updateQuestion(question.id, 'type', e.target.value)}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {QUESTION_TYPES.map(type => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Question Text
                          </label>
                          <input
                            type="text"
                            value={question.title}
                            onChange={(e) => updateQuestion(question.id, 'title', e.target.value)}
                            placeholder="Enter question text"
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description (Optional)
                          </label>
                          <input
                            type="text"
                            value={question.description}
                            onChange={(e) => updateQuestion(question.id, 'description', e.target.value)}
                            placeholder="Enter additional details"
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id={`required-${question.id}`}
                            checked={question.required}
                            onChange={(e) => updateQuestion(question.id, 'required', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor={`required-${question.id}`} className="ml-2 block text-sm text-gray-700">
                            Required question
                          </label>
                        </div>

                        {/* Show options for choice-based questions */}
                        {['singleChoice', 'multipleChoice', 'dropdown'].includes(question.type) && (
                          <div className="mt-4">
                            <div className="flex justify-between items-center mb-2">
                              <label className="block text-sm font-medium text-gray-700">
                                Answer Options
                              </label>
                              <button
                                onClick={() => addOption(question.id)}
                                className="text-blue-500 hover:text-blue-700 text-sm flex items-center"
                              >
                                <Plus className="mr-1 h-3 w-3" /> Add Option
                              </button>
                            </div>
                            
                            {question.options.length === 0 ? (
                              <div className="text-gray-500 text-sm mb-2">
                                No options added. Click "Add Option" to add answer choices.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {question.options.map((option, optIndex) => (
                                  <div key={option.id} className="flex items-center">
                                    <div className="mr-2 text-gray-500">{optIndex + 1}.</div>
                                    <input
                                      type="text"
                                      value={option.text}
                                      onChange={(e) => updateOption(question.id, option.id, e.target.value)}
                                      placeholder={`Option ${optIndex + 1}`}
                                      className="flex-grow px-3 py-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                      onClick={() => removeOption(question.id, option.id)}
                                      className="ml-2 text-red-500 hover:text-red-700"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Settings */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Survey Settings</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="allowAnonymous"
                        checked={formData.settings.allowAnonymous}
                        onChange={handleSettingsChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">Allow anonymous responses</span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="requireLogin"
                        checked={formData.settings.requireLogin}
                        onChange={handleSettingsChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">Require login to respond</span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="showProgressBar"
                        checked={formData.settings.showProgressBar}
                        onChange={handleSettingsChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">Show progress bar</span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="shuffleQuestions"
                        checked={formData.settings.shuffleQuestions}
                        onChange={handleSettingsChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">Shuffle questions</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Response Limit (0 = unlimited)
                  </label>
                  <input
                    type="number"
                    name="responseLimit"
                    value={formData.settings.responseLimit}
                    onChange={handleSettingsChange}
                    min="0"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date (Optional)
                    </label>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.settings.startDate || ''}
                      onChange={handleSettingsChange}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      name="endDate"
                      value={formData.settings.endDate || ''}
                      onChange={handleSettingsChange}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thank You Message
                  </label>
                  <textarea
                    name="thankYouMessage"
                    value={formData.settings.thankYouMessage}
                    onChange={handleSettingsChange}
                    rows="3"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  ></textarea>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Review Survey</h2>
              
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h3 className="text-lg font-medium mb-2">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Title</p>
                    <p className="text-gray-800">{formData.title}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Category</p>
                    <p className="text-gray-800">{formData.category}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-500">Description</p>
                  <p className="text-gray-800">{formData.description}</p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h3 className="text-lg font-medium mb-2">Questions ({formData.questions.length})</h3>
                {formData.questions.length === 0 ? (
                  <p className="text-gray-500">No questions added.</p>
                ) : (
                  <div className="space-y-3">
                    {formData.questions.map((question, index) => (
                      <div key={question.id} className="border-b pb-2 last:border-b-0">
                        <div className="flex justify-between">
                          <p className="font-medium">{index + 1}. {question.title}</p>
                          <p className="text-sm text-gray-500">{QUESTION_TYPES.find(t => t.value === question.type)?.label}</p>
                        </div>
                        {question.description && (
                          <p className="text-sm text-gray-500 mt-1">{question.description}</p>
                        )}
                        {['singleChoice', 'multipleChoice', 'dropdown'].includes(question.type) && question.options.length > 0 && (
                          <div className="mt-1 pl-4">
                            <p className="text-xs text-gray-500 mb-1">Options:</p>
                            <ul className="text-sm text-gray-700 list-disc pl-4">
                              {question.options.map(option => (
                                <li key={option.id}>{option.text}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Allow Anonymous</p>
                    <p className="text-gray-800">{formData.settings.allowAnonymous ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Require Login</p>
                    <p className="text-gray-800">{formData.settings.requireLogin ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Show Progress Bar</p>
                    <p className="text-gray-800">{formData.settings.showProgressBar ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Shuffle Questions</p>
                    <p className="text-gray-800">{formData.settings.shuffleQuestions ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Response Limit</p>
                    <p className="text-gray-800">{formData.settings.responseLimit > 0 ? formData.settings.responseLimit : 'Unlimited'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Date Range</p>
                    <p className="text-gray-800">
                      {formData.settings.startDate ? new Date(formData.settings.startDate).toLocaleDateString() : 'No start date'} - 
                      {formData.settings.endDate ? new Date(formData.settings.endDate).toLocaleDateString() : 'No end date'}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-500">Thank You Message</p>
                  <p className="text-gray-800">{formData.settings.thankYouMessage}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between mt-8 px-6 pb-6">
          {currentStep > 1 && (
            <button
              onClick={prevStep}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md flex items-center hover:bg-gray-300"
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </button>
          )}
          {currentStep < 4 ? (
            <button
              onClick={nextStep}
              className="ml-auto px-4 py-2 bg-blue-500 text-white rounded-md flex items-center hover:bg-blue-600"
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="ml-auto px-4 py-2 bg-green-500 text-white rounded-md flex items-center hover:bg-green-600"
            >
              <Save className="mr-1 h-4 w-4" /> Create Survey
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateSurvey;
