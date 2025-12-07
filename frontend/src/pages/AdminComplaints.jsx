import { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminComplaints({ apiClient, refreshData }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentComplaint, setCurrentComplaint] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [sending, setSending] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState('idle'); // 'idle', 'success', 'error'
  const [submissionError, setSubmissionError] = useState('');

  const fetchComplaints = useCallback(async () => {
    if (!apiClient) {
      setError('Authentication required.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await apiClient.get('/complaints');
      setComplaints(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch complaints.');
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const openResponseModal = (complaint) => {
    setCurrentComplaint(complaint);
    setModalOpen(true);
    setResponseText('');
    setSubmissionStatus('idle');
    setSubmissionError('');
  };

  const handleSendResponse = async () => {
    if (!responseText.trim() || !currentComplaint) return;
    setSending(true);
    setSubmissionStatus('idle');
    try {
      await apiClient.post(`/complaints/${currentComplaint.id}/respond`, {
        message: responseText,
      });
      setSubmissionStatus('success');
      if (refreshData) refreshData(); // Refresh dashboard counts
      fetchComplaints(); // Re-fetch complaints to update status
      setTimeout(() => {
        setModalOpen(false);
      }, 2000); // Close modal after 2 seconds
    } catch (err) {
      setSubmissionStatus('error');
      setSubmissionError(err.response?.data?.error || 'Failed to send response.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <LoadingSpinner size="md" text="Loading complaints..." />
      </div>
    );
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <>
      <div className="card p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">📝</span> User Complaints
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {complaints.length} total
          </span>
        </div>
        
        {complaints.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">No complaints found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider rounded-l-lg">
                    ID
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User ID
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Complaint
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider rounded-r-lg">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {complaints.map((complaint) => (
                  <tr key={complaint.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      #{complaint.id}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {complaint.telegram_id}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate" title={complaint.complaint}>
                      {complaint.complaint}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(complaint.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {complaint.responded ? (
                        <span className="px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                          Responded
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      {!complaint.responded && (
                        <button
                          onClick={() => openResponseModal(complaint)}
                          className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium transition-colors"
                        >
                          Respond
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 sm:p-8 border border-gray-100 dark:border-gray-700 transform transition-all scale-100">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-3">
              <span>💬</span> Respond to Complaint
            </h2>
            
            {submissionStatus === 'success' ? (
              <div className="text-center py-12 animate-fade-in">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Response Sent!</p>
                <p className="text-gray-500 dark:text-gray-400">The user has been notified.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider font-semibold">
                    <span>User ID: {currentComplaint.telegram_id}</span>
                    <span>Complaint #{currentComplaint.id}</span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 italic">
                    "{currentComplaint.complaint}"
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Your Response
                  </label>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                    rows="5"
                    placeholder="Type your response here..."
                  />
                </div>

                {submissionStatus === 'error' && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {submissionError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
                    disabled={sending}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendResponse}
                    className="px-6 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium shadow-lg shadow-primary-500/30 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    disabled={sending || !responseText.trim()}
                  >
                    {sending ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </span>
                    ) : 'Send Response'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

AdminComplaints.propTypes = {
  apiClient: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  refreshData: PropTypes.func,
};
