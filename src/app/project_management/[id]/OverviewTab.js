import React, { useState, useEffect } from 'react';
import { FileText, Activity, Save, Edit2, Loader2, ListChecks } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';

const OverviewTab = ({ project, projectId, onProjectUpdate }) => {
  const { user } = useAuth();
  const [isEditingReadme, setIsEditingReadme] = useState(false);
  const [readmeText, setReadmeText] = useState(project.readme || '');
  const [isSaving, setIsSaving] = useState(false);
  const [recentTasks, setRecentTasks] = useState([]);
  const [taskStats, setTaskStats] = useState({ total: 0, byStatus: {} });
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Announcements state
  const [announcements, setAnnouncements] = useState(project.announcements || []);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('');
  const [newAnnouncementBody, setNewAnnouncementBody] = useState('');
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);

  const isManager = user?.role === 'Admin' || user?.role === 'Console admin' ||
    project.superManager === user?.username ||
    project.members?.find(m => m.user === user?.username)?.role === 'Project Manager';

  // Fetch tasks to generate stats and recent activity
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/projects/${projectId}/tasks`, {
          headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          const tasks = Array.isArray(data) ? data : (data.tasks || []);
          
          // Generate stats
          const stats = { total: tasks.length, byStatus: {} };
          tasks.forEach(t => {
            stats.byStatus[t.status] = (stats.byStatus[t.status] || 0) + 1;
          });
          setTaskStats(stats);

          // Get recent activity (sort by updatedAt or createdAt desc)
          const sorted = [...tasks].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
          setRecentTasks(sorted.slice(0, 5));
        }
      } catch (err) {
        console.error('Error fetching tasks for overview:', err);
      } finally {
        setLoadingTasks(false);
      }
    };
    
    fetchTasks();
  }, [projectId]);

  const handlePostAnnouncement = async () => {
    if (!newAnnouncementTitle.trim()) return;
    setIsPostingAnnouncement(true);
    const newAnn = {
      id: Date.now().toString(),
      title: newAnnouncementTitle,
      body: newAnnouncementBody,
      authorName: user?.username || 'Unknown',
      createdAt: new Date().toISOString(),
      reactions: {}
    };
    const updated = [newAnn, ...announcements];
    setAnnouncements(updated);
    const token = localStorage.getItem('token');
    await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      credentials: 'include',
      body: JSON.stringify({ announcements: updated })
    });
    setNewAnnouncementTitle('');
    setNewAnnouncementBody('');
    setShowAnnouncementForm(false);
    setIsPostingAnnouncement(false);
  };

  const handleReact = async (annId, emoji) => {
    const userId = user?._id || user?.id || 'unknown';
    const updated = announcements.map(ann => {
      if (ann.id !== annId) return ann;
      const existing = ann.reactions?.[emoji] || [];
      const hasReacted = existing.includes(userId);
      return {
        ...ann,
        reactions: {
          ...ann.reactions,
          [emoji]: hasReacted ? existing.filter(id => id !== userId) : [...existing, userId]
        }
      };
    });
    setAnnouncements(updated);
    const token = localStorage.getItem('token');
    await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      credentials: 'include',
      body: JSON.stringify({ announcements: updated })
    });
  };

  const handleSaveReadme = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ readme: readmeText })
      });
      
      if (res.ok) {
        const updatedProject = await res.json();
        onProjectUpdate(updatedProject);
        setIsEditingReadme(false);
      } else {
        throw new Error('Failed to save README');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const statusColors = {
    'Backlog': 'bg-gray-100 text-gray-800 border-gray-200',
    'To Do': 'bg-blue-50 text-blue-800 border-blue-200',
    'In Progress': 'bg-amber-50 text-amber-800 border-amber-200',
    'Done': 'bg-emerald-50 text-emerald-800 border-emerald-200'
  };

  return (
    <>
    {/* Announcements Section */}
    {(announcements.length > 0 || isManager) && (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800 flex items-center">
            <span className="mr-2">📌</span> Team Announcements
          </h3>
          {isManager && (
            <button onClick={() => setShowAnnouncementForm(f => !f)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              {showAnnouncementForm ? 'Cancel' : '+ Post Announcement'}
            </button>
          )}
        </div>

        {showAnnouncementForm && (
          <div className="bg-white border border-blue-200 rounded-xl p-4 mb-4 shadow-sm">
            <input value={newAnnouncementTitle} onChange={e => setNewAnnouncementTitle(e.target.value)}
              placeholder="Announcement title..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            <textarea value={newAnnouncementBody} onChange={e => setNewAnnouncementBody(e.target.value)}
              placeholder="Announcement body (optional)..." rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mb-2" />
            <button onClick={handlePostAnnouncement} disabled={isPostingAnnouncement || !newAnnouncementTitle.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {isPostingAnnouncement ? 'Posting...' : 'Post Announcement'}
            </button>
          </div>
        )}

        {announcements.length === 0 && (
          <p className="text-sm text-gray-500 italic">No announcements yet.</p>
        )}

        <div className="space-y-3">
          {announcements.map(ann => (
            <div key={ann.id} className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-1">{ann.title}</h4>
                  {ann.body && <p className="text-sm text-gray-700 mb-2 whitespace-pre-wrap">{ann.body}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex gap-2">
                  {['👍', '🎉', '💯'].map(emoji => (
                    <button key={emoji} onClick={() => handleReact(ann.id, emoji)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                        (ann.reactions?.[emoji] || []).includes(user?._id || user?.id || '')
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                      }`}>
                      {emoji} <span>{(ann.reactions?.[emoji] || []).length || ''}</span>
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-500">
                  {ann.authorName} · {new Date(ann.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content (README) */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-bold text-gray-800 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              Project README
            </h3>
            {isEditingReadme ? (
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsEditingReadme(false)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveReadme}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                  Save
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsEditingReadme(true)}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center"
              >
                <Edit2 className="w-4 h-4 mr-1.5" />
                Edit
              </button>
            )}
          </div>
          
          <div className="p-5 flex-1 flex flex-col bg-white">
            {isEditingReadme ? (
              <textarea
                value={readmeText}
                onChange={(e) => setReadmeText(e.target.value)}
                placeholder="Write an introduction or description for this project..."
                className="w-full flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none font-sans text-gray-700 leading-relaxed min-h-[300px]"
              />
            ) : (
              <div className="prose prose-sm md:prose-base max-w-none text-gray-700">
                {project.readme ? (
                  <div className="whitespace-pre-wrap">{project.readme}</div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <FileText className="w-12 h-12 mb-3 opacity-20" />
                    <p>No README provided yet.</p>
                    <button 
                      onClick={() => setIsEditingReadme(true)}
                      className="mt-2 text-sm text-blue-600 hover:underline"
                    >
                      Click here to add one
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar (Stats & Activity) */}
      <div className="space-y-6">
        {/* Task Breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-bold text-gray-800 flex items-center">
              <ListChecks className="w-5 h-5 mr-2 text-teal-600" />
              Task Breakdown
            </h3>
          </div>
          <div className="p-4">
            {loadingTasks ? (
              <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                  <span className="text-gray-500 font-medium text-sm">Total Tasks</span>
                  <span className="font-bold text-gray-800">{taskStats.total}</span>
                </div>
                {['Backlog', 'To Do', 'In Progress', 'Done'].map(status => {
                  const count = taskStats.byStatus[status] || 0;
                  const percentage = taskStats.total > 0 ? Math.round((count / taskStats.total) * 100) : 0;
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">{status}</span>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-1.5 rounded-full ${status === 'Done' ? 'bg-emerald-500' : status === 'In Progress' ? 'bg-amber-500' : status === 'To Do' ? 'bg-blue-500' : 'bg-gray-400'}`} 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-bold text-gray-800 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-amber-600" />
              Recently Updated Tasks
            </h3>
          </div>
          <div className="p-0">
            {loadingTasks ? (
              <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : recentTasks.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {recentTasks.map(task => (
                  <li key={task._id} className="p-4 hover:bg-gray-50 transition-colors">
                    <p className="text-sm font-medium text-gray-800 line-clamp-1">{task.title}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${statusColors[task.status] || 'bg-gray-100 text-gray-600'}`}>
                        {task.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(task.updatedAt || task.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-6 text-center text-sm text-gray-500">
                No tasks found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default OverviewTab;
