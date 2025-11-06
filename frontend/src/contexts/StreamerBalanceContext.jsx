import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const StreamerBalanceContext = createContext();

export function StreamerBalanceProvider({ children }) {
  const [isHidden, setIsHidden] = useState(() => {
    const saved = localStorage.getItem('streamer_balance_hidden');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('streamer_balance_hidden', isHidden);
  }, [isHidden]);

  const toggleVisibility = () => {
    setIsHidden(!isHidden);
  };

  return (
    <StreamerBalanceContext.Provider value={{ isHidden, toggleVisibility }}>
      {children}
    </StreamerBalanceContext.Provider>
  );
}

StreamerBalanceProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useStreamerBalance() {
  const context = useContext(StreamerBalanceContext);
  if (!context) {
    throw new Error('useStreamerBalance must be used within a StreamerBalanceProvider');
  }
  return context;
}