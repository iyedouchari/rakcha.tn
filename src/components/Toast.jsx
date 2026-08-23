import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRakchaStore } from '../store/useRakchaStore';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast() {
  const toast = useRakchaStore((s) => s.toast);
  const hideToast = useRakchaStore((s) => s.hideToast);

  const isError =
    toast?.type === 'error' ||
    toast?.message?.toLowerCase().includes('failed') ||
    toast?.message?.toLowerCase().includes('error') ||
    toast?.message?.toLowerCase().includes('invalid') ||
    toast?.message?.toLowerCase().includes('already');

  const isSuccess =
    toast?.type === 'success' ||
    toast?.message?.toLowerCase().includes('success') ||
    toast?.message?.toLowerCase().includes('confirmed') ||
    toast?.message?.toLowerCase().includes('joined');

  const getBorderAndGlow = () => {
    if (isError) return 'border-crimson/40 shadow-[0_10px_30px_-5px_rgba(244,63,94,0.3)] bg-gradient-to-r from-[#1E1116]/95 to-[#151921]/95 text-red-200';
    if (isSuccess) return 'border-emerald-500/40 shadow-[0_10px_30px_-5px_rgba(16,185,129,0.3)] bg-gradient-to-r from-[#0F1E19]/95 to-[#151921]/95 text-emerald-200';
    return 'border-primary/40 shadow-[0_10px_30px_-5px_rgba(99,102,241,0.3)] bg-gradient-to-r from-[#14152A]/95 to-[#151921]/95 text-indigo-100';
  };

  const getIcon = () => {
    if (isError) return <AlertCircle className="text-crimson shrink-0" size={20} />;
    if (isSuccess) return <CheckCircle2 className="text-emerald-400 shrink-0" size={20} />;
    return <Info className="text-primary shrink-0" size={20} />;
  };

  return (
    <div className="fixed top-6 right-6 z-[99999] pointer-events-none flex flex-col items-end gap-2 max-w-sm w-full">
      <AnimatePresence mode="wait">
        {toast && (
          <motion.div
            key={toast.message}
            initial={{ opacity: 0, y: -20, scale: 0.95, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -16, scale: 0.95, filter: 'blur(4px)', transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            className={`pointer-events-auto w-full relative overflow-hidden backdrop-blur-2xl border rounded-2xl p-4 flex items-center gap-3.5 ${getBorderAndGlow()}`}
          >
            {getIcon()}
            <span className="font-medium text-sm leading-snug flex-1 select-none">
              {toast.message}
            </span>
            <motion.button
              whileHover={{ scale: 1.15, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={hideToast}
              className="text-white/60 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 shrink-0"
              aria-label="Dismiss toast"
            >
              <X size={16} />
            </motion.button>

            {/* Countdown Progress Bar */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 4, ease: 'linear' }}
              style={{ originX: 0 }}
              className={`absolute bottom-0 left-0 right-0 h-[2.5px] ${
                isError ? 'bg-crimson' : isSuccess ? 'bg-emerald-400' : 'bg-primary'
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
