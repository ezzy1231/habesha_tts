import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const AdminBalanceContext = createContext();

export function AdminBalanceProvider({ children }) {
  const [isHidden, setIsHidden] = useState(() => {
    const saved = localStorage.getItem('admin_balance_hidden');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('admin_balance_hidden', isHidden);
  }, [isHidden]);

  const toggleVisibility = () => {
    setIsHidden(!isHidden);
  };

  return (
    <AdminBalanceContext.Provider value={{ isHidden, toggleVisibility }}>
      {children}
    </AdminBalanceContext.Provider>
  );
}

AdminBalanceProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useAdminBalance() {
  const context = useContext(AdminBalanceContext);
  if (!context) {
    throw new Error('useAdminBalance must be used within a AdminBalanceProvider');
  }
  return context;
}