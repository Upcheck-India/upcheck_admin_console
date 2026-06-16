'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Briefcase, ArrowLeft, Loader2, AlertTriangle, ListChecks, Users, Settings, StickyNote } from 'lucide-react';
import IdeaCanvas from './IdeaCanvas';
import { useAuth } from '../../../hooks/useAuth';
import SettingsTab from './SettingsTab';
import MembersTab from './MembersTab';
import TasksTab from './TasksTab';

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
  const [activeTab, setActiveTab] = useState('tasks'); // tasks, members, settings, canvas

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

  const TabContent = () => {
    switch (activeTab) {
      case 'tasks':
        return <TasksTab projectId={project._id} project={project} allUsers={allUsers} />;
      case 'members':
        return (
          <MembersTab
            members={project.members}
            superManager={project.superManager}
            project={project}
            allTeams={allTeams}
          />
        );
      case 'settings':
        return <SettingsTab project={project} user={user} allUsers={allUsers} onProjectUpdate={fetchData} />;
      case 'canvas':
        return <IdeaCanvas project={project} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push('/project_management')}
            className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to All Projects
          </button>
          <div className="flex items-center">
            <Briefcase className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-gray-600 text-sm mt-1">{project.description}</p>
              {project.githubRepoUrl && (
                <a href={project.githubRepoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center mt-1">
                  <svg className="h-4 w-4 mr-1" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2 .37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38A8.012 8.012 0 0016 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                  {project.githubRepoUrl.replace('https://github.com/', '')}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <div className="flex space-x-4 px-6">
              <button onClick={() => setActiveTab('tasks')} className={`flex items-center py-4 px-1 text-sm font-medium ${activeTab === 'tasks' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                <ListChecks className="h-5 w-5 mr-2" /> Tasks
              </button>
              <button onClick={() => setActiveTab('members')} className={`flex items-center py-4 px-1 text-sm font-medium ${activeTab === 'members' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                <Users className="h-5 w-5 mr-2" /> Members
              </button>
              <button onClick={() => setActiveTab('canvas')} className={`flex items-center py-4 px-1 text-sm font-medium ${activeTab === 'canvas' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                <StickyNote className="h-5 w-5 mr-2" /> Canvas
              </button>
              <button onClick={() => setActiveTab('settings')} className={`flex items-center py-4 px-1 text-sm font-medium ${activeTab === 'settings' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                <Settings className="h-5 w-5 mr-2" /> Settings
              </button>
              
            </div>
          </div>
          <div>
            <TabContent />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;
