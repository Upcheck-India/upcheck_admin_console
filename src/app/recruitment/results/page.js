'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import RecruitmentNav from '../components/RecruitmentNav';
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Download, 
  Filter, 
  Search, 
  ChevronDown,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';

export default function TestResults() {
  const [results, setResults] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    test: 'all',
    status: 'all',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Fetch results data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch tests from API
        const testsResponse = await fetch('/api/recruitment/tests');
        
        if (!testsResponse.ok) {
          throw new Error('Failed to fetch tests');
        }
        
        const testsData = await testsResponse.json();
        setTests(testsData);
        
        // Fetch submissions from API
        const submissionsResponse = await fetch('/api/recruitment/submissions');
        
        if (!submissionsResponse.ok) {
          throw new Error('Failed to fetch submissions');
        }
        
        const submissionsData = await submissionsResponse.json();
        setResults(submissionsData);

      } catch (error) {
        console.error('Error fetching data:', error);
        alert('Error: ' + error.message);
        // Fallback to empty arrays if API fails
        setTests([]);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Filter results based on current filter settings
  const filteredResults = results.filter(result => {
    // Filter by test
    if (filter.test !== 'all' && result.testId !== filter.test) {
      return false;
    }
    
    // Filter by status
    if (filter.status !== 'all' && result.status !== filter.status) {
      return false;
    }
    
    // Filter by search term (candidate name or email)
    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      return (
        result.candidateName?.toLowerCase().includes(searchTerm) ||
        result.candidateEmail?.toLowerCase().includes(searchTerm)
      );
    }
    
    return true;
  });
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not available';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Handle filter changes
  const handleFilterChange = (name, value) => {
    setFilter(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Clear all filters
  const clearFilters = () => {
    setFilter({
      test: 'all',
      status: 'all',
      search: ''
    });
  };
  
  // Prepare data for pass/fail pie chart
  const passFailData = [
    { 
      name: 'Passed', 
      value: results.filter(r => {
        // Consider a submission passed if percentageScore >= 70% (or use a threshold from the test if available)
        const passingThreshold = 70;
        return r.percentageScore >= passingThreshold;
      }).length 
    },
    { 
      name: 'Failed', 
      value: results.filter(r => {
        // Consider a submission failed if percentageScore < 70%
        const passingThreshold = 70;
        return r.percentageScore < passingThreshold;
      }).length 
    }
  ];
  
  // Prepare data for test scores bar chart
  const testScoresData = tests.map(test => {
    const testResults = results.filter(r => r.testId === test.id);
    const avgScore = testResults.length > 0 
      ? Math.round(testResults.reduce((sum, r) => sum + (r.percentageScore || 0), 0) / testResults.length) 
      : 0;
    
    return {
      name: test.title || 'Unnamed Test',
      avgScore,
      passingScore: test.passingScore || 70 // Default to 70% if not specified
    };
  });
  
  // Prepare data for time spent chart
  const timeSpentData = tests.map(test => {
    const testResults = results.filter(r => r.testId === test.id);
    const avgTime = testResults.length > 0 
      ? Math.round(testResults.reduce((sum, r) => sum + (r.timeSpent || 0), 0) / testResults.length) 
      : 0;
    
    return {
      name: test.title || 'Unnamed Test',
      avgTime
    };
  });
  
  // Colors for charts
  const COLORS = ['#4ade80', '#f87171'];
  
  // Download results as CSV
  const handleDownloadCSV = () => {
    // Create CSV content
    const headers = ['Candidate Name', 'Email', 'Test', 'Score', 'Status', 'Submitted Date', 'Time Spent (min)', 'Security Warnings'];
    const rows = filteredResults.map(result => [
      result.candidateName,
      result.candidateEmail,
      result.testTitle,
      result.score,
      result.status === 'passed' ? 'Passed' : 'Failed',
      formatDate(result.submittedAt),
      result.timeSpent,
      result.securityWarnings
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'test-results.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <RecruitmentNav />
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Test Results Dashboard</h1>
        <p className="text-gray-600 mt-1">View and analyze candidate performance across all tests</p>
      </div>
      
      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Submissions</p>
              <p className="text-3xl font-bold mt-1">{results.length}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-full">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              From {tests.length} different tests
            </p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pass Rate</p>
              <p className="text-3xl font-bold mt-1">
                {results.length > 0 
                  ? Math.round((results.filter(r => (r.percentageScore || 0) >= 70).length / results.length) * 100)
                  : 0}%
              </p>
            </div>
            <div className="p-2 bg-green-100 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              {results.filter(r => (r.percentageScore || 0) >= 70).length} passed, {results.filter(r => (r.percentageScore || 0) < 70).length} failed
            </p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Average Score</p>
              <p className="text-3xl font-bold mt-1">
                {results.length > 0 
                  ? Math.round(results.reduce((sum, r) => sum + (r.percentageScore || 0), 0) / results.length)
                  : 0}%
              </p>
            </div>
            <div className="p-2 bg-purple-100 rounded-full">
              <BarChart className="h-6 w-6 text-purple-600" />
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
              <p className="text-sm font-medium text-gray-500">Avg. Time Spent</p>
              <p className="text-3xl font-bold mt-1">
                {results.length > 0 
                  ? Math.round(results.reduce((sum, r) => sum + r.timeSpent, 0) / results.length)
                  : 0} min
              </p>
            </div>
            <div className="p-2 bg-yellow-100 rounded-full">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              Per test completion
            </p>
          </div>
        </div>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Pass/Fail Distribution */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Pass/Fail Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={passFailData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {passFailData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Average Scores by Test */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Average Scores by Test</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={testScoresData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgScore" name="Average Score" fill="#8884d8" />
                <Bar dataKey="passingScore" name="Passing Score" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Average Time Spent by Test */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Average Time Spent (minutes)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={timeSpentData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgTime" name="Average Time (min)" fill="#fbbf24" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Results Table */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <h2 className="text-xl font-semibold mb-4 md:mb-0">Test Results</h2>
          
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 w-full md:w-auto">
            {/* Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400" />
              </div>
              <input
                type="text"
                value={filter.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-60"
                placeholder="Search candidates..."
              />
            </div>
            
            {/* Filter button */}
            <div className="relative">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 border border-gray-300 rounded-md flex items-center justify-center hover:bg-gray-50 transition-colors w-full md:w-auto"
              >
                <Filter size={16} className="mr-2" />
                Filters
                <ChevronDown size={16} className="ml-2" />
              </button>
              
              {/* Filter dropdown */}
              {showFilters && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Test
                      </label>
                      <select
                        value={filter.test}
                        onChange={(e) => handleFilterChange('test', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Tests</option>
                        {tests.map(test => (
                          <option key={test.id} value={test.id}>{test.title}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        value={filter.status}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Statuses</option>
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>
                    
                    <div className="flex justify-between pt-2">
                      <button
                        onClick={clearFilters}
                        className="text-sm text-gray-600 hover:text-gray-900"
                      >
                        Clear Filters
                      </button>
                      <button
                        onClick={() => setShowFilters(false)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Export button */}
            <button
              onClick={handleDownloadCSV}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center w-full md:w-auto"
            >
              <Download size={16} className="mr-2" />
              Export Results
            </button>
          </div>
        </div>
        
        {filteredResults.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Candidate
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Test
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Warnings
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredResults.map((result) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900">{result.candidateName}</div>
                        <div className="text-sm text-gray-500">{result.candidateEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.testTitle}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">{result.score}%</span>
                        <span className="text-xs text-gray-500 ml-2">({result.passingScore}% to pass)</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        result.status === 'passed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {result.status === 'passed' ? 'Passed' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(result.submittedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.timeSpent} min
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`text-sm ${result.securityWarnings > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                          {result.securityWarnings}
                        </span>
                        {result.securityWarnings > 0 && (
                          <AlertTriangle size={16} className="text-amber-600 ml-1" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/recruitment/submissions/${result.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No results match your filters.</p>
            <button
              onClick={clearFilters}
              className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
