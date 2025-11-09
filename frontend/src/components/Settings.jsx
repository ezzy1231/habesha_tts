import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import LoadingSpinner from './LoadingSpinner';

export default function Settings({ apiClient }) {
  const [s, setS] = useState({ maxChars: 600, stepChars: 15, basePrice: 20, incrementPrice: 15, filteredWords: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [newFilteredWord, setNewFilteredWord] = useState('');

  useEffect(() => {
    if (!apiClient) return;
    apiClient.get(`/settings`).then(r => {
      const fetchedSettings = r.data.settings;
      if (!Array.isArray(fetchedSettings.filteredWords)) {
        fetchedSettings.filteredWords = [];
      }
      setS(fetchedSettings);
    }).catch(e => setError(e?.message || 'Failed')).finally(()=>setLoading(false));
  }, [apiClient]);

  const save = async () => {
    if (!apiClient) return;
    setSaving(true);
    setMessage(null);
    try {
      const resp = await apiClient.post(`/settings`, s);
      // Ensure filteredWords is applied back into state (server may return strings)
      if (resp?.data?.settings) {
        const newSettings = { ...resp.data.settings };
        if (typeof newSettings.filteredWords === 'string') {
          try { newSettings.filteredWords = JSON.parse(newSettings.filteredWords); } catch {}
        }
        if (!Array.isArray(newSettings.filteredWords)) newSettings.filteredWords = [];
        setS(newSettings);
      }
      setMessage({ type: 'success', text: 'Settings saved successfully.' });
    } catch (e) {
      setMessage({ type: 'error', text: e?.response?.data?.error || e?.message || 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const addFilteredWord = () => {
    if (newFilteredWord.trim() !== '' && !s.filteredWords.includes(newFilteredWord.trim())) {
      setS(prevS => ({ ...prevS, filteredWords: [...prevS.filteredWords, newFilteredWord.trim()] }));
      setNewFilteredWord('');
    }
  };

  const removeFilteredWord = (wordToRemove) => {
    setS(prevS => ({ ...prevS, filteredWords: prevS.filteredWords.filter(word => word !== wordToRemove) }));
  };

  if (loading) return (
    <div className="flex justify-center p-8">
      <LoadingSpinner size="md" text="Loading settings..." />
    </div>
  );
  if (error) return <div className="text-red-600">{error}</div>;

const input = (k, label) => (
    <div>
      <label className="block text-sm text-gray-500 dark:text-gray-300">{label}</label>
      <input type="number" value={s[k]} onChange={e => setS({ ...s, [k]: Number(e.target.value) })} className="border rounded px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
    </div>
  );

  return (
    <div className="rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 p-4 space-y-3">
{message && (
        <div className={`p-2 rounded text-sm ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
        }`}>
          {message.text}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {input('maxChars', 'Max Characters')}
        {input('stepChars', 'Step Characters')}
        {input('basePrice', 'Base Price (Br)')}
        {input('incrementPrice', 'Increment Price (Br)')}
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-gray-500 dark:text-gray-300">Filtered Words</label>
        <div className="flex flex-wrap gap-2">
          {s.filteredWords.map((word, index) => (
            <span key={index} className="flex items-center bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-full text-sm">
              {word}
              <button onClick={() => removeFilteredWord(word)} className="ml-2 text-gray-600 dark:text-gray-300 hover:text-red-500">
                &times;
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
<input
            type="text"
            value={newFilteredWord}
            onChange={e => setNewFilteredWord(e.target.value)}
            onKeyPress={e => { if (e.key === 'Enter') { e.preventDefault(); addFilteredWord(); } }}
            className="border rounded px-2 py-1 flex-grow bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="Add new filtered word"
          />
          <button onClick={addFilteredWord} className="px-3 py-1.5 rounded bg-blue-500 text-white">
            Add
          </button>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded bg-black text-white disabled:opacity-50">
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}
