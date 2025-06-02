'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  FileText, 
  Users, 
  Settings, 
  ChevronRight, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Search,
  BarChart2,
  Calendar
} from 'lucide-react';
import RecruitmentNav from './components/RecruitmentNav';

export default function RecruitmentDashboard() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');

  // Fetch tests from MongoDB API
  useEffect(() => {
    const fetchTests = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/recruitment/tests');
        
        if (!response.ok) {
          throw new Error('Failed to fetch tests');
        }
        
        const data = await response.json();
        setTests(data);
      } catch (error) {
        console.error('Error fetching tests:', error);
        // Fallback to mock data if API fails
        const mockTests = [
          {
            id: '1',
            title: 'Frontend Developer Assessment',
            status: 'completed',
            candidates: 18,
            submissions: 15,
            createdAt: '2025-05-15T09:15:00Z',
            dueDate: '2025-05-31T23:59:59Z',
          },
          {
            id: '4',
            title: 'DevOps Engineer Assessment',
            status: 'active',
            candidates: 7,
            submissions: 3,
            createdAt: '2025-05-29T16:45:00Z',
            dueDate: '2025-06-20T23:59:59Z',
          },
          {
            id: '5',
            title: 'Data Science Technical Challenge',
            status: 'draft',
            candidates: 0,
            submissions: 0,
            createdAt: '2025-06-01T11:20:00Z',
            dueDate: null,
          }
        ];
        
        setTests(mockTests);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTests();
  }, []);

  // Filter and search tests
  const filteredTests = tests.filter(test => {
    const matchesSearch = test.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || test.status === filter;
    return matchesSearch && matchesFilter;
  });

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Get status badge styling
  const getStatusBadge = (status) => {
    switch(status) {
      case 'active':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
            Active
          </span>
        );
      case 'draft':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
            Draft
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
            Completed
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <RecruitmentNav />
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recruitment Tests</h1>
          <p className="text-gray-600 mt-1">Create and manage recruitment assessments</p>
        </div>
        <Link 
          href="/recruitment/create" 
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} className="mr-1" />
          Create New Test
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Tests</p>
              <p className="text-3xl font-bold mt-1">{tests.length}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-full">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              {tests.filter(t => t.status === 'active').length} active tests
            </p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Candidates</p>
              <p className="text-3xl font-bold mt-1">
                {tests.reduce((sum, test) => sum + (Array.isArray(test.candidates) ? test.candidates.length : 0), 0)}
              </p>
            </div>
            <div className="p-2 bg-green-100 rounded-full">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              Across all tests
            </p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Completion Rate</p>
              <p className="text-3xl font-bold mt-1">
                {tests.reduce((sum, test) => sum + (Array.isArray(test.candidates) ? test.candidates.length : 0), 0) > 0 
                  ? Math.round((tests.reduce((sum, test) => sum + (test.submissions || 0), 0) / tests.reduce((sum, test) => sum + (Array.isArray(test.candidates) ? test.candidates.length : 0), 0)) * 100)
                  : 0}%
              </p>
            </div>
            <div className="p-2 bg-purple-100 rounded-full">
              <BarChart2 className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              {tests.reduce((sum, test) => sum + (test.submissions || 0), 0)} submissions
            </p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Upcoming Due</p>
              <p className="text-3xl font-bold mt-1">
                {tests.filter(t => t.status === 'active' && t.dueDate).length}
              </p>
            </div>
            <div className="p-2 bg-yellow-100 rounded-full">
              <Calendar className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              Tests with upcoming deadlines
            </p>
          </div>
        </div>
      </div>
      
      {/* Search and filter */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search tests..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex space-x-2">
          <button 
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded-md ${filter === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
          >
            All
          </button>
          <button 
            onClick={() => setFilter('active')}
            className={`px-3 py-1 text-sm rounded-md ${filter === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
          >
            Active
          </button>
          <button 
            onClick={() => setFilter('draft')}
            className={`px-3 py-1 text-sm rounded-md ${filter === 'draft' ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-800'}`}
          >
            Draft
          </button>
          <button 
            onClick={() => setFilter('completed')}
            className={`px-3 py-1 text-sm rounded-md ${filter === 'completed' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Tests list */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="p-8 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No tests found</h3>
            <p className="text-gray-500 mt-1">
              {searchQuery ? 'Try a different search term' : 'Create your first test to get started'}
            </p>
            {!searchQuery && (
              <Link 
                href="/recruitment/create" 
                className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={18} className="mr-1" />
                Create New Test
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Test Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Candidates
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTests.map((test) => (
                  <tr key={test.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{test.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(test.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Users size={16} className="text-gray-400 mr-1" />
                        <span className="text-sm text-gray-900">{Array.isArray(test.candidates) ? test.candidates.length : 0}</span>
                        <span className="mx-1 text-gray-500">/</span>
                        <CheckCircle size={16} className="text-green-500 mr-1" />
                        <span className="text-sm text-gray-900">{test.submissions || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{formatDate(test.createdAt)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Clock size={16} className="text-gray-400 mr-1" />
                        <div className="text-sm text-gray-500">{formatDate(test.dueDate)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link 
                        href={`/recruitment/tests/${test.id}`}
                        className="text-blue-600 hover:text-blue-900 flex items-center justify-end"
                      >
                        View Details
                        <ChevronRight size={16} className="ml-1" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 mr-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Active Tests</div>
              <div className="text-2xl font-semibold">{tests.filter(t => t.status === 'active').length}</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 mr-4">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Total Candidates</div>
              <div className="text-2xl font-semibold">{tests.reduce((sum, test) => sum + (Array.isArray(test.candidates) ? test.candidates.length : 0), 0)}</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 mr-4">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Submissions</div>
              <div className="text-2xl font-semibold">{tests.reduce((sum, test) => sum + (test.submissions || 0), 0)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
