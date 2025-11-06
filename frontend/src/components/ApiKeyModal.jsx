import PropTypes from 'prop-types';

export default function ApiKeyModal({ isOpen, onClose, onSubmit, title, message }) {
  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    const input = e.target.elements.apiKey;
    if (input.value) {
      onSubmit(input.value);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border bg-white dark:bg-gray-800 dark:border-gray-700 shadow-2xl animate-scale-in">
        <div className="relative p-8 border-b dark:border-gray-700 text-center">
          {/* Decorative background element */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary rounded-t-2xl"></div>
          
          {/* Icon with gradient background */}
          <div className="mb-6 mx-auto w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-3xl">🔑</span>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{title}</h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{message}</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-8">
            <label htmlFor="apiKey" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
              Authentication Key
            </label>
            <div className="relative">
              <input
                id="apiKey"
                name="apiKey"
                type="password"
                required
                className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 text-sm"
                placeholder="Enter your authentication key..."
                autoComplete="off"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="px-8 pb-8 flex items-center justify-end gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <span>🔓</span>
              <span>Unlock Access</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

ApiKeyModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
};
