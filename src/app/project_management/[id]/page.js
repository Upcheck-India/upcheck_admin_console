'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Briefcase, ArrowLeft, Loader2, AlertTriangle, ListChecks, Users, Settings, StickyNote, Github, BarChart3 } from 'lucide-react';
import IdeaCanvas from './IdeaCanvas';
import { useAuth } from '../../../hooks/useAuth';
import SettingsTab from './SettingsTab';
import MembersTab from './MembersTab';
import TasksTab from './TasksTab';
import GitHubTab from './GitHubTab';

const ProjectDetailPage = () => {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  const { user, loading: authLoading } = useAuth();

  const [project, setProject] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks'); // tasks, members, github, canvas, settings

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const headers = {
        'x-user-role': user.role || '',
        'x-user-id': user._id || ''
      };

      const [projectRes, usersRes, teamsRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch('/api/users?limit=500', { headers }),
        fetch('/api/teams?limit=500', { headers })
      ]);

      if (!projectRes.ok) {
        const errorData = await projectRes.json();
        throw new Error(errorData.error || 'Failed to fetch project details');
      }
      const projectData = await projectRes.json();
      setProject(projectData);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setAllUsers(usersData.users || []);
      } else {
        console.error('Failed to fetch users');
      }

      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setAllTeams(teamsData.teams || []);
      } else {
        console.error('Failed to fetch teams');
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && user) {
        fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-700 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/project_management')}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center mx-auto"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return null; // Or a 'not found' component
  }

  const showGithubTab = project.settings?.githubIntegrationEnabled !== false && project.githubRepoUrl;

  const TabContent = () => {
    switch (activeTab) {
      case 'tasks':
        return <TasksTab projectId={project._id} project={project} allUsers={allUsers} allTeams={allTeams} />;
      case 'members':
        return (
          <MembersTab
            members={project.members}
            superManager={project.superManager}
            project={project}
            allTeams={allTeams}
          />
        );
      case 'github':
        return showGithubTab ? <GitHubTab project={project} projectId={id} /> : null;
      case 'settings':
        return <SettingsTab project={project} user={user} allUsers={allUsers} onProjectUpdate={fetchData} />;
      case 'canvas':
        return <IdeaCanvas project={project} />;
      default:
        return null;
    }
  };

  // Determine project status color (assuming standard status string like 'Active', 'Paused', etc.)
  let statusColor = 'bg-gray-100 text-gray-800';
  if (project.status === 'Active') statusColor = 'bg-green-100 text-green-800';
  else if (project.status === 'Paused') statusColor = 'bg-amber-100 text-amber-800';
  else if (project.status === 'Completed') statusColor = 'bg-blue-100 text-blue-800';

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Gradient Hero Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-teal-500 pt-6 pb-16 px-4 md:px-6 relative overflow-hidden">
        {/* Abstract background shapes */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-white opacity-5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-60 h-60 bg-teal-300 opacity-10 rounded-full blur-2xl"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <button
            onClick={() => router.push('/project_management')}
            className="flex items-center text-sm text-white/80 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to All Projects
          </button>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center">
              {project.logo ? (
                <img src={project.logo} alt="Project Logo" className="h-16 w-16 rounded-xl object-cover bg-white p-1 mr-4 shadow-md" />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mr-4 shadow-md border border-white/20">
                  <Briefcase className="h-8 w-8 text-white" />
                </div>
              )}
              
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold text-white tracking-tight">{project.name}</h1>
                  {project.status && (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${statusColor} shadow-sm`}>
                      {project.status}
                    </span>
                  )}
                </div>
                <p className="text-blue-100 text-sm max-w-2xl">{project.description || 'No description provided.'}</p>
                
                {showGithubTab && (
                  <a 
                    href={project.githubRepoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center mt-2 text-sm text-white/80 hover:text-white transition-colors group"
                  >
                    <Github className="h-4 w-4 mr-1.5 group-hover:scale-110 transition-transform" />
                    <span className="group-hover:underline underline-offset-2">{project.githubRepoUrl.replace('https://github.com/', '')}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Stat Cards Row - Overlapping header */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 -mt-8 mb-6 relative z-20">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center hover:shadow-md transition-shadow">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg mr-4">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Members</p>
              <p className="text-xl font-bold bg-gradient-to-r from-blue-600 to-teal-500 bg-clip-text text-transparent">
                {project.members?.length || 0}
              </p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center hover:shadow-md transition-shadow">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-lg mr-4">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Access Mode</p>
              <p className="text-sm font-bold text-gray-900 mt-1 capitalize">
                {(project.permissionSettings?.accessMode || 'members_only').replace('_', ' ')}
              </p>
            </div>
          </div>

          {showGithubTab && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center hover:shadow-md transition-shadow">
              <div className="p-3 bg-gray-50 text-gray-700 rounded-lg mr-4">
                <Github className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Integration</p>
                <p className="text-sm font-bold text-gray-900 mt-1">Active</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Pill-style Tab Navigation */}
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-wrap gap-1 bg-gray-100/80 p-1 rounded-lg w-max border border-gray-200 shadow-inner">
              <button 
                onClick={() => setActiveTab('tasks')} 
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'tasks' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <ListChecks className="h-4 w-4 mr-2" /> Tasks
              </button>
              <button 
                onClick={() => setActiveTab('members')} 
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'members' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Users className="h-4 w-4 mr-2" /> Members
              </button>
              
              {showGithubTab && (
                <button 
                  onClick={() => setActiveTab('github')} 
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    activeTab === 'github' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Github className="h-4 w-4 mr-2" /> GitHub
                </button>
              )}

              {project.settings?.enableIdeaCanvas !== false && (
                <button 
                  onClick={() => setActiveTab('canvas')} 
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    activeTab === 'canvas' ? 'bg-white text-yellow-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <StickyNote className="h-4 w-4 mr-2" /> Canvas
                </button>
              )}
              
              <button 
                onClick={() => setActiveTab('settings')} 
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'settings' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Settings className="h-4 w-4 mr-2" /> Settings
              </button>
            </div>
          </div>
          
          <div className="p-2 md:p-6 bg-white min-h-[500px]">
            <TabContent />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;
