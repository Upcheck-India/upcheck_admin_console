'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Briefcase, ArrowLeft, Loader2, AlertTriangle, ListChecks, Users, Settings } from 'lucide-react';

const ProjectDetailPage = () => {
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks'); // tasks, members, settings

  useEffect(() => {
    if (!id) return;

    const fetchProject = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/projects/${id}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch project details');
        }
        const data = await response.json();
        setProject(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [id]);

  if (loading) {
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
        return <div className="p-6"><h3 className="text-lg font-semibold">Tasks</h3><p className="text-gray-500 mt-2">Task management will be implemented here.</p></div>;
      case 'members':
        return <div className="p-6"><h3 className="text-lg font-semibold">Members</h3><p className="text-gray-500 mt-2">Member management will be implemented here.</p></div>;
      case 'settings':
        return <div className="p-6"><h3 className="text-lg font-semibold">Settings</h3><p className="text-gray-500 mt-2">Project settings will be implemented here.</p></div>;
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
