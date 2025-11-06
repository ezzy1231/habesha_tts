import PropTypes from 'prop-types';

export default function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', confirmButtonClass = 'bg-blue-600 hover:bg-blue-700' }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border bg-white dark:bg-gray-800 dark:border-gray-700 shadow-2xl animate-scale-in">
        <div className="relative p-8 border-b dark:border-gray-700 text-center">
          {/* Decorative background element */}
          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${
            confirmButtonClass.includes('rose') || confirmButtonClass.includes('red')
              ? 'from-rose-500 to-rose-600'
              : 'from-emerald-500 to-emerald-600'
          } rounded-t-2xl`}></div>
          
          {/* Icon with appropriate color based on action type */}
          <div className={`mb-6 mx-auto w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
            confirmButtonClass.includes('rose') || confirmButtonClass.includes('red')
              ? 'bg-gradient-to-r from-rose-500 to-rose-600'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
          }`}>
            <span className="text-3xl">
              {confirmButtonClass.includes('rose') || confirmButtonClass.includes('red') ? '⚠️' : '✓'}
            </span>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{title}</h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{message}</p>
        </div>
        
        <div className="px-8 pb-8 flex items-center justify-end gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl pt-6">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`btn shadow-lg hover:shadow-xl transition-all duration-200 ${
              confirmButtonClass.includes('rose') || confirmButtonClass.includes('red')
                ? 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white'
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

ConfirmationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  confirmButtonClass: PropTypes.string,
};
