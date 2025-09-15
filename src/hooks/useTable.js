import { useState, useMemo, useCallback } from 'react';

// Named export (untuk import { useTable })
export const useTable = (data = [], options = {}) => {
  const {
    initialPage = 1,
    itemsPerPage = 10,
    sortable = true,
    searchable = true,
    searchFields = []
  } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({});

  // Search function
  const searchData = useCallback((data, searchTerm, searchFields) => {
    if (!searchTerm || !data) return data;
    
    return data.filter(item => {
      if (searchFields && searchFields.length > 0) {
        return searchFields.some(field => 
          item[field]?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        );
      } else {
        return Object.values(item).some(value =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
    });
  }, []);

  // Sort function
  const sortData = useCallback((data, sortConfig) => {
    if (!sortConfig.key || !data) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, []);

  // Filter function
  const filterData = useCallback((data, filters) => {
    if (!filters || Object.keys(filters).length === 0 || !data) return data;

    return data.filter(item => {
      return Object.entries(filters).every(([key, filterValue]) => {
        if (!filterValue) return true;
        
        if (Array.isArray(filterValue)) {
          return filterValue.includes(item[key]);
        }
        
        return item[key] === filterValue;
      });
    });
  }, []);

  // Process data
  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    let result = data;
    
    // Apply filters
    result = filterData(result, filters);
    
    // Apply search
    if (searchable) {
      result = searchData(result, searchTerm, searchFields);
    }
    
    // Apply sort
    if (sortable) {
      result = sortData(result, sortConfig);
    }
    
    return result;
  }, [data, filters, searchTerm, sortConfig, searchable, sortable, searchFields, filterData, searchData, sortData]);

  // Pagination
  const paginatedData = useMemo(() => {
    if (!processedData || !Array.isArray(processedData)) return [];
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedData.slice(startIndex, startIndex + itemsPerPage);
  }, [processedData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil((processedData?.length || 0) / itemsPerPage);

  // Actions
  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleSearch = useCallback((term) => {
    setSearchTerm(term || '');
    setCurrentPage(1);
  }, []);

  const handleFilter = useCallback((filterKey, filterValue) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: filterValue
    }));
    setCurrentPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({});
    setSearchTerm('');
    setSortConfig({ key: null, direction: 'asc' });
    setCurrentPage(1);
  }, []);

  return {
    // Data
    data: paginatedData,
    totalItems: processedData?.length || 0,
    
    // Pagination
    currentPage,
    totalPages,
    setCurrentPage,
    
    // Search
    searchTerm,
    handleSearch,
    
    // Sort
    sortConfig,
    handleSort,
    
    // Filter
    filters,
    handleFilter,
    resetFilters,
    
    // Utility
    startIndex: (currentPage - 1) * itemsPerPage,
    endIndex: Math.min(currentPage * itemsPerPage, processedData?.length || 0)
  };
};

// Default export (untuk import useTable)
export default useTable;