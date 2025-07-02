'use client';

import React, { useState, useMemo } from 'react';
import { 
  Mail, Inbox, Send, Star, Trash2, File, Search, ChevronDown, MoreVertical, 
  Archive, Tag, Filter, RefreshCw, Settings, Plus, X, Check, AlertCircle,
  Clock, Paperclip, Flag, Users, Calendar
} from 'lucide-react';

const MailPage = () => {
  const [selectedMails, setSelectedMails] = useState([]);
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [filterBy, setFilterBy] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Enhanced mock data for emails
  const emails = [
    {
      id: 1,
      from: 'john.doe@example.com',
      fromName: 'John Doe',
      subject: 'Weekly Team Update - Q3 Progress Report',
      preview: 'Here are the updates from the team for this week. We\'ve made significant progress on the new features and fixed several critical bugs...',
      body: 'Hi Team,\n\nHere are the updates from the team for this week. We\'ve made significant progress on the new features and fixed several critical bugs. Please review the attached documents.\n\nBest regards,\nJohn',
      time: '10:30 AM',
      date: new Date('2025-07-01T10:30:00'),
      read: false,
      starred: true,
      folder: 'inbox',
      hasAttachment: true,
      priority: 'high',
      labels: ['work', 'team'],
      avatar: 'JD'
    },
    {
      id: 2,
      from: 'support@upcheck.com',
      fromName: 'UpCheck Support',
      subject: 'Your subscription is active - Welcome to Premium!',
      preview: 'Thank you for subscribing to our premium plan. You now have access to advanced features including real-time alerts...',
      body: 'Dear Customer,\n\nThank you for subscribing to our premium plan. You now have access to advanced features including real-time alerts, custom dashboards, and priority support.\n\nEnjoy your premium experience!\n\nThe UpCheck Team',
      time: 'Yesterday',
      date: new Date('2025-06-30T14:20:00'),
      read: true,
      starred: false,
      folder: 'inbox',
      hasAttachment: false,
      priority: 'normal',
      labels: ['billing'],
      avatar: 'US'
    },
    {
      id: 3,
      from: 'notifications@github.com',
      fromName: 'GitHub',
      subject: 'Pull Request: Update README.md - Review Required',
      preview: 'A new pull request has been opened in your repository "awesome-project". The changes include documentation updates...',
      body: 'A new pull request has been opened in your repository "awesome-project". The changes include documentation updates and bug fixes. Please review when you have a moment.\n\nView Pull Request: https://github.com/...',
      time: 'Jul 1',
      date: new Date('2025-07-01T09:15:00'),
      read: true,
      starred: false,
      folder: 'inbox',
      hasAttachment: false,
      priority: 'normal',
      labels: ['github', 'development'],
      avatar: 'GH'
    },
    {
      id: 4,
      from: 'sarah.wilson@company.com',
      fromName: 'Sarah Wilson',
      subject: 'Meeting Reschedule - Project Kickoff',
      preview: 'Hi! I need to reschedule our project kickoff meeting due to a client emergency. Are you available tomorrow at 2 PM instead?',
      body: 'Hi there!\n\nI need to reschedule our project kickoff meeting due to a client emergency. Are you available tomorrow at 2 PM instead? The meeting room is still booked.\n\nLet me know!\nSarah',
      time: '2 hours ago',
      date: new Date('2025-07-01T08:30:00'),
      read: false,
      starred: true,
      folder: 'inbox',
      hasAttachment: false,
      priority: 'high',
      labels: ['meetings', 'urgent'],
      avatar: 'SW'
    },
    {
      id: 5,
      from: 'newsletter@techcrunch.com',
      fromName: 'TechCrunch',
      subject: 'Daily Crunch: AI breakthrough in healthcare',
      preview: 'Today\'s top stories include a major AI breakthrough in healthcare diagnostics, new funding rounds, and startup acquisitions...',
      body: 'Today\'s top stories include a major AI breakthrough in healthcare diagnostics, new funding rounds, and startup acquisitions. Read more about the latest tech news.',
      time: '1 day ago',
      date: new Date('2025-06-30T06:00:00'),
      read: true,
      starred: false,
      folder: 'inbox',
      hasAttachment: false,
      priority: 'low',
      labels: ['newsletter', 'tech'],
      avatar: 'TC'
    }
  ];

  const folders = [
    { id: 'inbox', name: 'Inbox', icon: Inbox, count: emails.filter(e => e.folder === 'inbox').length },
    { id: 'starred', name: 'Starred', icon: Star, count: emails.filter(e => e.starred).length },
    { id: 'sent', name: 'Sent', icon: Send, count: 0 },
    { id: 'drafts', name: 'Drafts', icon: File, count: 0 },
    { id: 'archive', name: 'Archive', icon: Archive, count: 0 },
    { id: 'trash', name: 'Trash', icon: Trash2, count: 0 }
  ];

  const priorityColors = {
    high: 'text-red-600',
    normal: 'text-gray-600',
    low: 'text-green-600'
  };

  const filteredAndSortedEmails = useMemo(() => {
    let filtered = emails.filter(email => {
      // Folder filter
      const folderMatch = activeFolder === 'inbox' || 
        (activeFolder === 'starred' && email.starred) ||
        email.folder === activeFolder;
      
      // Search filter
      const searchMatch = searchTerm === '' || 
        email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.fromName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.preview.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Priority filter
      const priorityMatch = filterBy === 'all' || 
        (filterBy === 'unread' && !email.read) ||
        (filterBy === 'starred' && email.starred) ||
        (filterBy === 'attachments' && email.hasAttachment) ||
        (filterBy === 'priority' && email.priority === 'high');

      return folderMatch && searchMatch && priorityMatch;
    });

    // Sort emails
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.date.getTime() - a.date.getTime();
        case 'oldest':
          return a.date.getTime() - b.date.getTime();
        case 'sender':
          return a.fromName.localeCompare(b.fromName);
        case 'subject':
          return a.subject.localeCompare(b.subject);
        default:
          return b.date.getTime() - a.date.getTime();
      }
    });

    return filtered;
  }, [emails, activeFolder, searchTerm, filterBy, sortBy]);

  const toggleSelectMail = (id) => {
    setSelectedMails(prev => 
      prev.includes(id) 
        ? prev.filter(mailId => mailId !== id)
        : [...prev, id]
    );
  };

  const selectAllMails = () => {
    if (selectedMails.length === filteredAndSortedEmails.length) {
      setSelectedMails([]);
    } else {
      setSelectedMails(filteredAndSortedEmails.map(email => email.id));
    }
  };

  const handleCompose = () => {
    setShowCompose(true);
    setComposeData({ to: '', subject: '', body: '' });
  };

  const handleSendEmail = () => {
    // Mock send functionality
    console.log('Sending email:', composeData);
    setShowCompose(false);
    setComposeData({ to: '', subject: '', body: '' });
  };

  const formatDate = (date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    
    if (hours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (hours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Mail</h1>
          <button 
            onClick={handleCompose}
            className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Compose
          </button>
        </div>
        
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {folders.map((folder) => {
              const Icon = folder.icon;
              return (
                <li key={folder.id}>
                  <button 
                    onClick={() => setActiveFolder(folder.id)}
                    className={`flex items-center w-full px-3 py-2.5 text-left rounded-lg transition-colors ${
                      activeFolder === folder.id 
                        ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    <span className="flex-1">{folder.name}</span>
                    {folder.count > 0 && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        activeFolder === folder.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {folder.count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button className="flex items-center w-full px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">
            <Settings className="w-5 h-5 mr-3" />
            Settings
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white"
                placeholder="Search mail..."
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter className="h-5 w-5 text-gray-500" />
            </button>
            <button className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <RefreshCw className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Filter:</label>
                <select 
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="all">All</option>
                  <option value="unread">Unread</option>
                  <option value="starred">Starred</option>
                  <option value="attachments">With Attachments</option>
                  <option value="priority">High Priority</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Sort:</label>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="sender">Sender</option>
                  <option value="subject">Subject</option>
                </select>
              </div>
            </div>
          )}

          {/* Bulk Actions */}
          {selectedMails.length > 0 && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-sm text-blue-700 font-medium">
                {selectedMails.length} selected
              </span>
              <div className="flex items-center gap-1 ml-auto">
                <button className="p-1.5 text-blue-600 hover:bg-blue-100 rounded">
                  <Archive className="w-4 h-4" />
                </button>
                <button className="p-1.5 text-blue-600 hover:bg-blue-100 rounded">
                  <Star className="w-4 h-4" />
                </button>
                <button className="p-1.5 text-blue-600 hover:bg-blue-100 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setSelectedMails([])}
                  className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Email List */}
        <div className="flex-1 overflow-y-auto">
          {filteredAndSortedEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Mail className="h-16 w-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium">No messages found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div>
              {/* Select All Header */}
              <div className="flex items-center px-4 py-3 border-b border-gray-200 bg-gray-50">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={selectedMails.length === filteredAndSortedEmails.length}
                  onChange={selectAllMails}
                />
                <span className="ml-3 text-sm text-gray-600">
                  {filteredAndSortedEmails.length} conversations
                </span>
              </div>

              {/* Email Items */}
              <ul className="divide-y divide-gray-200">
                {filteredAndSortedEmails.map((email) => (
                  <li 
                    key={email.id} 
                    className={`px-4 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !email.read ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-white'
                    } ${selectedMails.includes(email.id) ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedEmail(email)}
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                        checked={selectedMails.includes(email.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelectMail(email.id);
                        }}
                      />
                      
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-700">
                        {email.avatar}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-medium truncate ${
                              !email.read ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {email.fromName}
                            </p>
                            {email.priority === 'high' && (
                              <Flag className="w-4 h-4 text-red-500" />
                            )}
                            {email.hasAttachment && (
                              <Paperclip className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{formatDate(email.date)}</span>
                            <button 
                              className="text-gray-400 hover:text-yellow-500 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Toggle star functionality
                              }}
                            >
                              <Star className={`h-4 w-4 ${email.starred ? 'text-yellow-500 fill-current' : ''}`} />
                            </button>
                          </div>
                        </div>
                        
                        <p className={`text-sm mb-1 ${!email.read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                          {email.subject}
                        </p>
                        
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {email.preview}
                        </p>

                        {email.labels.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {email.labels.map((label) => (
                              <span 
                                key={label}
                                className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">New Message</h2>
              <button 
                onClick={() => setShowCompose(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 flex flex-col p-4 space-y-4">
              <div>
                <input
                  type="email"
                  placeholder="To"
                  value={composeData.to}
                  onChange={(e) => setComposeData(prev => ({ ...prev, to: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <input
                  type="text"
                  placeholder="Subject"
                  value={composeData.subject}
                  onChange={(e) => setComposeData(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex-1">
                <textarea
                  placeholder="Write your message..."
                  value={composeData.body}
                  onChange={(e) => setComposeData(prev => ({ ...prev, body: e.target.value }))}
                  className="w-full h-full min-h-[200px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-400 hover:text-gray-600 rounded">
                  <Paperclip className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowCompose(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSendEmail}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Detail Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-700">
                  {selectedEmail.avatar}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedEmail.subject}</h2>
                  <p className="text-sm text-gray-600">{selectedEmail.fromName} &lt;{selectedEmail.from}&gt;</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedEmail(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">
                  {selectedEmail.body}
                </pre>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md">
                  <Star className={`w-4 h-4 ${selectedEmail.starred ? 'fill-current' : ''}`} />
                  {selectedEmail.starred ? 'Unstar' : 'Star'}
                </button>
                <button className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md">
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50">
                  Reply
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  Forward
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MailPage;