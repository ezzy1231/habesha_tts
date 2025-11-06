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
        <button key={1} onClick={() => handlePageClick(1)} className="px-3 py-2 mx-1 text-sm rounded-lg transition-colors duration-200 hover:bg-blue-500 hover:text-white text-gray-700 dark:text-gray-300">
          1
        </button>
      );
      if (startPage > 2) {
        pageNumbers.push(<span key="start-ellipsis" className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">...</span>);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <button
          key={i}
          onClick={() => handlePageClick(i)}
          className={`px-3 py-2 mx-1 text-sm rounded-lg transition-colors duration-200 ${
            currentPage === i 
              ? 'bg-blue-500 text-white' 
              : 'hover:bg-blue-500 hover:text-white text-gray-700 dark:text-gray-300'
          }`}
        >
          {i}
        </button>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pageNumbers.push(<span key="end-ellipsis" className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">...</span>);
      }
      pageNumbers.push(
        <button key={totalPages} onClick={() => handlePageClick(totalPages)} className="px-3 py-2 mx-1 text-sm rounded-lg transition-colors duration-200 hover:bg-blue-500 hover:text-white text-gray-700 dark:text-gray-300">
          {totalPages}
        </button>
      );
    }

    return pageNumbers;
  };

  return (
    <div className="flex justify-center items-center mt-8">
      <button
        onClick={() => handlePageClick(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 mx-1 rounded-lg transition-colors duration-200 hover:bg-blue-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
      >
        <span className="hidden sm:inline">&lt; Prev</span>
        <span className="sm:hidden">&lt;</span>
      </button>
      {renderPageNumbers()}
      <button
        onClick={() => handlePageClick(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 mx-1 rounded-lg transition-colors duration-200 hover:bg-blue-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
      >
        <span className="hidden sm:inline">Next &gt;</span>
        <span className="sm:hidden">&gt;</span>
      </button>
    </div>
  );
};

export default Pagination;
