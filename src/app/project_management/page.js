'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FolderKanban, Plus, User, Search, Briefcase, Loader2, AlertTriangle, X, ShieldCheck, Trash2 } from 'lucide-react';

const ProjectManagementPage = () => {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'my'
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [projectsResponse, userResponse] = await Promise.all([
          fetch(`/api/projects?tab=${activeTab}`),
          fetch('/api/auth/me')
        ]);

        if (!projectsResponse.ok) {
          const errorData = await projectsResponse.json();
          throw new Error(errorData.error || 'Failed to fetch projects');
        }
        if (!userResponse.ok) {
          const errorData = await userResponse.json();
          throw new Error(errorData.error || 'Failed to fetch user data');
        }

        const projectsData = await projectsResponse.json();
        const userData = await userResponse.json();

        setProjects(projectsData);
        setCurrentUser(userData);

      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [activeTab]);


  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteClick = (project) => {
    setProjectToDelete(project);
    setShowDeleteModal(true);
    setDeleteConfirmationName('');
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete || deleteConfirmationName !== projectToDelete.name) {
      alert('Project name does not match. Deletion cancelled.');
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectToDelete._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete project');
      }

      setProjects(projects.filter(p => p._id !== projectToDelete._id));
      setShowDeleteModal(false);
      setProjectToDelete(null);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const ProjectCard = ({ project }) => {
    const projectManagers = project.members?.filter(m => m.role === 'Project Manager') || [];
    const otherMembers = project.members?.filter(m => m.role !== 'Project Manager' && m.role !== 'Super Manager') || [];

    const MemberList = ({ members, roleName }) => (
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-600 mb-2">{roleName} ({members.length})</h4>
        <div className="flex flex-wrap gap-2 min-h-[20px]">
          {members.slice(0, 2).map(member => (
            <span key={member.user} className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs">{member.user}</span>
          ))}
          {members.length > 2 && (
            <span className="text-gray-500 text-xs cursor-pointer hover:underline">+ {members.length - 2} more</span>
          )}
          {members.length === 0 && <span className="text-xs text-gray-400">No {roleName.toLowerCase()} yet.</span>}
        </div>
      </div>
    );

    return (
      <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-bold text-gray-800 truncate pr-2">{project.name}</h3>
            {project.logo ? (
              <img src={project.logo} alt={`${project.name} logo`} className="h-8 w-8 rounded-md object-cover flex-shrink-0" />
            ) : (
              <FolderKanban className="h-6 w-6 text-blue-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-gray-600 mb-4 text-sm line-clamp-2 h-10">{project.description}</p>
        </div>
        <div className="flex-grow" />
        <div>
          <div className="flex items-center text-sm text-gray-500 mb-4">
            <ShieldCheck className="h-4 w-4 mr-2 text-blue-500" />
            <span>Super Manager: {project.superManager || 'N/A'}</span>
          </div>
          
          <MemberList members={projectManagers} roleName="Project Managers" />
          <MemberList members={otherMembers} roleName="Members" />

          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
            <button 
              onClick={() => router.push(`/project_management/${project._id}`)}
              className="w-full text-center bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2 px-4 rounded-md transition-colors duration-200 text-sm"
            >
              View Project
            </button>
            {currentUser && (project.superManager === currentUser.username || project.members?.some(m => m.user === currentUser.username && m.role === 'Project Manager')) && (
              <button
                onClick={() => handleDeleteClick(project)}
                className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-md transition-colors duration-200"
                aria-label="Delete project"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {showDeleteModal && projectToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-red-600">Delete Project</h2>
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-500 hover:text-gray-800">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="text-center">
              <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <p className="text-gray-700 mb-4">
                This action is irreversible and can lead to permanent data loss. Before proceeding, please check for any resources this project may contain on the documentation page.
              </p>
              <p className="text-gray-700 font-semibold mb-4">
                To confirm, type the project name: <span className="font-bold text-red-700">{projectToDelete.name}</span>
              </p>
              <input 
                type="text"
                value={deleteConfirmationName}
                onChange={(e) => setDeleteConfirmationName(e.target.value)}
                className="w-full border-2 border-gray-300 p-2 rounded-md mb-6 focus:border-red-500 focus:ring-red-500"
                placeholder="Project name"
              />
              <button 
                onClick={handleDeleteConfirm}
                disabled={deleteConfirmationName !== projectToDelete.name}
                className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-md hover:bg-red-700 disabled:bg-gray-400 transition-colors duration-200"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Project Management</h1>
              <p className="text-gray-600 mt-1">Oversee all your ongoing projects.</p>
            </div>
            <Link href="/project_management/create">
              <button className="flex items-center justify-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm hover:bg-blue-700 transition-colors duration-200">
                <Plus className="h-5 w-5 mr-2" />
                Create New Project
              </button>
            </Link>
          </div>

          <div className="mb-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`${activeTab === 'all' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    All Projects
                  </button>
                  <button
                    onClick={() => setActiveTab('my')}
                    className={`${activeTab === 'my' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    My Projects
                  </button>
                </nav>
              </div>
              <div className="relative w-full md:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full md:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center p-10">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 mr-3" />
                <div>
                  <p className="font-bold">Error</p>
                  <p>{error}</p>
                </div>
              </div>
            </div>
          ) : filteredProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map(project => (
                <ProjectCard key={project._id} project={project} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 px-6 bg-white rounded-lg shadow-sm">
              <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-lg font-medium text-gray-900">No projects found</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new project.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProjectManagementPage;