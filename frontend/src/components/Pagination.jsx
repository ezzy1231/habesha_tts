import React, { useState, useEffect } from 'react';

const Pagination = ({ pagination, onPageChange }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!pagination || pagination.totalPages <= 1) {
    return null;
  }

  const { currentPage, totalPages } = pagination;

  const handlePageClick = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  const renderPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = windowWidth < 768 ? 3 : 5; // Show 3 pages on mobile, 5 on larger screens
    const halfPagesToShow = Math.floor(maxPagesToShow / 2);

    let startPage = Math.max(1, currentPage - halfPagesToShow);
    let endPage = Math.min(totalPages, currentPage + halfPagesToShow);

    if (currentPage - 1 <= halfPagesToShow) {
      endPage = Math.min(totalPages, maxPagesToShow);
    }

    if (totalPages - currentPage <= halfPagesToShow) {
      startPage = Math.max(1, totalPages - maxPagesToShow + 1);
    }

    if (startPage > 1) {
      pageNumbers.push(
        <button key={1} onClick={() => handlePageClick(1)} className="w-9 h-9 mx-0.5 text-sm rounded-xl transition-all duration-200 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          1
        </button>
      );
      if (startPage > 2) {
        pageNumbers.push(<span key="start-ellipsis" className="px-1.5 py-2 text-sm text-gray-400 dark:text-gray-600">…</span>);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <button
          key={i}
          onClick={() => handlePageClick(i)}
          className={`w-9 h-9 mx-0.5 text-sm rounded-xl transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
            currentPage === i 
              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25' 
              : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400'
          }`}
        >
          {i}
        </button>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pageNumbers.push(<span key="end-ellipsis" className="px-1.5 py-2 text-sm text-gray-400 dark:text-gray-600">…</span>);
      }
      pageNumbers.push(
        <button key={totalPages} onClick={() => handlePageClick(totalPages)} className="w-9 h-9 mx-0.5 text-sm rounded-xl transition-all duration-200 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          {totalPages}
        </button>
      );
    }

    return pageNumbers;
  };

  return (
    <div className="flex justify-center items-center mt-6 sm:mt-8">
      <div className="inline-flex items-center gap-1 px-2 py-1.5 rounded-2xl bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl border border-gray-200/60 dark:border-white/[0.08] shadow-sm">
        <button
          onClick={() => handlePageClick(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 rounded-xl transition-all duration-200 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <span className="hidden sm:inline">← Prev</span>
          <span className="sm:hidden">←</span>
        </button>
        {renderPageNumbers()}
        <button
          onClick={() => handlePageClick(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 rounded-xl transition-all duration-200 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <span className="hidden sm:inline">Next →</span>
          <span className="sm:hidden">→</span>
        </button>
      </div>
    </div>
  );
};

export default Pagination;
