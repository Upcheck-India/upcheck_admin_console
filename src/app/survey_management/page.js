'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ClipboardList, Trash2, Edit2, Plus, X, Search, 
  AlertCircle, Filter, Eye, Copy, Lock, Unlock,
  FolderPlus, FileText, ArrowLeft, ArrowRight
} from 'lucide-react';
import Link from 'next/link';

const SurveyManagement = () => {
  const router = useRouter();
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    category: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [surveysPerPage] = useState(10);
  const [selectedSurveys, setSelectedSurveys] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [surveyToDelete, setSurveyToDelete] = useState(null);

  // Categories for surveys
  const SURVEY_CATEGORIES = [
    'Agriculture',
    'Technology',
    'Consumer',
    'Healthcare',
    'Education',
    'Business',
    'General'
  ];

  // Status colors
  const STATUS_COLORS = {
    'draft': 'bg-gray-100 text-gray-800',
    'active': 'bg-green-100 text-green-800',
    'completed': 'bg-blue-100 text-blue-800',
    'archived': 'bg-amber-100 text-amber-800'
  };

  useEffect(() => {
    checkAuthAndFetchSurveys();
  }, []);

  const checkAuthAndFetchSurveys = async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('Session check failed');
      }

      const data = await response.json();
      
      if (!data.user || !data.user.role) {
        router.push('/login');
        return;
      }

      setCurrentUser(data.user);
      // Only allow admin roles to access this page
      if (data.user.role === 'Console admin' || data.user.role === 'Admin') {
        fetchSurveys(data.user.role);
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      router.push('/login');
    }
  };

  const fetchSurveys = async (userRole) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/surveys', {
        headers: {
          'x-user-role': userRole || currentUser?.role,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch surveys');
      }
      
      const data = await response.json();
      setSurveys(data);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSurvey = async (id) => {
    try {
      const response = await fetch(`/api/surveys/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-role': currentUser?.role,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete survey');
      }

      // Refresh surveys list
      fetchSurveys();
      setIsDeleteModalOpen(false);
      setSurveyToDelete(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteMultiple = async () => {
    if (!selectedSurveys.length) return;
    
    try {
      const response = await fetch('/api/surveys/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role
        },
        body: JSON.stringify({ ids: selectedSurveys })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete surveys');
      }

      // Reset selection and refresh
      setSelectedSurveys([]);
      setIsSelectionMode(false);
      fetchSurveys();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDuplicateSurvey = async (id) => {
    try {
      const response = await fetch(`/api/surveys/${id}/duplicate`, {
        method: 'POST',
        headers: {
          'x-user-role': currentUser?.role,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to duplicate survey');
      }

      // Refresh surveys list
      fetchSurveys();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleSurveySelection = (id) => {
    if (selectedSurveys.includes(id)) {
      setSelectedSurveys(selectedSurveys.filter(surveyId => surveyId !== id));
    } else {
      setSelectedSurveys([...selectedSurveys, id]);
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedSurveys([]);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1); // Reset to first page when filter changes
  };

  // Filter surveys based on search and category
  const filteredSurveys = surveys.filter(survey => {
    const matchesSearch = survey.title.toLowerCase().includes(filters.search.toLowerCase());
    const matchesCategory = filters.category === 'all' || survey.category === filters.category;
    return matchesSearch && matchesCategory;
  });

  // Pagination
  const indexOfLastSurvey = currentPage * surveysPerPage;
  const indexOfFirstSurvey = indexOfLastSurvey - surveysPerPage;
  const currentSurveys = filteredSurveys.slice(indexOfFirstSurvey, indexOfLastSurvey);
  const totalPages = Math.ceil(filteredSurveys.length / surveysPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <ClipboardList className="mr-2" /> Survey Management
        </h1>
        <div className="flex space-x-2">
          {isSelectionMode ? (
            <>
              <button
                onClick={toggleSelectionMode}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md flex items-center"
              >
                <X className="mr-1 h-4 w-4" /> Cancel
              </button>
              <button
                onClick={handleDeleteMultiple}
                disabled={!selectedSurveys.length}
                className={`px-3 py-2 rounded-md flex items-center ${!selectedSurveys.length ? 'bg-red-200 text-red-400 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600'}`}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete ({selectedSurveys.length})
              </button>
            </>
          ) : (
            <>
              <button
                onClick={toggleSelectionMode}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md flex items-center"
              >
                <FileText className="mr-1 h-4 w-4" /> Select
              </button>
              <Link href="/survey_management/create" className="px-3 py-2 bg-blue-500 text-white rounded-md flex items-center hover:bg-blue-600">
                <Plus className="mr-1 h-4 w-4" /> Create Survey
              </Link>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 flex items-start">
          <AlertCircle className="mr-2 h-5 w-5 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            name="search"
            value={filters.search}
            onChange={handleFilterChange}
            placeholder="Search surveys..."
            className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
        
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md flex items-center"
          >
            <Filter className="mr-1 h-4 w-4" />
            Filters
          </button>
          
          {showFilters && (
            <div className="flex space-x-2 items-center">
              <select
                name="category"
                value={filters.category}
                onChange={handleFilterChange}
                className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {SURVEY_CATEGORIES.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {currentSurveys.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <ClipboardList className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-xl font-medium text-gray-700 mb-2">No surveys found</h3>
          <p className="text-gray-500 mb-6">Create your first survey to get started.</p>
          <Link href="/survey_management/create" className="px-4 py-2 bg-blue-500 text-white rounded-md inline-flex items-center hover:bg-blue-600">
            <Plus className="mr-1 h-4 w-4" /> Create Survey
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {isSelectionMode && (
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedSurveys.length === currentSurveys.length}
                        onChange={() => {
                          if (selectedSurveys.length === currentSurveys.length) {
                            setSelectedSurveys([]);
                          } else {
                            setSelectedSurveys(currentSurveys.map(survey => survey._id));
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </th>
                  )}
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Questions
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Responses
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentSurveys.map((survey) => (
                  <tr key={survey._id} className={selectedSurveys.includes(survey._id) ? 'bg-blue-50' : ''}>
                    {isSelectionMode && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedSurveys.includes(survey._id)}
                          onChange={() => toggleSurveySelection(survey._id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{survey.title}</div>
                          <div className="text-sm text-gray-500">{survey.description.substring(0, 50)}{survey.description.length > 50 ? '...' : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{survey.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${STATUS_COLORS[survey.status]}`}>
                        {survey.status.charAt(0).toUpperCase() + survey.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {survey.questions?.length || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {survey.responseCount || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(survey.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Link href={`/survey_management/view/${survey._id}`} className="text-indigo-600 hover:text-indigo-900">
                          <Eye className="h-5 w-5" />
                        </Link>
                        <Link href={`/survey_management/edit/${survey._id}`} className="text-blue-600 hover:text-blue-900">
                          <Edit2 className="h-5 w-5" />
                        </Link>
                        <button
                          onClick={() => handleDuplicateSurvey(survey._id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          <Copy className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => {
                            setSurveyToDelete(survey);
                            setIsDeleteModalOpen(true);
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
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
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <nav className="flex items-center space-x-2">
            <button
              onClick={() => paginate(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded-md ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            
            {[...Array(totalPages).keys()].map(number => (
              <button
                key={number + 1}
                onClick={() => paginate(number + 1)}
                className={`px-3 py-1 rounded-md ${currentPage === number + 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                {number + 1}
              </button>
            ))}
            
            <button
              onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded-md ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Deletion</h3>
            <p className="text-gray-500 mb-4">
              Are you sure you want to delete the survey "{surveyToDelete?.title}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSurveyToDelete(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSurvey(surveyToDelete?._id)}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyManagement;
