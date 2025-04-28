'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Download, Clock, User, Medal } from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import ErrorMessage from '../../components/ErrorMessage';
import LoadingState from '../../components/LoadingState';

export default function TestResult({ params }) {
  const [test, setTest] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { isLoading, isAuthenticated, hasPermission } = useAuth(true, 'recruitment.manage');

  useEffect(() => {
    if (isAuthenticated && hasPermission) {
      fetchTest();
    }
  }, [isAuthenticated, hasPermission, params.id]);

  const fetchTest = async () => {
    try {
      const res = await fetch(`/api/recruitment/tests/${params.id}`);
      if (!res.ok) throw new Error('Failed to fetch test');
      const data = await res.json();
      setTest(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadResult = async () => {
    try {
      const res = await fetch(`/api/recruitment/tests/${params.id}/export`);
      if (!res.ok) throw new Error('Failed to download results');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-results-${params.id}.csv`;
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

  if (!test) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h2 className="text-xl font-bold text-red-600 mb-4">Test Not Found</h2>
        <p className="text-gray-700">The requested test could not be found.</p>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            onClick={() => router.push('/recruitment/tests')}
            className="flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Tests
          </button>
        </div>
        
        {error && <ErrorMessage message={error} onClose={() => setError('')} />}

        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Test Result Details
            </h1>
            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center">
                <User className="h-4 w-4 mr-1" />
                {test.applicantName}
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {Math.floor(test.timeSpent / 60)}m {test.timeSpent % 60}s
              </div>
              <div className="flex items-center">
                <Medal className="h-4 w-4 mr-1" />
                Score: {test.score}%
              </div>
            </div>
          </div>

          <button
            onClick={downloadResult}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="h-5 w-5 mr-2" />
            Download Results
          </button>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Responses
            </h2>
            <div className="space-y-8">
              {test.answers.map((answer, index) => (
                <div key={index} className="border-b border-gray-200 pb-6 last:border-0 last:pb-0">
                  <div className="mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Question {index + 1}
                    </span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {answer.question}
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                      {answer.answer}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}