import { useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { FileCheck, FileX } from 'lucide-react';

export default function SourcePanel({ open, onClose, withResults = [], withoutResults = [] }) {
  const [activeTab, setActiveTab] = useState('with');

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.aside
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed right-0 top-0 z-50 h-screen w-[340px] border-l-4 border-brand-500 bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.1)]"
          >
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <h3 className="text-[14px] font-bold text-gray-900">
                  {activeTab === 'with' ? 'Fontes com Resultados' : 'Fontes sem Resultados'}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[13px] font-bold text-brand-500 hover:underline"
                >
                  Fechar â€º
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => setActiveTab('with')}
                  className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-[12px] font-bold transition ${
                    activeTab === 'with'
                      ? 'border-b-2 border-brand-500 text-brand-500'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <FileCheck className="h-3.5 w-3.5" />
                  Com Resultados ({withResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('without')}
                  className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-[12px] font-bold transition ${
                    activeTab === 'without'
                      ? 'border-b-2 border-brand-500 text-brand-500'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <FileX className="h-3.5 w-3.5" />
                  Sem Resultados ({withoutResults.length})
                </button>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto px-5 py-3">
                {(activeTab === 'with' ? withResults : withoutResults).map((source, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="border-b border-gray-100 py-3 text-[12px] text-gray-600 last:border-b-0"
                  >
                    {typeof source === 'string' ? source : source.title}
                  </motion.div>
                ))}
                {(activeTab === 'with' ? withResults : withoutResults).length === 0 && (
                  <p className="py-8 text-center text-[12px] text-gray-400">Nenhuma fonte nesta categoria.</p>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

