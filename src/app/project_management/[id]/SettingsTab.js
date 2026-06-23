'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Save, AlertTriangle, Settings, Users, Github, Image, Eye, EyeOff, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import ManageMembersForm from './ManageMembersForm';
import { uploadFile } from '../../../lib/upload';
import { getUserPermissionLevel } from '../../../lib/projectPermissions';

const SettingsTab = ({ project, user, allUsers, userTeams, onProjectUpdate }) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [logoFile, setLogoFile] = useState(null);
  const [logoUrl, setLogoUrl] = useState(project.logo || '');
  const [members, setMembers] = useState(project.members);
  const [repoUrl, setRepoUrl] = useState(project.githubRepoUrl || '');
  const [showRepoPreview, setShowRepoPreview] = useState(false);
  const [repoValidation, setRepoValidation] = useState(null);

   // Settings configuration states
  const [allowContributorsUpdateTasks, setAllowContributorsUpdateTasks] = useState(project.settings?.allowContributorsUpdateTasks !== false);
  const [allowContributorsDeleteTasks, setAllowContributorsDeleteTasks] = useState(project.settings?.allowContributorsDeleteTasks === true);
  const [sendNotifications, setSendNotifications] = useState(project.settings?.sendNotifications !== false);
  const [sendTaskAssignmentEmails, setSendTaskAssignmentEmails] = useState(project.settings?.sendTaskAssignmentEmails !== false);
  const [sendSprintCreationEmails, setSendSprintCreationEmails] = useState(project.settings?.sendSprintCreationEmails !== false);
  const [sendProjectInviteEmails, setSendProjectInviteEmails] = useState(project.settings?.sendProjectInviteEmails !== false);
  const [enableIdeaCanvas, setEnableIdeaCanvas] = useState(project.settings?.enableIdeaCanvas !== false);
  const [githubIntegrationEnabled, setGithubIntegrationEnabled] = useState(project.settings?.githubIntegrationEnabled !== false);
  const [trackTaskActivity, setTrackTaskActivity] = useState(project.settings?.trackTaskActivity !== false);
  const [enableLeaderboardShoutout, setEnableLeaderboardShoutout] = useState(project.settings?.enableLeaderboardShoutout !== false);

  // Labels state
  const [labels, setLabels] = useState(project?.settings?.labels || []);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3b82f6');
  const [isSavingLabels, setIsSavingLabels] = useState(false);

  // GitHub Advanced Settings
  const [githubPAT, setGithubPAT] = useState(project.settings?.github?.personalAccessToken || '');
  const [showFileBrowser, setShowFileBrowser] = useState(project.settings?.github?.showFileBrowser !== false);
  const [showCommits, setShowCommits] = useState(project.settings?.github?.showCommits !== false);
  const [showBranches, setShowBranches] = useState(project.settings?.github?.showBranches !== false);
  const [showContributors, setShowContributors] = useState(project.settings?.github?.showContributors !== false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (project && user) {
      const perms = getUserPermissionLevel(user, project, userTeams);
      const isSuper = project.superManager === user.username;
      const isManager = project.members?.some(m => m.user === user.username && m.role === 'Project Manager');
      setIsAuthorized(isSuper || isManager || (perms && perms.level === 'full'));
    }
  }, [project, user, userTeams]);

  // Track unsaved changes
  useEffect(() => {
    const defaultSettings = {
      allowContributorsUpdateTasks: true,
      allowContributorsDeleteTasks: false,
      sendNotifications: true,
      enableIdeaCanvas: true,
      githubIntegrationEnabled: true,
      trackTaskActivity: true,
    };
    const currentSettings = project.settings || defaultSettings;
    const hasChanges = 
      name !== project.name ||
      description !== project.description ||
      logoUrl !== (project.logo || '') ||
      repoUrl !== (project.githubRepoUrl || '') ||
      JSON.stringify(members) !== JSON.stringify(project.members) ||
      logoFile !== null ||
      allowContributorsUpdateTasks !== (currentSettings.allowContributorsUpdateTasks !== false) ||
      allowContributorsDeleteTasks !== (currentSettings.allowContributorsDeleteTasks === true) ||
      sendNotifications !== (currentSettings.sendNotifications !== false) ||
      sendTaskAssignmentEmails !== (currentSettings.sendTaskAssignmentEmails !== false) ||
      sendSprintCreationEmails !== (currentSettings.sendSprintCreationEmails !== false) ||
      sendProjectInviteEmails !== (currentSettings.sendProjectInviteEmails !== false) ||
      enableIdeaCanvas !== (currentSettings.enableIdeaCanvas !== false) ||
      githubIntegrationEnabled !== (currentSettings.githubIntegrationEnabled !== false) ||
      trackTaskActivity !== (currentSettings.trackTaskActivity !== false) ||
      enableLeaderboardShoutout !== (currentSettings.enableLeaderboardShoutout !== false) ||
      githubPAT !== (project.settings?.github?.personalAccessToken || '') ||
      showFileBrowser !== (project.settings?.github?.showFileBrowser !== false) ||
      showCommits !== (project.settings?.github?.showCommits !== false) ||
      showBranches !== (project.settings?.github?.showBranches !== false) ||
      showContributors !== (project.settings?.github?.showContributors !== false);
    
    setHasUnsavedChanges(hasChanges);
  }, [name, description, logoUrl, repoUrl, members, logoFile, project,
      allowContributorsUpdateTasks, allowContributorsDeleteTasks, sendNotifications,
      sendTaskAssignmentEmails, sendSprintCreationEmails, sendProjectInviteEmails,
      enableIdeaCanvas, githubIntegrationEnabled, trackTaskActivity, enableLeaderboardShoutout,
      githubPAT, showFileBrowser, showCommits, showBranches, showContributors]);

  // Validate GitHub URL
  useEffect(() => {
    const validateRepo = async () => {
      if (!repoUrl.trim()) {
        setRepoValidation(null);
        return;
      }

      const githubPattern = /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+\/?$/;
      if (!githubPattern.test(repoUrl.trim())) {
        setRepoValidation({ status: 'error', message: 'Invalid GitHub URL format' });
        return;
      }

      setRepoValidation({ status: 'validating', message: 'Validating repository...' });
      
      try {
        const repoPath = repoUrl.replace('https://github.com/', '');
        const response = await fetch(`https://api.github.com/repos/${repoPath}`);
        
        if (response.ok) {
          const repoData = await response.json();
          setRepoValidation({ 
            status: 'success', 
            message: 'Repository found',
            data: repoData 
          });
        } else {
          setRepoValidation({ 
            status: 'error', 
            message: 'Repository not found or not accessible' 
          });
        }
      } catch (err) {
        setRepoValidation({ 
          status: 'error', 
          message: 'Failed to validate repository' 
        });
      }
    };

    const timeoutId = setTimeout(validateRepo, 500);
    return () => clearTimeout(timeoutId);
  }, [repoUrl]);

  // Clear messages after delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    let uploadedLogoUrl = logoUrl;

    try {
      if (logoFile) {
        const uploadResult = await uploadFile(logoFile);
        if (uploadResult && uploadResult.filePath) {
          uploadedLogoUrl = uploadResult.filePath;
        } else {
          throw new Error('Logo upload failed.');
        }
      }

      const response = await fetch(`/api/projects/${project._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: name.trim(), 
          description: description.trim(), 
          logo: uploadedLogoUrl, 
          members,
          githubRepoUrl: repoUrl.trim(),
          allowContributorsUpdateTasks,
          allowContributorsDeleteTasks,
          sendNotifications,
          sendTaskAssignmentEmails,
          sendSprintCreationEmails,
          sendProjectInviteEmails,
          enableIdeaCanvas,
          githubIntegrationEnabled,
          trackTaskActivity,
          enableLeaderboardShoutout,
          githubPAT,
          showFileBrowser,
          showCommits,
          showBranches,
          showContributors
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update project');
      }

      setSuccess('Project settings updated successfully!');
      setLogoFile(null);
      onProjectUpdate(); // Callback to refresh data on the parent page

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setName(project.name);
    setDescription(project.description);
    setLogoUrl(project.logo || '');
    setMembers(project.members);
    setRepoUrl(project.githubRepoUrl || '');
    setLogoFile(null);
    const defaultSettings = {
      allowContributorsUpdateTasks: true,
      allowContributorsDeleteTasks: false,
      sendNotifications: true,
      enableIdeaCanvas: true,
      githubIntegrationEnabled: true,
      trackTaskActivity: true,
    };
    const currentSettings = project.settings || defaultSettings;
    setAllowContributorsUpdateTasks(currentSettings.allowContributorsUpdateTasks !== false);
    setAllowContributorsDeleteTasks(currentSettings.allowContributorsDeleteTasks === true);
    setSendNotifications(currentSettings.sendNotifications !== false);
    setSendTaskAssignmentEmails(currentSettings.sendTaskAssignmentEmails !== false);
    setSendSprintCreationEmails(currentSettings.sendSprintCreationEmails !== false);
    setSendProjectInviteEmails(currentSettings.sendProjectInviteEmails !== false);
    setEnableIdeaCanvas(currentSettings.enableIdeaCanvas !== false);
    setGithubIntegrationEnabled(currentSettings.githubIntegrationEnabled !== false);
    setTrackTaskActivity(currentSettings.trackTaskActivity !== false);
    setEnableLeaderboardShoutout(currentSettings.enableLeaderboardShoutout !== false);
    setGithubPAT(project.settings?.github?.personalAccessToken || '');
    setShowFileBrowser(project.settings?.github?.showFileBrowser !== false);
    setShowCommits(project.settings?.github?.showCommits !== false);
    setShowBranches(project.settings?.github?.showBranches !== false);
    setShowContributors(project.settings?.github?.showContributors !== false);
    setError(null);
    setSuccess(null);
  };

  const handleAddLabel = () => {
    if (!newLabelName.trim()) return;
    const newLabel = { name: newLabelName.trim(), color: newLabelColor };
    setLabels(prev => [...prev, newLabel]);
    setNewLabelName('');
  };

  const handleRemoveLabel = (index) => {
    setLabels(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveLabels = async () => {
    setIsSavingLabels(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/projects/${project._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ labels })
      });
      if (!res.ok) throw new Error('Failed to save labels');
      const updated = await res.json();
      onProjectUpdate(updated);
      alert('Labels saved!');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSavingLabels(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg flex items-start p-4">
          <AlertTriangle className="h-6 w-6 text-yellow-500 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-yellow-800 mb-1">Permissions Required</h3>
            <p className="text-yellow-700 text-sm">
              Only the Super Manager or Project Managers can modify project settings.
            </p>
            <p className="text-yellow-600 text-xs mt-2">
              Your current role: <span className="font-medium">
                {project.members?.find(m => m.user === user.username)?.role || 'Contributor'}
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <XCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-red-800">Error</h4>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
          <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-green-800">Success</h4>
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* General Settings */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <Settings className="h-5 w-5 mr-2 text-gray-600" />
              General Settings
            </h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name *
                </label>
                <input 
                  type="text" 
                  id="projectName" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              {githubIntegrationEnabled ? (
                <div>
                  <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700 mb-2">
                    GitHub Repository URL
                  </label>
                  <div className="relative">
                    <input 
                      type="url" 
                      id="repoUrl" 
                      value={repoUrl} 
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo"
                      className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      {repoValidation?.status === 'validating' && (
                        <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                      )}
                      {repoValidation?.status === 'success' && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      {repoValidation?.status === 'error' && (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  {repoValidation?.message && (
                    <p className={`text-xs mt-1 ${
                      repoValidation.status === 'error' ? 'text-red-600' : 
                      repoValidation.status === 'success' ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {repoValidation.message}
                    </p>
                  )}
                  {repoValidation?.status === 'success' && repoValidation.data && (
                    <button
                      type="button"
                      onClick={() => setShowRepoPreview(!showRepoPreview)}
                      className="text-xs text-blue-600 hover:text-blue-800 mt-1 flex items-center"
                    >
                      {showRepoPreview ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                      {showRepoPreview ? 'Hide' : 'Show'} repository info
                    </button>
                  )}
                  {showRepoPreview && repoValidation?.data && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-md border text-xs">
                      <p><strong>Name:</strong> {repoValidation.data.name}</p>
                      <p><strong>Description:</strong> {repoValidation.data.description || 'No description'}</p>
                      <p><strong>Language:</strong> {repoValidation.data.language || 'Not specified'}</p>
                      <p><strong>Stars:</strong> {repoValidation.data.stargazers_count}</p>
                      <p><strong>Private:</strong> {repoValidation.data.private ? 'Yes' : 'No'}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col justify-center p-4 bg-gray-50 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 h-full min-h-[80px]">
                  <span className="font-semibold text-gray-700 mb-1">GitHub Integration Disabled</span>
                  <span>Enable it in the Board & Permissions Settings below to link a repository.</span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="projectDescription" className="block text-sm font-medium text-gray-700 mb-2">
                Project Description
              </label>
              <textarea 
                id="projectDescription" 
                rows={4} 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe your project goals, scope, and key objectives..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Image className="h-4 w-4 inline mr-1" />
                Project Logo
              </label>
              <div className="space-y-3">
                <div className="flex items-center space-x-4">
                  {(logoUrl || logoFile) && (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center border">
                      {logoFile ? (
                        <img 
                          src={URL.createObjectURL(logoFile)} 
                          alt="Logo preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <img 
                          src={logoUrl} 
                          alt="Current logo" 
                          className="w-full h-full object-cover rounded-lg"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      )}
                      <div className="w-full h-full bg-gray-200 rounded-lg hidden items-center justify-center">
                        <Image className="h-6 w-6 text-gray-400" />
                      </div>
                    </div>
                  )}
                  <div className="flex-1">
                    <input 
                      type="file" 
                      id="logoFile" 
                      accept="image/*"
                      onChange={(e) => setLogoFile(e.target.files[0])}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                </div>
                <div className="relative">
                  <input 
                    type="url" 
                    value={logoUrl} 
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="Or paste an image URL"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Project Board & Permissions Settings */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <Settings className="h-5 w-5 mr-2 text-gray-600" />
              Project Board & Permissions Settings
            </h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Task Permission Settings */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700 text-sm border-b pb-1">Task Permissions</h4>
                
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="allowContributorsUpdateTasks"
                      name="allowContributorsUpdateTasks"
                      type="checkbox"
                      checked={allowContributorsUpdateTasks}
                      onChange={(e) => setAllowContributorsUpdateTasks(e.target.checked)}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="allowContributorsUpdateTasks" className="font-medium text-gray-700 cursor-pointer">
                      Allow contributors to move/update tasks
                    </label>
                    <p className="text-gray-500 text-xs">
                      If checked, non-managers (Contributors) can drag tasks and change their status.
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="allowContributorsDeleteTasks"
                      name="allowContributorsDeleteTasks"
                      type="checkbox"
                      checked={allowContributorsDeleteTasks}
                      onChange={(e) => setAllowContributorsDeleteTasks(e.target.checked)}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="allowContributorsDeleteTasks" className="font-medium text-gray-700 cursor-pointer">
                      Allow contributors to delete tasks
                    </label>
                    <p className="text-gray-500 text-xs">
                      If checked, non-managers can delete any tasks they have write access to.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700 text-sm border-b pb-1">Feature & Notification Toggles</h4>

                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="sendNotifications"
                      name="sendNotifications"
                      type="checkbox"
                      checked={sendNotifications}
                      onChange={(e) => setSendNotifications(e.target.checked)}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="sendNotifications" className="font-medium text-gray-700 cursor-pointer">
                      Enable automated email alerts (Global)
                    </label>
                    <p className="text-gray-500 text-xs">
                      Master toggle to turn all email alerts on or off for this project.
                    </p>
                  </div>
                </div>

                {sendNotifications && (
                  <div className="ml-6 space-y-3 border-l-2 border-gray-200 pl-3">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="sendProjectInviteEmails"
                          name="sendProjectInviteEmails"
                          type="checkbox"
                          checked={sendProjectInviteEmails}
                          onChange={(e) => setSendProjectInviteEmails(e.target.checked)}
                          className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="sendProjectInviteEmails" className="font-medium text-gray-700 cursor-pointer">
                          Project membership invites
                        </label>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="sendTaskAssignmentEmails"
                          name="sendTaskAssignmentEmails"
                          type="checkbox"
                          checked={sendTaskAssignmentEmails}
                          onChange={(e) => setSendTaskAssignmentEmails(e.target.checked)}
                          className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="sendTaskAssignmentEmails" className="font-medium text-gray-700 cursor-pointer">
                          Task assignments
                        </label>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="sendSprintCreationEmails"
                          name="sendSprintCreationEmails"
                          type="checkbox"
                          checked={sendSprintCreationEmails}
                          onChange={(e) => setSendSprintCreationEmails(e.target.checked)}
                          className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="sendSprintCreationEmails" className="font-medium text-gray-700 cursor-pointer">
                          Sprint creation milestones
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="enableIdeaCanvas"
                      name="enableIdeaCanvas"
                      type="checkbox"
                      checked={enableIdeaCanvas}
                      onChange={(e) => setEnableIdeaCanvas(e.target.checked)}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="enableIdeaCanvas" className="font-medium text-gray-700 cursor-pointer">
                      Enable Idea Canvas tab
                    </label>
                    <p className="text-gray-500 text-xs">
                      Allow members to draft brainstorming ideas in a dedicated plain-text canvas space.
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="githubIntegrationEnabled"
                      name="githubIntegrationEnabled"
                      type="checkbox"
                      checked={githubIntegrationEnabled}
                      onChange={(e) => setGithubIntegrationEnabled(e.target.checked)}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="githubIntegrationEnabled" className="font-medium text-gray-700 cursor-pointer">
                      Enable GitHub Integration
                    </label>
                    <p className="text-gray-500 text-xs">
                      Toggle the GitHub Repository URL field and show repository metadata.
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="enableLeaderboardShoutout"
                      name="enableLeaderboardShoutout"
                      type="checkbox"
                      checked={enableLeaderboardShoutout}
                      onChange={(e) => setEnableLeaderboardShoutout(e.target.checked)}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="enableLeaderboardShoutout" className="font-medium text-gray-700 cursor-pointer">
                      Enable Top Performer Shoutout
                    </label>
                    <p className="text-gray-500 text-xs">
                      Show a celebratory announcement banner for the #1 leaderboard contributor at the top of the Tasks tab.
                    </p>
                  </div>
                </div>
              </div>

              {githubIntegrationEnabled && (
                <div className="space-y-4 mt-6 pt-6 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-700 text-sm border-b pb-1">GitHub Advanced Settings</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Personal Access Token (PAT)</label>
                    <p className="text-xs text-gray-500 mb-2">Required for private repositories. Generate a token at github.com/settings/tokens with &apos;repo&apos; scope.</p>
                    <input 
                      type="password"
                      value={githubPAT}
                      onChange={(e) => setGithubPAT(e.target.value)}
                      placeholder="ghp_..."
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-3 mt-4">
                    <p className="text-xs text-gray-500">Choose which GitHub features to display in the GitHub tab:</p>
                    
                    <div className="flex items-center">
                      <input id="showFileBrowser" type="checkbox" checked={showFileBrowser} onChange={(e) => setShowFileBrowser(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer" />
                      <label htmlFor="showFileBrowser" className="ml-2 block text-sm text-gray-700 cursor-pointer">Show File Browser</label>
                    </div>
                    
                    <div className="flex items-center">
                      <input id="showCommits" type="checkbox" checked={showCommits} onChange={(e) => setShowCommits(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer" />
                      <label htmlFor="showCommits" className="ml-2 block text-sm text-gray-700 cursor-pointer">Show Commits History</label>
                    </div>
                    
                    <div className="flex items-center">
                      <input id="showBranches" type="checkbox" checked={showBranches} onChange={(e) => setShowBranches(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer" />
                      <label htmlFor="showBranches" className="ml-2 block text-sm text-gray-700 cursor-pointer">Show Branches</label>
                    </div>

                    <div className="flex items-center">
                      <input id="showContributors" type="checkbox" checked={showContributors} onChange={(e) => setShowContributors(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer" />
                      <label htmlFor="showContributors" className="ml-2 block text-sm text-gray-700 cursor-pointer">Show Contributors</label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Task Labels Section */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-bold text-gray-800">Task Labels</h3>
            <p className="text-sm text-gray-500 mt-1">Create color-coded labels to categorize and filter tasks.</p>
          </div>
          <div className="p-5">
            {/* Existing labels */}
            <div className="flex flex-wrap gap-2 mb-4">
              {labels.map((label, index) => (
                <span key={index} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium text-white" style={{ backgroundColor: label.color }}>
                  {label.name}
                  <button onClick={() => handleRemoveLabel(index)} className="hover:opacity-70">&times;</button>
                </span>
              ))}
              {labels.length === 0 && <p className="text-sm text-gray-400 italic">No labels yet.</p>}
            </div>
            {/* Add new label */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newLabelName}
                onChange={e => setNewLabelName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddLabel()}
                placeholder="Label name..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <input
                type="color"
                value={newLabelColor}
                onChange={e => setNewLabelColor(e.target.value)}
                className="h-9 w-9 cursor-pointer rounded border border-gray-300 p-0.5"
                title="Label color"
              />
              <button onClick={handleAddLabel} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">Add</button>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={handleSaveLabels} disabled={isSavingLabels} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {isSavingLabels ? 'Saving...' : 'Save Labels'}
              </button>
            </div>
          </div>
        </div>

        {/* Team Management */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <Users className="h-5 w-5 mr-2 text-gray-600" />
              Team Management
            </h3>
          </div>
          <div className="p-6">
            <ManageMembersForm 
              initialMembers={members} 
              onMembersChange={setMembers} 
              superManager={project.superManager} 
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex items-center">
            {hasUnsavedChanges && (
              <div className="flex items-center text-amber-600 text-sm">
                <AlertCircle className="h-4 w-4 mr-1" />
                You have unsaved changes
              </div>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting || !hasUnsavedChanges}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset Changes
            </button>
            <button 
              type="button" 
              onClick={handleSubmit}
              disabled={isSubmitting || !hasUnsavedChanges}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;