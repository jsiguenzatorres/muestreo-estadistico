
import React, { useState } from 'react';
import Modal from './Modal';
import { InfoIcon } from '../../constants';

interface InfoHelperProps {
    title: string;
    content: React.ReactNode;
    currentValue?: string | number;
}

const InfoHelper: React.FC<InfoHelperProps> = ({ title, content, currentValue }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <span onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }} className="cursor-pointer inline-block">
                <InfoIcon />
            </span>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={title}>
                <div className="font-sans">
                    {/* Value Display Banner */}
                    {currentValue !== undefined && currentValue !== null && currentValue !== '' && (
                        <div className="mb-6 flex justify-center animate-fade-in-up">
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-8 py-4 rounded-xl shadow-lg border border-slate-700 text-center min-w-[200px] transform hover:scale-105 transition-transform duration-300">
                                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mb-2">Valor Configurado</div>
                                <div className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white font-mono">
                                    {currentValue}
                                </div>
                            </div>
                        </div>
                    )}
                    {content}
                </div>
            </Modal>
        </>
    );
};

export default InfoHelper;
