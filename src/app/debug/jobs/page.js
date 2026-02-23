'use client';

import { useState, useEffect } from 'react';

export default function JobsDebugPage() {
  const [jobStats, setJobStats] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [seriesInfo, setSeriesInfo] = useState(null);

  useEffect(() => {
    fetchJobStats();
    fetchSeriesInfo();
  }, []);

  const fetchJobStats = async () => {
    try {
      const response = await fetch('/api/jobs/process');
      const data = await response.json();
      setJobStats(data);
    } catch (error) {
      console.error('Error fetching job stats:', error);
    }
  };

  const fetchSeriesInfo = async () => {
    try {
      const response = await fetch('/api/test/series-notification');
      const data = await response.json();
      setSeriesInfo(data);
    } catch (error) {
      console.error('Error fetching series info:', error);
    }
  };

  const processJobs = async () => {
    setProcessing(true);
    try {
      const response = await fetch('/api/jobs/process', { method: 'POST' });
      const data = await response.json();
      setTestResult(data);
      await fetchJobStats(); // Refresh stats
    } catch (error) {
      setTestResult({ error: error.message });
    } finally {
      setProcessing(false);
    }
  };

  const testSeriesNotification = async () => {
    if (!seriesInfo?.seriesId) return;
    
    setProcessing(true);
    try {
      const response = await fetch('/api/test/series-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesId: seriesInfo.seriesId })
      });
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({ error: error.message });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Jobs Debug Dashboard</h1>
      
      {/* Job Statistics */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Job Statistics</h2>
        {jobStats ? (
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{jobStats.stats.pending}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{jobStats.stats.processing}</div>
              <div className="text-sm text-gray-600">Processing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{jobStats.stats.completed}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{jobStats.stats.failed}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
          </div>
        ) : (
          <div>Loading...</div>
        )}
      </div>

      {/* Series Information */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Latest Series Information</h2>
        {seriesInfo ? (
          <div>
            <p><strong>Series ID:</strong> {seriesInfo.seriesId}</p>
            <p><strong>Title:</strong> {seriesInfo.title}</p>
            <p><strong>Participants:</strong> {seriesInfo.participants?.join(', ')}</p>
            <p><strong>Notification Enabled:</strong> {seriesInfo.seriesNotification?.enabled ? 'Yes' : 'No'}</p>
            <p><strong>Notification Sent:</strong> {seriesInfo.seriesNotification?.sent ? 'Yes' : 'No'}</p>
          </div>
        ) : (
          <div>Loading...</div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Actions</h2>
        <div className="space-x-4">
          <button
            onClick={processJobs}
            disabled={processing}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {processing ? 'Processing...' : 'Process Pending Jobs'}
          </button>
          
          <button
            onClick={testSeriesNotification}
            disabled={processing || !seriesInfo?.seriesId}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {processing ? 'Testing...' : 'Test Series Notification'}
          </button>
          
          <button
            onClick={() => { fetchJobStats(); fetchSeriesInfo(); }}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Test Results */}
      {testResult && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Recent Jobs */}
      {jobStats?.recentJobs && (
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Recent Jobs</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Execute At</th>
                  <th className="px-4 py-2 text-left">Created</th>
                  <th className="px-4 py-2 text-left">Error</th>
                </tr>
              </thead>
              <tbody>
                {jobStats.recentJobs.map((job, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-4 py-2">{job.type}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        job.status === 'completed' ? 'bg-green-100 text-green-800' :
                        job.status === 'failed' ? 'bg-red-100 text-red-800' :
                        job.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">{new Date(job.executeAt).toLocaleString()}</td>
                    <td className="px-4 py-2">{new Date(job.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2">{job.error?.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}