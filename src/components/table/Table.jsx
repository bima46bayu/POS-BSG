import React from 'react';

const TableCard = ({ title, toolbar, children, footer }) => {
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {/* Header */}
      {(title || toolbar) && (
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            {title && <h3 className="text-lg font-semibold text-gray-800">{title}</h3>}
            {toolbar && <div className="flex items-center gap-3">{toolbar}</div>}
          </div>
        </div>
      )}
      
      {/* Content */}
      <div>{children}</div>
      
      {/* Footer */}
      {footer && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          {footer}
        </div>
      )}
    </div>
  );
};

export default TableCard;