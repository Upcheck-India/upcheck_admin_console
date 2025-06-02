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
  Archive,
  Edit,
  Trash2,
  Eye,
  BarChart2
} from 'lucide-react';
import RecruitmentNav from '../components/RecruitmentNav';

export default function TestsPage() {
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
        // Fallback to empty array if API fails
        setTests([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTests();
  }, []);

  // Filter and search tests
  const filteredTests = tests.filter(test => {
    const matchesSearch = test.title?.toLowerCase().includes(searchQuery.toLowerCase());
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
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'archived':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch(status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'draft':
        return <Clock className="h-4 w-4 text-gray-600" />;
      case 'archived':
        return <Archive className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <RecruitmentNav />
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <RecruitmentNav />
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tests</h1>
          <p className="text-gray-600 mt-1">Manage your recruitment tests</p>
        </div>
        <Link href="/recruitment/create" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center">
          <Plus className="h-5 w-5 mr-1" />
          Create Test
        </Link>
      </div>
      
      {/* Search and filters */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search tests..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Tests list */}
      {filteredTests.length > 0 ? (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Test</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidates</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTests.map((test) => (
                  <tr key={test.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-blue-100 rounded-lg">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{test.title || 'Untitled Test'}</div>
                          <div className="text-sm text-gray-500">{test.description ? `${test.description.substring(0, 60)}${test.description.length > 60 ? '...' : ''}` : 'No description'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(test.status)}`}>
                        {getStatusIcon(test.status)}
                        <span className="ml-1 capitalize">{test.status || 'Unknown'}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 text-gray-500 mr-1" />
                          <span>{test.candidates?.length || 0}</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {test.submissions ? `${test.submissions} submissions` : '0 submissions'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(test.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(test.dueDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Link href={`/recruitment/tests/${test.id}`} className="text-blue-600 hover:text-blue-900">
                          <Eye className="h-5 w-5" />
                        </Link>
                        <Link href={`/recruitment/tests/${test.id}/evaluate`} className="text-green-600 hover:text-green-900">
                          <BarChart2 className="h-5 w-5" />
                        </Link>
                        <Link href={`/recruitment/tests/${test.id}?edit=true`} className="text-yellow-600 hover:text-yellow-900">
                          <Edit className="h-5 w-5" />
                        </Link>
                        <button className="text-red-600 hover:text-red-900">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No tests found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || filter !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first test'}
          </p>
          {!searchQuery && filter === 'all' && (
            <Link href="/recruitment/create" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              <Plus className="-ml-1 mr-2 h-5 w-5" />
              Create Test
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
