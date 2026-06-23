'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Briefcase, ArrowLeft, Loader2, AlertTriangle, ListChecks, Users, Settings, StickyNote, Github, BarChart3, Trophy, X, MessageSquare, Pin } from 'lucide-react';
import IdeaCanvas from './IdeaCanvas';
import { useAuth } from '../../../hooks/useAuth';
import SettingsTab from './SettingsTab';
import MembersTab from './MembersTab';
import TasksTab from './TasksTab';
import GitHubTab from './GitHubTab';
import OverviewTab from './OverviewTab';
import useOnlineUsers from '../../../hooks/useOnlineUsers';
import AvatarWithStatus from '../../../components/AvatarWithStatus';
import LeaderboardTab from './LeaderboardTab';
import ProjectChat from './ProjectChat';

const ProjectDetailPage = () => {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?._id || user?.id;

  console.log('ProjectDetailPage State:', { id, userId, authLoading, hasUser: !!user });

  const [project, setProject] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks'); // overview, tasks, members, github, canvas, settings, messages
  const onlineUsers = useOnlineUsers();
  const [showOnlinePopover, setShowOnlinePopover] = useState(false);

  // Sync active tab with localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('active_tab_' + id);
      if (stored) {
        setActiveTab(stored);
      }
    }
  }, [id]);

  useEffect(() => {
    const handleTabChangeMessage = (e) => {
      if (e.detail?.projectId === id) {
        setActiveTab('messages');
      }
    };
    window.addEventListener('tab-change-messages', handleTabChangeMessage);
    return () => window.removeEventListener('tab-change-messages', handleTabChangeMessage);
  }, [id]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_tab_' + id, tab);
    }
  };

  const projectMemberUsernames = React.useMemo(() => {
    if (!project) return new Set();
    const usernames = new Set();
    if (project.superManager) usernames.add(project.superManager);
    
    // Direct members
    project.members?.forEach(m => {
      if (m.user) usernames.add(m.user);
      if (m.username) usernames.add(m.username);
    });
    
    // Team members
    project.permissionSettings?.allowedTeamsDetails?.forEach(team => {
      if (team.lead?.username) usernames.add(team.lead.username);
      team.members?.forEach(m => {
        if (m.username) usernames.add(m.username);
      });
    });
    
    return usernames;
  }, [project]);

  const projectOnlineUsers = React.useMemo(() => {
    return onlineUsers.filter(u => projectMemberUsernames.has(u.username));
  }, [onlineUsers, projectMemberUsernames]);

  const userTeams = React.useMemo(() => {
    if (!user || !allTeams) return [];
    const currentUserId = user._id || user.id;
    return allTeams.filter(team => {
      const leadId = team.lead?._id || team.lead?.id || team.lead;
      return leadId === currentUserId || 
        team.members?.some(m => (m._id || m.id || m) === currentUserId);
    }).map(t => t._id);
  }, [allTeams, user]);

  const fetchData = async () => {
    if (!user) {
      console.log('fetchData aborted: no user');
      return;
    }
    console.log('fetchData started. userId:', userId, 'projectId:', id);
    setLoading(true);
    setError(null);
    try {
      const headers = {
        'x-user-role': user.role || '',
        'x-user-id': userId || ''
      };

      console.log('fetchData: calling Promise.all with headers:', headers);
      const [projectRes, usersRes, teamsRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch('/api/users?limit=500', { headers }),
        fetch('/api/teams?limit=500', { headers })
      ]);

      console.log('fetchData responses received:', {
        projectOk: projectRes.ok,
        usersOk: usersRes.ok,
        teamsOk: teamsRes.ok
      });

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
    if (id && userId) {
        fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId]);

  console.log('ProjectDetailPage render checks:', {
    loading,
    hasProject: !!project,
    authLoading,
    spinnerCondition: (loading && !project) || authLoading
  });

  if ((loading && !project) || authLoading) {
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab project={project} projectId={id} onProjectUpdate={setProject} />;
      case 'tasks':
        return <TasksTab projectId={project._id} project={project} allUsers={allUsers} allTeams={allTeams} userTeams={userTeams} />;
      case 'messages':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <ProjectChat
                projectId={id}
                project={project}
                allUsers={allUsers}
                allTeams={allTeams}
                isSidebar={false}
              />
            </div>
            <div className="hidden lg:flex flex-col gap-6">
              <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs">
                <h4 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-1.5 border-b pb-2">
                  <Pin className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span>Project Pins</span>
                </h4>
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Pinned messages can be found by clicking the <strong>Pinned Only</strong> filter button in the chat header.
                  </p>
                  <div className="bg-amber-50 border border-amber-155 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed">
                    📌 Pin important milestones, specifications, or rules here for everyone to see.
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-155 p-5 shadow-xs flex flex-col gap-4">
                <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5 border-b pb-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span>Chat Audience</span>
                </h4>
                <div className="space-y-3 max-h-[260px] overflow-y-auto">
                  {project.members?.map(m => (
                    <div key={m.user} className="flex items-center gap-2.5">
                      <AvatarWithStatus username={m.user} online={false} className="h-7 w-7 text-xs" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-700">@{m.user}</span>
                        <span className="text-[10px] text-gray-400">{m.role || 'Member'}</span>
                      </div>
                    </div>
                  ))}
                  {project.superManager && (
                    <div className="flex items-center gap-2.5">
                      <AvatarWithStatus username={project.superManager} online={false} className="h-7 w-7 text-xs" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-700">@{project.superManager}</span>
                        <span className="text-[10px] text-gray-400">Super Manager</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      case 'members':
        return (
          <MembersTab
            members={project.members}
            superManager={project.superManager}
            project={project}
            allTeams={allTeams}
            allUsers={allUsers}
            currentUser={user}
          />
        );
      case 'github':
        return showGithubTab ? <GitHubTab project={project} projectId={id} /> : null;
      case 'settings':
        return <SettingsTab project={project} user={user} allUsers={allUsers} userTeams={userTeams} onProjectUpdate={fetchData} />;
      case 'canvas':
        return <IdeaCanvas project={project} userTeams={userTeams} />;
      case 'leaderboard':
        return <LeaderboardTab project={project} projectId={id} />;
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
              {project.logo && (project.logo.startsWith('/') || project.logo.startsWith('http://') || project.logo.startsWith('https://') || project.logo.startsWith('data:')) ? (
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

            {/* Online Members Indicator */}
            <div>
              <button 
                onClick={() => setShowOnlinePopover(true)}
                className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 self-start md:self-center shadow-sm hover:bg-white/20 transition-all cursor-pointer outline-none"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs font-semibold text-white mr-1.5">Online:</span>
                <div className="flex -space-x-2 overflow-hidden">
                  {projectOnlineUsers.length === 0 ? (
                    <span className="text-xs text-white/60 italic px-1">None online</span>
                  ) : (
                    <>
                      {projectOnlineUsers.slice(0, 4).map((u) => (
                        <div key={u.username} title={`${u.username} (Online)`}>
                          <AvatarWithStatus
                            username={u.username}
                            online={true}
                            className="h-7 w-7 text-xs ring-2 ring-blue-500/50"
                          />
                        </div>
                      ))}
                      {projectOnlineUsers.length > 4 && (
                        <div className="h-7 w-7 rounded-full bg-white/20 backdrop-blur-sm border border-white/20 flex items-center justify-center text-xs font-bold text-white z-10" title={`${projectOnlineUsers.length - 4} more online`}>
                          +{projectOnlineUsers.length - 4}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </button>
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
                onClick={() => handleTabChange('overview')} 
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'overview' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <BarChart3 className="h-4 w-4 mr-2" /> Overview
              </button>
              <button 
                onClick={() => handleTabChange('tasks')} 
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'tasks' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <ListChecks className="h-4 w-4 mr-2" /> Tasks
              </button>
              <button 
                onClick={() => handleTabChange('members')} 
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'members' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Users className="h-4 w-4 mr-2" /> Members
              </button>
              
              <button 
                onClick={() => handleTabChange('messages')} 
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'messages' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <MessageSquare className="h-4 w-4 mr-2" /> Messages
              </button>
              
              {showGithubTab && (
                <button 
                  onClick={() => handleTabChange('github')} 
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    activeTab === 'github' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Github className="h-4 w-4 mr-2" /> GitHub
                </button>
              )}

              {project.settings?.enableIdeaCanvas !== false && (
                <button 
                  onClick={() => handleTabChange('canvas')} 
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    activeTab === 'canvas' ? 'bg-white text-yellow-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <StickyNote className="h-4 w-4 mr-2" /> Canvas
                </button>
              )}
              
              <button 
                onClick={() => handleTabChange('leaderboard')} 
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'leaderboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Trophy className="h-4 w-4 mr-2" /> Leaderboard
              </button>
              
              <button 
                onClick={() => handleTabChange('settings')} 
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'settings' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Settings className="h-4 w-4 mr-2" /> Settings
              </button>
            </div>
          </div>
          
          <div className="p-2 md:p-6 bg-white min-h-[500px]">
            {renderTabContent()}
          </div>
         </div>
      </div>

      {/* Online Members Modal - Rendered at root to prevent layout/z-index clipping */}
      {showOnlinePopover && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden border border-gray-150 animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="font-bold text-gray-900 text-sm md:text-base flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Online Teammates ({projectOnlineUsers.length})
                </h3>
              </div>
              <button 
                onClick={() => setShowOnlinePopover(false)} 
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100 transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-3.5 max-h-60 overflow-y-auto">
              {projectOnlineUsers.length === 0 ? (
                <div className="py-6 text-center text-gray-500 text-sm">
                  No teammates are currently online.
                </div>
              ) : (
                projectOnlineUsers.map((u) => (
                  <div key={u.username} className="flex items-center space-x-3 text-left">
                    <AvatarWithStatus
                      username={u.username}
                      online={true}
                      className="h-8 w-8 text-xs"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">@{u.username}</p>
                      <p className="text-[10px] text-gray-400 font-medium">Active in project</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowOnlinePopover(false)}
                className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors"
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

export default ProjectDetailPage;
