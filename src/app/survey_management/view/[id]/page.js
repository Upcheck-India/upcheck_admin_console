'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ClipboardList, ArrowLeft, Edit2, Download, 
  AlertCircle, X, Eye, BarChart, FileText,
  Users, Calendar, CheckCircle, XCircle
} from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, HeadingLevel, TextRun } from 'docx';
import Papa from 'papaparse';

const ViewSurvey = ({ params }) => {
  const router = useRouter();
  const surveyId = params.id;
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [survey, setSurvey] = useState(null);
  const [responses, setResponses] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Click outside handler for export menu
  const exportMenuRef = useRef(null);
  
  useEffect(() => {
    function handleClickOutside(event) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Function to prepare response data for export
  const prepareResponseData = () => {
    if (!survey || !responses.length) return [];
    
    // Create a list of all questions from the survey
    const questions = survey.questions.map(q => ({
      id: q.id,
      title: q.title,
      type: q.type
    }));
    
    // Map responses to a consistent format
    return responses.map(response => {
      // Get respondent info
      const respondentInfo = response.respondentInfo || {};
      const respondentName = response.respondentName || respondentInfo.name || 'Anonymous';
      const respondentEmail = response.respondentEmail || respondentInfo.email || 'No email provided';
      
      // Handle different date formats
      let submittedDate = response.submittedAt;
      if (typeof submittedDate === 'object' && submittedDate.$date) {
        // Handle MongoDB extended JSON format
        submittedDate = new Date(parseInt(submittedDate.$date.$numberLong || submittedDate.$date));
      } else if (submittedDate) {
        submittedDate = new Date(submittedDate);
      } else {
        submittedDate = new Date();
      }
      
      // Create a base object with respondent info
      const formattedResponse = {
        'Respondent Name': respondentName,
        'Respondent Email': respondentEmail,
        'Submitted Date': submittedDate.toLocaleString(),
        'Status': response.status || 'Completed'
      };
      
      // Add answers to each question
      questions.forEach(question => {
        let answer = '';
        
        // Check both response formats
        if (response.responses) {
          // Format 1: Array of responses
          const responseItem = response.responses.find(r => r.questionId === question.id);
          if (responseItem) {
            answer = Array.isArray(responseItem.answer) 
              ? responseItem.answer.join(', ') 
              : responseItem.answer;
          }
        } else if (response.answers) {
          // Format 2: Answers object
          answer = response.answers[question.id];
          if (Array.isArray(answer)) {
            answer = answer.join(', ');
          }
        }
        
        // Convert objects to string if needed
        if (typeof answer === 'object' && answer !== null) {
          answer = JSON.stringify(answer);
        }
        
        formattedResponse[question.title] = answer || 'No answer';
      });
      
      return formattedResponse;
    });
  };

  // Export responses in various formats
  const exportResponses = (format) => {
    const data = prepareResponseData();
    const fileName = `${survey?.title || 'Survey'}_Responses_${new Date().toISOString().split('T')[0]}`;
    
    setShowExportMenu(false);
    
    switch (format) {
      case 'json':
        // Export as JSON
        const jsonContent = JSON.stringify(data, null, 2);
        const jsonBlob = new Blob([jsonContent], { type: 'application/json' });
        saveAs(jsonBlob, `${fileName}.json`);
        break;
        
      case 'csv':
        // Export as CSV
        const csv = Papa.unparse(data);
        const csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(csvBlob, `${fileName}.csv`);
        break;
        
      case 'excel':
        // Export as Excel
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Responses');
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
        break;
        
      case 'docx':
        // Export as Word Document
        exportToWord(data, fileName);
        break;
        
      case 'txt':
        // Export as Text File
        let textContent = `Survey Responses for: ${survey?.title || 'Survey'}
`;
        textContent += `Generated on: ${new Date().toLocaleString()}

`;
        
        data.forEach((item, index) => {
          textContent += `Response #${index + 1}
`;
          textContent += `${'='.repeat(40)}
`;
          
          Object.entries(item).forEach(([key, value]) => {
            textContent += `${key}: ${value}
`;
          });
          
          textContent += `
`;
        });
        
        const textBlob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
        saveAs(textBlob, `${fileName}.txt`);
        break;
    }
  };
  
  // Helper function to export to Word document
  const exportToWord = (data, fileName) => {
    const doc = new Document();
    
    // Add title
    doc.addSection({
      properties: {},
      children: [
        new Paragraph({
          text: `Survey Responses: ${survey?.title || 'Survey'}`,
          heading: HeadingLevel.HEADING_1
        }),
        new Paragraph({
          text: `Generated on: ${new Date().toLocaleString()}`,
          spacing: {
            after: 200
          }
        })
      ]
    });
    
    // Add each response
    data.forEach((item, index) => {
      // Add response header
      doc.addSection({
        properties: {},
        children: [
          new Paragraph({
            text: `Response #${index + 1}`,
            heading: HeadingLevel.HEADING_2,
            spacing: {
              before: 400
            }
          })
        ]
      });
      
      // Create table for this response
      const tableRows = Object.entries(item).map(([key, value]) => {
        return new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph(key)]
            }),
            new TableCell({
              children: [new Paragraph(String(value))]
            })
          ]
        });
      });
      
      const table = new Table({
        rows: tableRows
      });
      
      doc.addSection({
        properties: {},
        children: [table]
      });
    });
    
    // Generate and save document
    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `${fileName}.docx`);
    });
  };

  // Status colors
  const STATUS_COLORS = {
    'draft': 'bg-gray-100 text-gray-800',
    'active': 'bg-green-100 text-green-800',
    'completed': 'bg-blue-100 text-blue-800',
    'archived': 'bg-amber-100 text-amber-800'
  };

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
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
        await Promise.all([
          fetchSurvey(data.user.role),
          fetchResponses(data.user.role)
        ]);
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      router.push('/login');
    }
  };

  const fetchSurvey = async (userRole) => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/surveys/${surveyId}`, {
        headers: {
          'x-user-role': userRole,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch survey');
      }
      
      const surveyData = await response.json();
      setSurvey(surveyData);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchResponses = async (userRole) => {
    try {      
      const response = await fetch(`/api/surveys/${surveyId}/responses`, {
        headers: {
          'x-user-role': userRole,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch responses');
      }
      
      const responseData = await response.json();
      setResponses(responseData);
    } catch (err) {
      console.error('Fetch responses error:', err);
      // We don't set the error state here as we still want to show the survey
      // even if responses can't be fetched
    }
  };

  const exportSurveyData = () => {
    if (!survey || !responses) return;
    
    // Format the data for export
    const exportData = {
      survey: {
        title: survey.title,
        description: survey.description,
        category: survey.category,
        status: survey.status,
        createdAt: survey.createdAt,
        questions: survey.questions.map(q => ({
          id: q.id,
          type: q.type,
          title: q.title,
          description: q.description,
          required: q.required,
          options: q.options
        }))
      },
      responses: responses
    };
    
    // Convert to JSON string
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create a blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey-${surveyId}-export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <Link href="/survey_management" className="text-blue-500 hover:text-blue-700 flex items-center">
            <ArrowLeft className="mr-1" /> Back to Surveys
          </Link>
        </div>
        
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <div className="flex items-start">
            <AlertCircle className="mr-2 h-5 w-5 mt-0.5" />
            <span>{error || 'Survey not found'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <Link href="/survey_management" className="text-blue-500 hover:text-blue-700 flex items-center">
          <ArrowLeft className="mr-1" /> Back to Surveys
        </Link>
        <div className="flex space-x-2">
          <Link 
            href={`/survey_management/edit/${surveyId}`} 
            className="px-3 py-2 bg-blue-500 text-white rounded-md flex items-center hover:bg-blue-600"
          >
            <Edit2 className="mr-1 h-4 w-4" /> Edit Survey
          </Link>
          <button
            onClick={exportSurveyData}
            className="px-3 py-2 bg-green-500 text-white rounded-md flex items-center hover:bg-green-600"
          >
            <Download className="mr-1 h-4 w-4" /> Export Data
          </button>
        </div>
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
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold">{survey.title}</h1>
              <p className="text-gray-600 mt-1">{survey.description}</p>
            </div>
            <div className="flex flex-col items-end">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[survey.status]}`}>
                {survey.status.charAt(0).toUpperCase() + survey.status.slice(1)}
              </span>
              <span className="text-sm text-gray-500 mt-1">
                Category: {survey.category}
              </span>
            </div>
          </div>

          <div className="flex border-b mb-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 font-medium ${activeTab === 'overview' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <FileText className="inline-block mr-1 h-4 w-4" /> Overview
            </button>
            <button
              onClick={() => setActiveTab('responses')}
              className={`px-4 py-2 font-medium ${activeTab === 'responses' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Users className="inline-block mr-1 h-4 w-4" /> Responses ({responses.length})
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 font-medium ${activeTab === 'analytics' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <BarChart className="inline-block mr-1 h-4 w-4" /> Analytics
            </button>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2 flex items-center">
                    <FileText className="mr-2 h-5 w-5 text-blue-500" /> Survey Details
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Created</p>
                      <p className="text-gray-800">{new Date(survey.createdAt).toLocaleDateString()}</p>
                    </div>
                    {survey.updatedAt && (
                      <div>
                        <p className="text-sm font-medium text-gray-500">Last Updated</p>
                        <p className="text-gray-800">{new Date(survey.updatedAt).toLocaleDateString()}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-500">Questions</p>
                      <p className="text-gray-800">{survey.questions.length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2 flex items-center">
                    <Users className="mr-2 h-5 w-5 text-green-500" /> Response Stats
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Responses</p>
                      <p className="text-gray-800">{responses.length}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Response Limit</p>
                      <p className="text-gray-800">{survey.settings.responseLimit > 0 ? survey.settings.responseLimit : 'Unlimited'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Anonymous Responses</p>
                      <p className="text-gray-800">{survey.settings.allowAnonymous ? 'Allowed' : 'Not Allowed'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2 flex items-center">
                    <Calendar className="mr-2 h-5 w-5 text-purple-500" /> Schedule
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Start Date</p>
                      <p className="text-gray-800">{survey.settings.startDate ? new Date(survey.settings.startDate).toLocaleDateString() : 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">End Date</p>
                      <p className="text-gray-800">{survey.settings.endDate ? new Date(survey.settings.endDate).toLocaleDateString() : 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Status</p>
                      <p className="text-gray-800 capitalize">{survey.status}</p>
                    </div>
                  </div>
                </div>
              </div>

              <h3 className="text-xl font-semibold mb-4">Survey Questions</h3>
              {survey.questions.length === 0 ? (
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-gray-500">No questions have been added to this survey.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {survey.questions.map((question, index) => (
                    <div key={question.id} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between">
                        <h4 className="font-medium">
                          <span className="text-gray-500 mr-2">{index + 1}.</span>
                          {question.title}
                          {question.required && <span className="text-red-500 ml-1">*</span>}
                        </h4>
                        <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
                          {question.type.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </div>
                      
                      {question.description && (
                        <p className="text-gray-600 text-sm mt-1">{question.description}</p>
                      )}
                      
                      {['singleChoice', 'multipleChoice', 'dropdown'].includes(question.type) && question.options.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm text-gray-500 mb-2">Options:</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {question.options.map((option, optIndex) => (
                              <div key={option.id} className="flex items-center">
                                <span className="text-gray-500 mr-2">{optIndex + 1}.</span>
                                <span>{option.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <h3 className="text-xl font-semibold mt-6 mb-4">Survey Settings</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Response Settings</h4>
                    <ul className="space-y-1">
                      <li className="flex items-center">
                        {survey.settings.allowAnonymous ? 
                          <CheckCircle className="text-green-500 mr-2 h-4 w-4" /> : 
                          <XCircle className="text-red-500 mr-2 h-4 w-4" />
                        }
                        <span>Allow anonymous responses</span>
                      </li>
                      <li className="flex items-center">
                        {survey.settings.requireLogin ? 
                          <CheckCircle className="text-green-500 mr-2 h-4 w-4" /> : 
                          <XCircle className="text-red-500 mr-2 h-4 w-4" />
                        }
                        <span>Require login to respond</span>
                      </li>
                      <li className="flex items-center">
                        {survey.settings.showProgressBar ? 
                          <CheckCircle className="text-green-500 mr-2 h-4 w-4" /> : 
                          <XCircle className="text-red-500 mr-2 h-4 w-4" />
                        }
                        <span>Show progress bar</span>
                      </li>
                      <li className="flex items-center">
                        {survey.settings.shuffleQuestions ? 
                          <CheckCircle className="text-green-500 mr-2 h-4 w-4" /> : 
                          <XCircle className="text-red-500 mr-2 h-4 w-4" />
                        }
                        <span>Shuffle questions</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Completion Message</h4>
                    <div className="bg-white p-3 rounded border">
                      <p>{survey.settings.thankYouMessage}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Responses Tab */}
          {activeTab === 'responses' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Survey Responses</h3>
                
                {responses.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="px-3 py-2 bg-green-500 text-white rounded-md flex items-center hover:bg-green-600"
                    >
                      <Download className="mr-1 h-4 w-4" /> Export Responses
                    </button>
                    
                    {showExportMenu && (
                      <div ref={exportMenuRef} className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                        <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                          <button
                            onClick={() => exportResponses('json')}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left"
                            role="menuitem"
                          >
                            Export as JSON
                          </button>
                          <button
                            onClick={() => exportResponses('csv')}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left"
                            role="menuitem"
                          >
                            Export as CSV
                          </button>
                          <button
                            onClick={() => exportResponses('excel')}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left"
                            role="menuitem"
                          >
                            Export as Excel
                          </button>
                          <button
                            onClick={() => exportResponses('docx')}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left"
                            role="menuitem"
                          >
                            Export as Word Document
                          </button>
                          <button
                            onClick={() => exportResponses('txt')}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left"
                            role="menuitem"
                          >
                            Export as Text File
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {responses.length === 0 ? (
                <div className="bg-gray-50 p-6 rounded-lg text-center">
                  <p className="text-gray-500 mb-2">No responses have been collected for this survey yet.</p>
                  {survey.status === 'draft' && (
                    <p className="text-gray-600">Publish this survey by changing its status to 'active' to start collecting responses.</p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Respondent
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Submitted
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Completion
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {responses.map((response) => {
                        // Handle different response formats
                        const respondentInfo = response.respondentInfo || {};
                        const respondentName = response.respondentName || respondentInfo.name || 'Anonymous';
                        const respondentEmail = response.respondentEmail || respondentInfo.email || 'No email provided';
                        
                        // Handle different date formats
                        let submittedDate = response.submittedAt;
                        if (typeof submittedDate === 'object' && submittedDate.$date) {
                          // Handle MongoDB extended JSON format
                          submittedDate = new Date(parseInt(submittedDate.$date.$numberLong || submittedDate.$date));
                        } else if (submittedDate) {
                          submittedDate = new Date(submittedDate);
                        } else {
                          submittedDate = new Date();
                        }
                        
                        return (
                          <tr key={response._id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {respondentName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {respondentEmail}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {submittedDate.toLocaleDateString()}
                              </div>
                              <div className="text-sm text-gray-500">
                                {submittedDate.toLocaleTimeString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                {response.status === 'completed' || response.completionRate ? 
                                  (response.completionRate ? `${Math.round(response.completionRate * 100)}%` : 'Complete') : 
                                  'Complete'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button 
                                onClick={() => {
                                  setSelectedResponse(response);
                                  setShowResponseModal(true);
                                }}
                                className="text-indigo-600 hover:text-indigo-900"
                                title="View Response Details"
                              >
                                <Eye className="h-5 w-5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div>
              <h3 className="text-xl font-semibold mb-4">Survey Analytics</h3>
              
              {responses.length === 0 ? (
                <div className="bg-gray-50 p-6 rounded-lg text-center">
                  <p className="text-gray-500">No data available for analytics. Collect responses first.</p>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-700 mb-1">Total Responses</h4>
                      <p className="text-3xl font-bold text-blue-900">{responses.length}</p>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-medium text-green-700 mb-1">Completion Rate</h4>
                      <p className="text-3xl font-bold text-green-900">
                        {responses.length > 0 ? 
                          `${Math.round((responses.filter(r => r.status === 'completed' || r.completionRate === 1 || !r.completionRate).length / responses.length) * 100)}%` : 
                          '0%'
                        }
                      </p>
                    </div>
                    
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h4 className="font-medium text-purple-700 mb-1">Average Time</h4>
                      <p className="text-3xl font-bold text-purple-900">
                        {responses.some(r => r.completionTime) ? 
                          `${Math.round(responses.reduce((acc, r) => acc + (r.completionTime || 0), 0) / responses.filter(r => r.completionTime).length)} sec` : 
                          'N/A'
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg mb-6">
                    <h4 className="font-medium mb-4">Response Over Time</h4>
                    <div className="h-64 flex items-center justify-center">
                      <p className="text-gray-500">Chart visualization would be displayed here</p>
                    </div>
                  </div>
                  
                  <h4 className="font-medium mb-4">Question Breakdown</h4>
                  <div className="space-y-4">
                    {survey.questions.map((question, index) => (
                      <div key={question.id} className="bg-gray-50 p-4 rounded-lg">
                        <h5 className="font-medium mb-2">
                          <span className="text-gray-500 mr-2">{index + 1}.</span>
                          {question.title}
                        </h5>
                        
                        {['singleChoice', 'multipleChoice', 'dropdown'].includes(question.type) ? (
                          <div className="mt-3">
                            <div className="space-y-2">
                              {question.options.map((option) => {
                                // Calculate how many responses selected this option
                                let count = 0;
                                
                                // Handle different response formats
                                responses.forEach(r => {
                                  // Format 1: Direct answers object
                                  if (r.answers && r.answers[question.id]) {
                                    if (Array.isArray(r.answers[question.id])) {
                                      if (r.answers[question.id].includes(option.id)) count++;
                                    } else if (r.answers[question.id] === option.id) {
                                      count++;
                                    }
                                  } 
                                  // Format 2: Responses array with questionId/answer format
                                  else if (r.responses && Array.isArray(r.responses)) {
                                    const questionResponse = r.responses.find(qr => qr.questionId === question.id);
                                    if (questionResponse) {
                                      if (Array.isArray(questionResponse.answer)) {
                                        if (questionResponse.answer.includes(option.id)) count++;
                                      } else if (questionResponse.answer === option.id) {
                                        count++;
                                      }
                                    }
                                  }
                                });
                                
                                const percentage = responses.length > 0 ? Math.round((count / responses.length) * 100) : 0;
                                
                                return (
                                  <div key={option.id} className="flex items-center">
                                    <div className="w-40 truncate">{option.text}</div>
                                    <div className="flex-grow mx-2">
                                      <div className="bg-gray-200 h-4 rounded-full overflow-hidden">
                                        <div 
                                          className="bg-blue-500 h-full" 
                                          style={{ width: `${percentage}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                    <div className="w-16 text-right">
                                      <span className="text-sm font-medium">{percentage}%</span>
                                      <span className="text-xs text-gray-500 ml-1">({count})</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 text-gray-500">
                            <p>Text responses are available in the exported data</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Response Details Modal */}
      {showResponseModal && selectedResponse && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl mx-auto p-5 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold flex items-center">
                <ClipboardList className="mr-2 h-5 w-5 text-blue-500" /> Response Details
              </h3>
              <button
                onClick={() => setShowResponseModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 bg-blue-50 p-3 rounded-lg">
              <h4 className="font-medium mb-2">Respondent Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-500">Name</p>
                  <p className="text-gray-800">{selectedResponse.respondentInfo?.name || selectedResponse.respondentName || 'Anonymous'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="text-gray-800">{selectedResponse.respondentInfo?.email || selectedResponse.respondentEmail || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Submitted</p>
                  <p className="text-gray-800">
                    {new Date(selectedResponse.submittedAt.$date ? 
                      parseInt(selectedResponse.submittedAt.$date.$numberLong || selectedResponse.submittedAt.$date) : 
                      selectedResponse.submittedAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <p className="text-gray-800 capitalize">{selectedResponse.status || 'Completed'}</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="font-medium mb-2">Responses</h4>
              <div className="space-y-3">
                {/* Handle both response formats */}
                {selectedResponse.responses ? (
                  // Format 1: Array of responses with questionId/title/answer
                  selectedResponse.responses.map((response, index) => (
                    <div key={response.questionId} className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex justify-between">
                        <h5 className="font-medium">
                          <span className="text-gray-500 mr-2">{index + 1}.</span>
                          {response.questionTitle}
                        </h5>
                        <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
                          {response.questionType.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </div>
                      
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-500">Answer:</p>
                        {response.questionType === 'multipleChoice' ? (
                          <div className="pl-4">
                            {Array.isArray(response.answer) ? 
                              response.answer.map((ans, i) => (
                                <div key={i} className="text-gray-800">• {ans.text ? ans.text : (typeof ans === 'object' ? JSON.stringify(ans) : ans)}</div>
                              )) : 
                              <div className="text-gray-800">• {response.answer}</div>
                            }
                          </div>
                        ) : (
                          <p className="text-gray-800">{
                            typeof response.answer === 'object' ? 
                              JSON.stringify(response.answer) : 
                              response.answer
                          }</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  // Format 2: Answers object with questionId keys
                  survey && survey.questions.map((question, index) => {
                    const answer = selectedResponse.answers && selectedResponse.answers[question.id];
                    return (
                      <div key={question.id} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex justify-between">
                          <h5 className="font-medium">
                            <span className="text-gray-500 mr-2">{index + 1}.</span>
                            {question.title}
                          </h5>
                          <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
                            {question.type.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        </div>
                        
                        <div className="mt-2">
                          <p className="text-sm font-medium text-gray-500">Answer:</p>
                          {question.type === 'multipleChoice' ? (
                            <div className="pl-4">
                              {Array.isArray(answer) ? 
                                answer.map((ans, i) => (
                                  <div key={i} className="text-gray-800">• {ans}</div>
                                )) : 
                                <div className="text-gray-800">• {answer}</div>
                              }
                            </div>
                          ) : (
                            <p className="text-gray-800">{
                              typeof answer === 'object' ? 
                                JSON.stringify(answer) : 
                                answer
                            }</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowResponseModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewSurvey;
