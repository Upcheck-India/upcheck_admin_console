'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, AlertCircle, X, Eye } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import ErrorMessage from '../components/ErrorMessage';
import LoadingState from '../components/LoadingState';

export default function TestResults() {
  const [tests, setTests] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { isLoading, isAuthenticated, hasPermission } = useAuth(true, 'recruitment.manage');

  useEffect(() => {
    if (isAuthenticated && hasPermission) {
      fetchTests();
    }
  }, [isAuthenticated, hasPermission]);

  const fetchTests = async () => {
    try {
      const res = await fetch('/api/recruitment/tests');
      if (!res.ok) throw new Error('Failed to fetch tests');
      const data = await res.json();
      setTests(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadResults = async (testId) => {
    try {
      const res = await fetch(`/api/recruitment/tests/${testId}/export`);
      if (!res.ok) throw new Error('Failed to download results');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-results-${testId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setError(error.message);
    }
  };

  if (isLoading || loading) {
    return <LoadingState />;
  }

  if (!isAuthenticated || !hasPermission) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h2 className="text-xl font-bold text-red-600 mb-4">Unauthorized Access</h2>
        <p className="text-gray-700">You do not have permission to view this page.</p>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Test Results
        </h1>

        <ErrorMessage message={error} onClose={() => setError('')} />

        <div className="bg-white shadow rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applicant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time Spent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tests.map((test) => (
                  <tr key={test._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{test.applicantName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{test.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 rounded-full ${
                        test.score >= 70 
                          ? 'bg-green-100 text-green-800'
                          : test.score >= 50
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {test.score}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {Math.floor(test.timeSpent / 60)}m {test.timeSpent % 60}s
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(test.submittedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex space-x-2">
                      <button
                        onClick={() => router.push(`/recruitment/tests/${test._id}`)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View Test"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => downloadResults(test._id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Download Results"
                      >
                        <Download className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}