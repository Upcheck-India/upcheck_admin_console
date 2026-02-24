'use client';

import { useState, useEffect } from 'react';
import { X, Save, FileText, Upload, Calendar, AlertCircle } from 'lucide-react';

export default function DocumentationSettingsModal({ isOpen, onClose }) {
  const [settings, setSettings] = useState({
    allowInternUpload: false,
    allowInternDownload: true,
    allowedFileTypes: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.png'],
    maxFileSize: 10,
    fileNameRegex: '.*',
    uploadDeadline: '',
    allowedProjectsForDownload: ['general'],
    allowedDocuments: {} // { projectId: { docId: true } }
  });

  const [projects, setProjects] = useState([{ _id: 'general', name: 'General' }]);
  const [documents, setDocuments] = useState({}); // { projectId: [{ _id, name }] }
  const [expandedProjects, setExpandedProjects] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  const [isLoadingDocuments, setIsLoadingDocuments] = useState({});

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens to ensure fresh data
      setIsLoading(true);
      setSaveStatus({ type: '', message: '' });
      setDocuments({});
      setExpandedProjects({});
      fetchSettings();
    }
  }, [isOpen]);

  const fetchDocuments = async (projectId) => {
    if (!projectId || documents[projectId]) return;

    setIsLoadingDocuments(prev => ({ ...prev, [projectId]: true }));
    try {
      const response = await fetch(`/api/resources?projectId=${projectId}`, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        console.warn(`Failed to fetch documents for project ${projectId}:`, response.status);
        setDocuments(prev => ({ ...prev, [projectId]: [] }));
        return;
      }

      const data = await response.json();

      // Transform resources to match expected document format
      const docs = Array.isArray(data) ? data.map(doc => ({
        _id: doc._id || doc.id,
        name: doc.name || doc.filename || 'Unnamed Document',
        filename: doc.filename || doc.name || 'document'
      })) : [];

      setDocuments(prev => ({
        ...prev,
        [projectId]: docs
      }));
    } catch (error) {
      console.error('Error fetching documents:', error);
      setDocuments(prev => ({
        ...prev,
        [projectId]: []
      }));
    } finally {
      setIsLoadingDocuments(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const toggleProjectExpansion = async (projectId) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));

    if (!documents[projectId]) {
      await fetchDocuments(projectId);
    }
  };

  const fetchSettings = async () => {
    try {
      const [settingsRes, projectsRes] = await Promise.all([
        fetch('/api/server-settings', {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }),
        fetch('/api/projects', {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        })
      ]);

      console.log('Settings response status:', settingsRes.status);
      console.log('Projects response status:', projectsRes.status);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        console.log('Fetched settings data:', settingsData);

        // Handle both direct data and wrapped data formats
        const data = settingsData.data || settingsData;

        if (data && (data._id || data.allowInternUpload !== undefined)) {
          setSettings({
            allowInternUpload: data.allowInternUpload || false,
            allowInternDownload: data.allowInternDownload !== undefined ? data.allowInternDownload : true,
            allowedFileTypes: Array.isArray(data.allowedFileTypes) ? data.allowedFileTypes : ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.png'],
            maxFileSize: data.maxFileSize || 10,
            fileNameRegex: data.fileNameRegex || '.*',
            uploadDeadline: data.uploadDeadline ? new Date(data.uploadDeadline).toISOString().split('T')[0] : '',
            allowedProjectsForDownload: Array.isArray(data.allowedProjectsForDownload) ? data.allowedProjectsForDownload : ['general'],
            allowedDocuments: data.allowedDocuments || {}
          });
          console.log('Settings state updated');
        } else {
          console.warn('Invalid settings data format:', settingsData);
        }
      } else {
        console.error('Failed to fetch settings:', settingsRes.status, settingsRes.statusText);
        const errorData = await settingsRes.json().catch(() => ({}));
        console.error('Settings error details:', errorData);
        setSaveStatus({
          type: 'error',
          message: errorData.error || 'Failed to load settings'
        });
      }

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        console.log('Fetched projects data:', projectsData);

        if (Array.isArray(projectsData)) {
          // Ensure we have an array of { _id, name } objects
          const formattedProjects = projectsData.map(project => ({
            _id: project._id || project.name?.toLowerCase() || '',
            name: project.name || project._id || ''
          }));

          // Make sure General is always included
          const generalExists = formattedProjects.some(p => p._id.toLowerCase() === 'general');
          if (!generalExists) {
            formattedProjects.unshift({ _id: 'general', name: 'General' });
          }

          setProjects(formattedProjects);
          console.log('Projects state updated:', formattedProjects);
        } else {
          console.warn('Invalid projects data format:', projectsData);
        }
      } else {
        console.error('Failed to fetch projects:', projectsRes.status, projectsRes.statusText);
        const errorData = await projectsRes.json().catch(() => ({}));
        console.error('Projects error details:', errorData);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setSaveStatus({ type: 'error', message: 'Failed to load settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveStatus({ type: 'saving', message: 'Saving settings...' });

    try {
      // Prepare the settings data to match the server's expected format
      const settingsToSave = {
        allowInternUpload: settings.allowInternUpload,
        allowInternDownload: settings.allowInternDownload,
        allowedFileTypes: Array.isArray(settings.allowedFileTypes)
          ? settings.allowedFileTypes.map(t => t.trim()).filter(t => t.startsWith('.'))
          : [],
        maxFileSize: Number(settings.maxFileSize) || 10,
        fileNameRegex: settings.fileNameRegex || '.*',
        uploadDeadline: settings.uploadDeadline || null,
        allowedProjectsForDownload: Array.isArray(settings.allowedProjectsForDownload)
          ? settings.allowedProjectsForDownload
          : ['general'],
        // Clean up allowedDocuments to only include selected projects
        allowedDocuments: Object.entries(settings.allowedDocuments || {}).reduce((acc, [projectId, docs]) => {
          if (settings.allowedProjectsForDownload?.includes(projectId) && docs && typeof docs === 'object') {
            acc[projectId] = docs;
          }
          return acc;
        }, {})
      };

      console.log('Sending settings:', JSON.stringify(settingsToSave, null, 2));

      const response = await fetch('/api/server-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(settingsToSave)
      });

      console.log('Response status:', response.status);

      // Try to get the response text first for debugging
      const responseText = await response.text();
      console.log('Raw response:', responseText);

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        throw new Error(`Invalid server response: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        console.error('Server error:', responseData);
        throw new Error(
          responseData.error ||
          responseData.message ||
          `Server responded with status ${response.status}: ${response.statusText}`
        );
      }

      if (!responseData.success) {
        console.error('Operation failed:', responseData);
        throw new Error(responseData.error || 'Failed to save settings');
      }

      console.log('Settings saved successfully:', responseData);
      setSaveStatus({ type: 'success', message: 'Settings saved successfully!' });

      // Update the local state with the saved data to reflect any server-side changes
      if (responseData.data) {
        setSettings(prev => ({
          ...prev,
          ...responseData.data,
          uploadDeadline: responseData.data.uploadDeadline ?
            new Date(responseData.data.uploadDeadline).toISOString().split('T')[0] : ''
        }));
      }

      // Close the modal after a short delay
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus({
        type: 'error',
        message: error.message || 'Failed to save settings. Please try again.'
      });
    } finally {
      // Clear status after 3 seconds
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
    }
  };

  const handleFileTypeChange = (e) => {
    const value = e.target.value.trim();
    if (value && !settings.allowedFileTypes.includes(value)) {
      setSettings(prev => ({
        ...prev,
        allowedFileTypes: [...prev.allowedFileTypes, value]
      }));
      e.target.value = '';
    }
  };

  const toggleProjectForDownload = (projectId) => {
    setSettings(prev => {
      const currentProjects = Array.isArray(prev.allowedProjectsForDownload)
        ? [...prev.allowedProjectsForDownload]
        : [];

      const index = currentProjects.indexOf(projectId);
      let newAllowedDocs = { ...prev.allowedDocuments };

      if (index === -1) {
        currentProjects.push(projectId);
      } else {
        currentProjects.splice(index, 1);
        // Remove document permissions if project is deselected
        if (newAllowedDocs[projectId]) {
          delete newAllowedDocs[projectId];
        }
      }

      return {
        ...prev,
        allowedProjectsForDownload: currentProjects,
        allowedDocuments: newAllowedDocs
      };
    });
  };

  const toggleDocumentForDownload = (projectId, docId) => {
    setSettings(prev => {
      const newAllowedDocs = { ...prev.allowedDocuments };

      if (!newAllowedDocs[projectId]) {
        newAllowedDocs[projectId] = {};
      }

      if (newAllowedDocs[projectId][docId]) {
        delete newAllowedDocs[projectId][docId];
        // Clean up empty project entries
        if (Object.keys(newAllowedDocs[projectId]).length === 0) {
          delete newAllowedDocs[projectId];
        }
      } else {
        newAllowedDocs[projectId] = {
          ...newAllowedDocs[projectId],
          [docId]: true
        };
      }

      return {
        ...prev,
        allowedDocuments: newAllowedDocs
      };
    });
  };

  const isDocumentAllowed = (projectId, docId) => {
    return settings.allowedDocuments[projectId]?.[docId] || false;
  };

  const removeFileType = (type) => {
    setSettings(prev => ({
      ...prev,
      allowedFileTypes: prev.allowedFileTypes.filter(t => t !== type)
    }));
  };

  // Add a refresh button to manually fetch latest data
  const handleRefresh = () => {
    setIsLoading(true);
    setDocuments({});
    setExpandedProjects({});
    fetchSettings();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-end justify-center z-50 transition-opacity duration-300">
      <div className="bg-white shadow-2xl w-full max-w-2xl h-[100vh] sm:h-[90vh] sm:rounded-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-8 duration-300">
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100 bg-white z-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <FileText className="mr-2 h-5 w-5" />
              Documentation Settings
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                title="Refresh data"
              >
                <svg className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="allowInternUpload"
                    checked={settings.allowInternUpload}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      allowInternUpload: e.target.checked
                    }))}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="allowInternUpload" className="ml-2 block text-sm font-medium text-gray-700">
                    Allow Interns to Upload Documents
                  </label>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Advanced Settings</h3>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="maxFileSize" className="block text-sm font-medium text-gray-700 mb-1">
                        Maximum File Size (MB)
                      </label>
                      <input
                        type="number"
                        id="maxFileSize"
                        value={settings.maxFileSize}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          maxFileSize: e.target.value
                        }))}
                        min="1"
                        max="100"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="fileNameRegex" className="block text-sm font-medium text-gray-700 mb-1">
                        File Name Pattern (Regex)
                      </label>
                      <input
                        type="text"
                        id="fileNameRegex"
                        value={settings.fileNameRegex}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          fileNameRegex: e.target.value
                        }))}
                        placeholder="^[a-zA-Z0-9_\-\.]+\.(pdf|docx?|xlsx?|jpg|png)$"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Regular expression to validate file names. Example: ^[a-zA-Z0-9_\-\.]+\.(pdf|docx?|xlsx?|jpg|png)$
                      </p>
                    </div>

                    <div>
                      <label htmlFor="uploadDeadline" className="block text-sm font-medium text-gray-700 mb-1">
                        Upload Deadline (Optional)
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          id="uploadDeadline"
                          value={settings.uploadDeadline}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            uploadDeadline: e.target.value
                          }))}
                          min={new Date().toISOString().split('T')[0]}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                        {settings.uploadDeadline && (
                          <button
                            type="button"
                            onClick={() => setSettings(prev => ({ ...prev, uploadDeadline: '' }))}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Allowed File Types
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder=".pdf, .docx, etc."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleFileTypeChange(e);
                            }
                          }}
                          onBlur={handleFileTypeChange}
                          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            const input = e.target.parentElement.querySelector('input');
                            handleFileTypeChange({ target: { value: input.value } });
                            input.value = '';
                          }}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Add
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {settings.allowedFileTypes.map((type) => (
                          <span
                            key={type}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {type}
                            <button
                              type="button"
                              onClick={() => removeFileType(type)}
                              className="ml-1.5 inline-flex text-blue-400 hover:text-blue-600 focus:outline-none"
                            >
                              <span className="sr-only">Remove {type}</span>
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Allow Intern Download */}
                    <div className="pt-4 border-t">
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            type="checkbox"
                            id="allowInternDownload"
                            checked={settings.allowInternDownload}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              allowInternDownload: e.target.checked
                            }))}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="allowInternDownload" className="font-medium text-gray-700">
                            Allow Interns to Download Documents
                          </label>
                          <p className="text-gray-500">
                            When enabled, interns can download documents from allowed projects
                          </p>

                          {settings.allowInternDownload && (
                            <div className="mt-3">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Allowed Projects for Download:
                              </label>
                              <div className="space-y-2 max-h-96 overflow-y-auto p-2 border rounded-md">
                                {projects.map(project => {
                                  const projectId = project._id || project;
                                  const projectName = project.name || project;
                                  const isExpanded = expandedProjects[projectId];
                                  const projectAllowed = settings.allowedProjectsForDownload?.includes(projectId);
                                  const projectDocs = documents[projectId] || [];
                                  const isLoading = isLoadingDocuments[projectId];

                                  return (
                                    <div key={projectId} className="space-y-1">
                                      <div className="flex items-center">
                                        <button
                                          type="button"
                                          onClick={() => toggleProjectExpansion(projectId)}
                                          className="mr-1 text-gray-500 hover:text-gray-700"
                                        >
                                          {isExpanded ? '▼' : '►'}
                                        </button>
                                        <input
                                          id={`project-${projectId}`}
                                          name="projects"
                                          type="checkbox"
                                          checked={projectAllowed || false}
                                          onChange={() => toggleProjectForDownload(projectId)}
                                          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <label
                                          htmlFor={`project-${projectId}`}
                                          className={`ml-2 block text-sm ${projectAllowed ? 'font-medium' : 'text-gray-700'}`}
                                        >
                                          {projectName}
                                        </label>
                                      </div>

                                      {isExpanded && (
                                        <div className="ml-6 pl-2 border-l-2 border-gray-200">
                                          {isLoading ? (
                                            <div className="text-xs text-gray-500 py-1">Loading documents...</div>
                                          ) : projectDocs.length > 0 ? (
                                            projectDocs.map(doc => (
                                              <div key={doc._id} className="flex items-center mt-1">
                                                <input
                                                  id={`doc-${doc._id}`}
                                                  type="checkbox"
                                                  checked={isDocumentAllowed(projectId, doc._id)}
                                                  onChange={() => toggleDocumentForDownload(projectId, doc._id)}
                                                  disabled={!projectAllowed}
                                                  className={`h-3.5 w-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 ${!projectAllowed ? 'opacity-50' : ''}`}
                                                />
                                                <label
                                                  htmlFor={`doc-${doc._id}`}
                                                  className={`ml-2 text-xs ${isDocumentAllowed(projectId, doc._id) ? 'text-blue-700' : 'text-gray-600'} ${!projectAllowed ? 'opacity-50' : ''}`}
                                                >
                                                  {doc.name || doc.filename}
                                                </label>
                                              </div>
                                            ))
                                          ) : (
                                            <div className="text-xs text-gray-400 py-1">No documents in this project</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              <p className="mt-1 text-xs text-gray-500">
                                Select which projects interns can download documents from
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {saveStatus.message && (
                <div className={`p-3 rounded-md ${saveStatus.type === 'error' ? 'bg-red-50 text-red-700' :
                  saveStatus.type === 'success' ? 'bg-green-50 text-green-700' :
                    'bg-blue-50 text-blue-700'
                  }`}>
                  <div className="flex items-center">
                    {saveStatus.type === 'error' ? (
                      <AlertCircle className="h-5 w-5 mr-2" />
                    ) : saveStatus.type === 'success' ? (
                      <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-2"></div>
                    )}
                    <p className="text-sm">{saveStatus.message}</p>
                  </div>
                </div>
              )}

            </form>
          )}
        </div>

        {/* Fixed Footer with Actions */}
        {!isLoading && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={saveStatus.type === 'saving'}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-75 transition-colors"
            >
              {saveStatus.type === 'saving' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="-ml-1 mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
