
import React from 'react';

interface CardProps {
    title?: string;
    children: React.ReactNode;
    className?: string;
}

const Card: React.FC<CardProps> = ({ title, children, className = '' }) => {
    const hasBg = /(^|\s)bg-/.test(className);
    return (
        <div className={`${!hasBg ? 'bg-white' : ''} rounded-lg shadow-md border border-gray-200 ${className}`}>
            {title && (
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
                </div>
            )}
            <div className="p-6">
                {children}
            </div>
        </div>
    );
};

export default Card;
