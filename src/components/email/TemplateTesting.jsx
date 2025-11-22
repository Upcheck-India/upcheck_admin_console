/**
 * Email Template Testing Dashboard
 * Provides UI for testing and managing email templates
 */

import React, { useState, useEffect } from 'react';

const TemplateTesting = () => {
  const [selectedTemplate, setSelectedTemplate] = useState('seriesNotification');
  const [testResults, setTestResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [versions, setVersions] = useState([]);
  const [testHistory, setTestHistory] = useState([]);

  const templateTypes = [
    { value: 'seriesNotification', label: 'Series Notification' },
    { value: 'reminderNotification', label: 'Reminder Notification' }
  ];

  useEffect(() => {
    loadVersionHistory();
    loadTestHistory();
  }, [selectedTemplate]);

  const loadVersionHistory = async () => {
    try {
      const response = await fetch(`/api/email/versions?template=${selectedTemplate}`);
      const data = await response.json();
      if (data.success) {
        setVersions(data.versions);
      }
    } catch (error) {
      console.error('Failed to load version history:', error);
    }
  };

  const loadTestHistory = async () => {
    try {
      const response = await fetch(`/api/email/test/suite?type=${selectedTemplate}&limit=5`);
      const data = await response.json();
      if (data.success) {
        setTestHistory(data.results);
      }
    } catch (error) {
      console.error('Failed to load test history:', error);
    }
  };

  const runFullTestSuite = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/email/test/suite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType: selectedTemplate,
          tests: ['all'],
          saveResults: true
        })
      });

      const data = await response.json();
      if (data.success) {
        setTestResults(data.results);
        loadTestHistory(); // Refresh history
      } else {
        alert('Test failed: ' + data.error);
      }
    } catch (error) {
      console.error('Test suite error:', error);
      alert('Failed to run test suite');
    } finally {
      setIsLoading(false);
    }
  };

  const generatePreview = async () => {
    try {
      const response = await fetch(`/api/email/preview/template?type=${selectedTemplate}`);
      const data = await response.json();
      if (data.success) {
        setPreview(data.preview);
      } else {
        alert('Preview failed: ' + data.error);
      }
    } catch (error) {
      console.error('Preview error:', error);
      alert('Failed to generate preview');
    }
  };

  const activateVersion = async (version) => {
    try {
      const response = await fetch(`/api/email/versions/${selectedTemplate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate',
          version
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Version activated successfully');
        loadVersionHistory();
      } else {
        alert('Activation failed: ' + data.error);
      }
    } catch (error) {
      console.error('Activation error:', error);
      alert('Failed to activate version');
    }
  };

  const rollbackVersion = async () => {
    if (!confirm('Are you sure you want to rollback to the previous version?')) {
      return;
    }

    try {
      const response = await fetch(`/api/email/versions/${selectedTemplate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rollback'
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Rollback completed successfully');
        loadVersionHistory();
      } else {
        alert('Rollback failed: ' + data.error);
      }
    } catch (error) {
      console.error('Rollback error:', error);
      alert('Failed to rollback version');
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-yellow-600';
    if (score >= 70) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score) => {
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 80) return 'bg-yellow-100 text-yellow-800';
    if (score >= 70) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Email Template Testing Dashboard</h1>
        
        {/* Template Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Template
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {templateTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={runFullTestSuite}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Running Tests...' : 'Run Full Test Suite'}
          </button>
          
          <button
            onClick={generatePreview}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Generate Preview
          </button>
          
          <button
            onClick={rollbackVersion}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Rollback to Previous
          </button>
        </div>
      </div>

      {/* Test Results */}
      {testResults && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Latest Test Results</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700">Overall Score</h3>
              <p className={`text-2xl font-bold ${getScoreColor(testResults.overallScore)}`}>
                {testResults.overallScore}/100
              </p>
            </div>
            
            {testResults.clientCompatibility && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700">Client Compatibility</h3>
                <p className={`text-2xl font-bold ${getScoreColor(testResults.clientCompatibility.overallScore)}`}>
                  {testResults.clientCompatibility.overallScore}/100
                </p>
              </div>
            )}
            
            {testResults.spamScore && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700">Spam Score</h3>
                <p className={`text-2xl font-bold ${testResults.spamScore.rating === 'excellent' ? 'text-green-600' : 'text-red-600'}`}>
                  {testResults.spamScore.rating}
                </p>
              </div>
            )}
            
            {testResults.accessibility && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700">Accessibility</h3>
                <p className={`text-2xl font-bold ${getScoreColor(testResults.accessibility.score)}`}>
                  {testResults.accessibility.level}
                </p>
              </div>
            )}
          </div>

          {/* Detailed Results */}
          <div className="space-y-4">
            {testResults.clientCompatibility && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Client Compatibility Details</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(testResults.clientCompatibility.clientResults).map(([client, result]) => (
                    <div key={client} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700">{client}</span>
                      <span className={`text-sm font-medium ${getScoreColor(result.score)}`}>
                        {result.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {testResults.accessibility?.issues?.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Accessibility Issues</h4>
                <ul className="list-disc list-inside space-y-1">
                  {testResults.accessibility.issues.map((issue, index) => (
                    <li key={index} className="text-sm text-red-600">{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {testResults.performance?.recommendations?.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Performance Recommendations</h4>
                <ul className="list-disc list-inside space-y-1">
                  {testResults.performance.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm text-orange-600">{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Template Preview</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-700">Subject</h3>
              <p className="text-gray-900">{preview.subject}</p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-700">HTML Preview</h3>
              <div 
                className="border rounded-lg p-4 max-h-96 overflow-auto"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </div>
            
            <div>
              <h3 className="font-medium text-gray-700">Plain Text</h3>
              <pre className="bg-gray-50 p-4 rounded-lg text-sm whitespace-pre-wrap max-h-48 overflow-auto">
                {preview.text}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Version History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Version History</h2>
          
          <div className="space-y-3">
            {versions.map((version) => (
              <div key={version.version} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">v{version.version}</span>
                    {version.isActive && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        Active
                      </span>
                    )}
                    {version.testResults && (
                      <span className={`px-2 py-1 text-xs rounded-full ${getScoreBadge(version.testResults.overallScore)}`}>
                        Score: {version.testResults.overallScore}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {new Date(version.createdAt).toLocaleDateString()}
                  </p>
                  {version.metadata?.description && (
                    <p className="text-sm text-gray-500">{version.metadata.description}</p>
                  )}
                </div>
                
                {!version.isActive && (
                  <button
                    onClick={() => activateVersion(version.version)}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Activate
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Test History */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Test Runs</h2>
          
          <div className="space-y-3">
            {testHistory.map((test, index) => (
              <div key={index} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${getScoreBadge(test.overallScore)}`}>
                    Score: {test.overallScore}
                  </span>
                  <span className="text-sm text-gray-600">
                    {new Date(test.runAt).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {test.clientCompatibility && (
                    <div>
                      <span className="text-gray-600">Compatibility:</span>
                      <span className={`ml-1 ${getScoreColor(test.clientCompatibility.overallScore)}`}>
                        {test.clientCompatibility.overallScore}
                      </span>
                    </div>
                  )}
                  
                  {test.accessibility && (
                    <div>
                      <span className="text-gray-600">Accessibility:</span>
                      <span className={`ml-1 ${getScoreColor(test.accessibility.score)}`}>
                        {test.accessibility.level}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateTesting;