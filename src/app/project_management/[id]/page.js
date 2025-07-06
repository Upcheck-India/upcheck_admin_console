'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Briefcase, ArrowLeft, Loader2, AlertTriangle, ListChecks, Users, Settings } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks'); // tasks, members, settings

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectRes, usersRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch('/api/users')
      ]);

      if (!projectRes.ok) {
        const errorData = await projectRes.json();
        throw new Error(errorData.error || 'Failed to fetch project details');
      }
      const projectData = await projectRes.json();
      setProject(projectData);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setAllUsers(usersData);
      } else {
        console.error('Failed to fetch users');
        // Continue without all users if it fails, the UI will handle it
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
        fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
        return <MembersTab members={project.members} superManager={project.superManager} />;
      case 'settings':
        return <SettingsTab project={project} user={user} allUsers={allUsers} onProjectUpdate={fetchData} />;
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
