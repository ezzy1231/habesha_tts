import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const BalanceContext = createContext();

export function BalanceProvider({ children }) {
  const [isHidden, setIsHidden] = useState(() => {
    const saved = localStorage.getItem('balance_hidden');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('balance_hidden', isHidden);
  }, [isHidden]);

  const toggleVisibility = () => {
    setIsHidden(!isHidden);
  };

  return (
    <BalanceContext.Provider value={{ isHidden, toggleVisibility }}>
      {children}
    </BalanceContext.Provider>
  );
}

BalanceProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useBalance() {
  const context = useContext(BalanceContext);
  if (!context) {
    throw new Error('useBalance must be used within a BalanceProvider');
  }
  return context;
}