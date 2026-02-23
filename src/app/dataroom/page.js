'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DataRoomNav from '../components/dataroom/DataRoomNav';
import { 
  Folder, 
  FileText, 
  Users, 
  Shield, 
  Activity, 
  Settings,
  Plus,
  Search,
  Grid,
  List,
  Clock,
  Star,
  Share2,
  Filter
} from 'lucide-react';

export default function DataRoomHome() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [loading, setLoading] = useState(true);
  const [sharedByMe, setSharedByMe] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [recentDocuments, setRecentDocuments] = useState([]);

  useEffect(() => {
    fetchUser();
    fetchRooms();
    fetchSharedDocuments();
    fetchRecentDocuments();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  }

  async function fetchRooms() {
    try {
      const response = await fetch('/api/dataroom/rooms');
      if (response.ok) {
        const data = await response.json();
        // API returns { items: [...] } not { rooms: [...] }
        let roomsList = data.items || data.rooms || [];
        
        // Apply sorting
        roomsList = roomsList.sort((a, b) => {
          switch (sortBy) {
            case 'name':
              return (a.name || '').localeCompare(b.name || '');
            case 'created':
              return new Date(b.createdAt) - new Date(a.createdAt);
            case 'modified':
              return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
            case 'size':
              return (b.totalSize || 0) - (a.totalSize || 0);
            default:
              return 0;
          }
        });
        
        setRooms(roomsList);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSharedDocuments() {
    try {
      // Fetch documents shared by me
      const byMeResponse = await fetch('/api/dataroom/documents?sharedByMe=true&limit=10');
      if (byMeResponse.ok) {
        const data = await byMeResponse.json();
        setSharedByMe(data.items || data.documents || []);
      }
      
      // Fetch documents shared with me
      const withMeResponse = await fetch('/api/dataroom/documents?sharedWithMe=true&limit=10');
      if (withMeResponse.ok) {
        const data = await withMeResponse.json();
        setSharedWithMe(data.items || data.documents || []);
      }
    } catch (error) {
      console.error('Failed to fetch shared documents:', error);
    }
  }

  async function fetchRecentDocuments() {
    try {
      const response = await fetch('/api/dataroom/documents?limit=6&sort=recent');
      if (response.ok) {
        const data = await response.json();
        setRecentDocuments(data.items || data.documents || []);
      }
    } catch (error) {
      console.error('Failed to fetch recent documents:', error);
    }
  }

  const quickStats = [
    { label: 'Active Rooms', value: rooms.length, icon: Folder, color: 'blue' },
    { label: 'Total Documents', value: recentDocuments.length, icon: FileText, color: 'green' },
    { label: 'Shared with Me', value: 0, icon: Share2, color: 'purple' },
    { label: 'Recent Activity', value: 0, icon: Activity, color: 'orange' },
  ];

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <DataRoomNav />
      <div className="flex-1 ml-64">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Data Room</h1>
                <p className="text-sm text-slate-500">Secure Document Management & VDR</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/dataroom/rooms/create')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Room</span>
              </button>
              <button
                onClick={() => router.push('/dataroom/settings')}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {quickStats.map((stat, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 bg-${stat.color}-100 rounded-lg flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Search Bar with Filters */}
        <div className="mb-8">
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rooms, documents, or users..."
              className="w-full pl-12 pr-12 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Filter className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          </div>
          {/* Filter Chips */}
          {searchQuery && (
            <div className="flex items-center space-x-2">
              {['all', 'rooms', 'documents', 'users'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSearchFilter(filter)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    searchFilter === filter
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Access Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick Access</h3>
            <div className="space-y-2">
              <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-slate-700">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Recent</span>
                </div>
                <span className="text-xs text-slate-500">{recentDocuments.length}</span>
              </button>
              <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-slate-700">
                <div className="flex items-center space-x-2">
                  <Share2 className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">Shared by Me</span>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{sharedByMe.length}</span>
              </button>
              <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-slate-700">
                <div className="flex items-center space-x-2">
                  <Share2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">Shared with Me</span>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{sharedWithMe.length}</span>
              </button>
              <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center space-x-2 text-slate-700">
                <Users className="w-4 h-4" />
                <span className="text-sm">My Teams</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-3">
            {/* Rooms Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">My Rooms</h2>
                <div className="flex items-center space-x-2">
                  {/* Sort Dropdown */}
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      fetchRooms();
                    }}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="name">Name</option>
                    <option value="created">Date Created</option>
                    <option value="modified">Last Modified</option>
                    <option value="size">Size</option>
                  </select>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-slate-600 mt-4">Loading rooms...</p>
                </div>
              ) : rooms.length === 0 ? (
                <div className="text-center py-12">
                  <Folder className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">No rooms yet</h3>
                  <p className="text-slate-500 mb-4">Create your first data room to get started</p>
                  <button
                    onClick={() => router.push('/dataroom/rooms/create')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Room</span>
                  </button>
                </div>
              ) : (
                <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'}>
                  {rooms.map((room) => (
                    <div
                      key={room._id}
                      onClick={() => router.push(`/dataroom/rooms/${room._id}`)}
                      className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer hover:border-blue-300"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Folder className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">{room.name}</h3>
                            <p className="text-xs text-slate-500">{room.type || 'General'}</p>
                          </div>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          Active
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">{room.description || 'No description'}</p>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{room.documentCount || 0} documents</span>
                        <span>{new Date(room.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
