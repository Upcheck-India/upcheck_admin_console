import React, { createContext, useContext, memo } from 'react';

const TabsContext = createContext({
  activeTab: '',
  setActiveTab: () => {},
});

export const Tabs = memo(({ value, onValueChange, children, className = '' }) => {
  const contextValue = React.useMemo(() => ({
    activeTab: value,
    setActiveTab: onValueChange
  }), [value, onValueChange]);

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={`w-full ${className}`}>
        {children}
      </div>
    </TabsContext.Provider>
  );
});

export const TabsList = memo(({ children, className = '' }) => {
  return (
    <div className={`flex flex-wrap gap-2 border-b border-gray-200 ${className}`}>
      {children}
    </div>
  );
});

export const TabsTrigger = memo(({ value, children, icon: Icon }) => {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  const isActive = activeTab === value;

  const handleClick = React.useCallback(() => {
    setActiveTab(value);
  }, [setActiveTab, value]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px flex items-center gap-2
        ${isActive 
          ? 'border-b-2 border-blue-500 text-blue-600 bg-white' 
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
        }`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
});

export const TabsContent = memo(({ value, children }) => {
  const { activeTab } = useContext(TabsContext);
  
  if (activeTab !== value) return null;
  
  return (
    <div className="py-4">
      {children}
    </div>
  );
});

// Add display names for debugging
Tabs.displayName = 'Tabs';
TabsList.displayName = 'TabsList';
TabsTrigger.displayName = 'TabsTrigger';
TabsContent.displayName = 'TabsContent';