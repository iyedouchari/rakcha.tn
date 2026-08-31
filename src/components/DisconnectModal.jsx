import React, { useEffect } from 'react';
import { LogOut, X } from 'lucide-react';

/**
 * DisconnectModal component
 * Pure JSX confirmation modal for logging out / disconnecting from Rakcha.
 * Completely avoids window.confirm() and native browser dialogs.
 */
export default function DisconnectModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  title = 'Log Out',
  message = 'Are you sure you want to disconnect? You will need to sign in again to access your groups and discussions.'
}) {
  // Handle keyboard events (Escape to dismiss, Enter to confirm if not loading)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="disconnect-modal-title"
    >
      <div
        className="bg-surface-container-high w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/20 animate-in zoom-in-95 duration-200 relative text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close icon button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          aria-label="Close modal"
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-surface-container-highest transition-colors disabled:opacity-50"
        >
          <X size={18} />
        </button>

        {/* Modal Content */}
        <div className="p-7 text-center">
          {/* Subtle warning / logout icon */}
          <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-500/10 animate-in zoom-in duration-300">
            <LogOut size={26} className="text-red-500 ml-0.5" />
          </div>

          <h2
            id="disconnect-modal-title"
            className="text-2xl font-heading font-bold text-foreground mb-2"
          >
            {title}
          </h2>

          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
            {message}
          </p>
        </div>

        {/* Modal Action Buttons */}
        <div className="bg-surface-container/80 p-5 pt-3 border-t border-outline-variant/10 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 px-4 rounded-xl font-semibold text-foreground bg-surface-container-highest hover:bg-surface-bright border border-outline-variant/20 hover:border-outline-variant/40 transition-all duration-200 order-2 sm:order-1 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-lg shadow-red-600/25 hover:shadow-red-600/40 transition-all duration-200 flex items-center justify-center gap-2 order-1 sm:order-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Disconnecting...</span>
              </>
            ) : (
              <>
                <LogOut size={16} />
                <span>Disconnect</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
