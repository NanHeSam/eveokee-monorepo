import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@backend/convex';
import ConvexQueryBoundary from '@/components/ConvexQueryBoundary';

type StatusFilter = 'all' | 'queued' | 'scheduled' | 'started' | 'completed' | 'failed' | 'canceled';

export default function CallMonitoring() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [limit, setLimit] = useState(50);
  
  const callJobs = useQuery(api.callJobs.getCallJobs, {
    limit,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  
  const callStats = useQuery(api.callJobs.getCallJobStats);
  const callSessions = useQuery(api.callJobs.getCallSessions, { limit: 20 });
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  
  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'started':
        return 'bg-blue-100 text-blue-800';
      case 'scheduled':
        return 'bg-purple-100 text-purple-800';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'canceled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Call Monitoring Dashboard
        </h1>
        
        <ConvexQueryBoundary
          queries={[
            { data: callJobs },
            { data: callStats },
            { data: callSessions },
          ]}
          loadingFallback={
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading dashboard data...</span>
            </div>
          }
        >
        {/* Statistics Cards */}
        {callStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-600">Total</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{callStats.total}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-600">Queued</div>
              <div className="text-3xl font-bold text-yellow-600 mt-2">{callStats.queued}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-600">Scheduled</div>
              <div className="text-3xl font-bold text-purple-600 mt-2">{callStats.scheduled}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-600">Started</div>
              <div className="text-3xl font-bold text-blue-600 mt-2">{callStats.started}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-600">Completed</div>
              <div className="text-3xl font-bold text-green-600 mt-2">{callStats.completed}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-600">Failed</div>
              <div className="text-3xl font-bold text-red-600 mt-2">{callStats.failed}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-600">Canceled</div>
              <div className="text-3xl font-bold text-gray-600 mt-2">{callStats.canceled}</div>
            </div>
          </div>
        )}
        
        {/* Last Error */}
        {callStats?.lastError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Last Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{callStats.lastError}</p>
                  {callStats.lastErrorAt && (
                    <p className="mt-1 text-xs">at {formatDate(callStats.lastErrorAt)}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Call Jobs Table */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Call Jobs</h2>
              <div className="flex items-center space-x-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="queued">Queued</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="started">Started</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="canceled">Canceled</option>
                </select>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={20}>20 jobs</option>
                  <option value={50}>50 jobs</option>
                  <option value={100}>100 jobs</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scheduled For
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    VAPI Call ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attempts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Error
                  </th>

                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {callJobs?.map((job) => (
                  <tr key={job._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(job.scheduledForUTC)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {job.vapiCallId || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.attempts}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600 max-w-xs truncate">
                      {job.errorMessage || '—'}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {callJobs && callJobs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No call jobs found</p>
            </div>
          )}
        </div>
        
        {/* Call Sessions Table */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Recent Call Sessions</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    VAPI Call ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Started At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ended At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Disposition
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {callSessions?.map((session) => (
                  <tr key={session._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                      {session.vapiCallId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(session.startedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {session.endedAt ? formatDate(session.endedAt) : 'In progress'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDuration(session.durationSec)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {session.disposition || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {callSessions && callSessions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No call sessions found</p>
            </div>
          )}
        </div>
        </ConvexQueryBoundary>
      </div>
    </div>
  );
}
