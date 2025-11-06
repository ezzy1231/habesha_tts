import { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

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
    return <div className="text-center p-8">Loading complaints...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <>
      <div className="p-6 bg-gray-100 dark:bg-gray-800 min-h-screen">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">User Complaints</h1>
        
        {complaints.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-300">No complaints found.</p>
        ) : (
          <div className="overflow-x-auto bg-white dark:bg-gray-900 rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    User ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Complaint
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {complaints.map((complaint) => (
                  <tr key={complaint.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {complaint.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {complaint.telegram_id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {complaint.complaint}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(complaint.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {complaint.responded ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          Responded
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {!complaint.responded && (
                        <button
                          onClick={() => openResponseModal(complaint)}
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Respond to Complaint #{currentComplaint.id}</h2>
            
            {submissionStatus === 'success' ? (
              <div className="text-center py-8">
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">✅ Response sent successfully!</p>
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                  <strong>User:</strong> {currentComplaint.telegram_id}<br/>
                  <strong>Complaint:</strong> "{currentComplaint.complaint}"
                </p>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  rows="4"
                  placeholder="Type your response here..."
                />
                {submissionStatus === 'error' && (
                  <p className="text-red-500 text-sm mt-2">{submissionError}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="btn btn-secondary"
                    disabled={sending}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendResponse}
                    className="btn btn-primary"
                    disabled={sending}
                  >
                    {sending ? 'Sending...' : 'Send Response'}
                  </button>
                </div>
              </>
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
