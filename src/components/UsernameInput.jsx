import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AtSign, Check, AlertCircle, Loader2, Sparkles, HelpCircle } from 'lucide-react';
import {
  sanitizeUsernameBody,
  formatFullUsername,
  validateUsernameFormat,
  checkUsernameAvailability
} from '../utils/validateUsername';

/**
 * UsernameInput Component for Rakcha
 *
 * Implements a permanent, locked '@' prefix username input field
 * enforcing strict '@firstname_lastname' format with real-time sanitization,
 * dynamic feedback messages, and debounced Supabase availability checks.
 *
 * Pure JavaScript / JSX only.
 */
export default function UsernameInput({
  value = '',
  onChange,
  onValidationChange,
  currentUserId = null,
  checkAvailability = true,
  disabled = false,
  autoFocus = false,
  required = false,
  id = 'rakcha-username-input',
  name = 'username',
  label = 'Username Handle',
  showLabel = true,
  placeholder = 'firstname_lastname',
  className = '',
  inputClassName = ''
}) {
  // Local input body state (without '@')
  const [bodyValue, setBodyValue] = useState(() => sanitizeUsernameBody(value));
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [availability, setAvailability] = useState({ checked: false, isAvailable: true, message: '' });

  const checkTimeoutRef = useRef(null);

  // Sync internal bodyValue when external prop changes (e.g. from initial profile load)
  useEffect(() => {
    const incomingBody = sanitizeUsernameBody(value);
    if (incomingBody !== bodyValue) {
      setBodyValue(incomingBody);
    }
  }, [value]);

  // Compute validation state
  const formatValidation = validateUsernameFormat(bodyValue);
  const fullUsername = formatFullUsername(bodyValue);

  // Debounced availability check
  useEffect(() => {
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    if (!bodyValue || !formatValidation.isValid || !checkAvailability) {
      setIsChecking(false);
      setAvailability({ checked: false, isAvailable: true, message: '' });
      if (onValidationChange) {
        onValidationChange({
          isValid: formatValidation.isValid,
          isAvailable: true,
          fullUsername,
          bodyValue
        });
      }
      return;
    }

    setIsChecking(true);
    checkTimeoutRef.current = setTimeout(async () => {
      const res = await checkUsernameAvailability(fullUsername, currentUserId);
      setAvailability({
        checked: true,
        isAvailable: res.isAvailable,
        message: res.message
      });
      setIsChecking(false);

      if (onValidationChange) {
        onValidationChange({
          isValid: formatValidation.isValid && res.isAvailable,
          isAvailable: res.isAvailable,
          fullUsername,
          bodyValue
        });
      }
    }, 350);

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [bodyValue, formatValidation.isValid, fullUsername, currentUserId, checkAvailability]);

  // Real-time Input Sanitization Handler
  const handleInputChange = (e) => {
    setHasInteracted(true);
    const rawVal = e.target.value;
    const sanitized = sanitizeUsernameBody(rawVal);
    setBodyValue(sanitized);

    const full = formatFullUsername(sanitized);
    const validation = validateUsernameFormat(sanitized);

    if (onChange) {
      // Pass full username as 1st argument (for direct state setter or handler)
      // and metadata object as 2nd argument
      onChange(full, {
        body: sanitized,
        isValid: validation.isValid,
        target: { name, value: full }
      });
    }
  };

  // Determine border & glow colors based on state
  const isError = hasInteracted && bodyValue && (!formatValidation.isValid || (!isChecking && availability.checked && !availability.isAvailable));
  const isValidAndAvailable = formatValidation.isValid && !isChecking && (!availability.checked || availability.isAvailable);

  let borderStyle = 'border-white/[0.08] bg-[#0E1015]/90 hover:border-white/[0.15]';
  if (isError) {
    borderStyle = 'border-rose-500/70 ring-2 ring-rose-500/20 bg-[#161013] shadow-[0_0_15px_rgba(244,63,94,0.15)]';
  } else if (isValidAndAvailable && bodyValue) {
    borderStyle = 'border-emerald-500/70 ring-2 ring-emerald-500/20 bg-[#0E1612] shadow-[0_0_15px_rgba(16,185,129,0.15)]';
  } else if (isFocused) {
    borderStyle = 'border-primary/80 ring-2 ring-primary/20 bg-[#161820] shadow-[0_0_20px_rgba(99,102,241,0.2)]';
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {/* Label */}
      {showLabel && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={id}
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 select-none"
          >
            <AtSign
              size={13}
              className={
                isError
                  ? 'text-rose-400'
                  : isValidAndAvailable && bodyValue
                  ? 'text-emerald-400'
                  : isFocused
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }
            />
            {label}
          </label>

          {/* Quick status badge */}
          {isValidAndAvailable && bodyValue && (
            <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              <Check size={11} /> Valid Format
            </span>
          )}
        </div>
      )}

      {/* Input container with locked @ prefix */}
      <div className={`relative rounded-xl border transition-all duration-300 flex items-center overflow-hidden ${borderStyle}`}>
        {/* Permanent Locked Visual '@' Prefix */}
        <div
          className={`px-3 py-3.5 flex items-center justify-center font-mono text-sm font-black select-none pointer-events-none transition-colors border-r ${
            isError
              ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
              : isValidAndAvailable && bodyValue
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : isFocused
              ? 'text-primary bg-primary/10 border-primary/20'
              : 'text-muted-foreground bg-white/[0.02] border-white/[0.06]'
          }`}
          aria-hidden="true"
        >
          @
        </div>

        {/* Text Input for username body */}
        <input
          id={id}
          name={name}
          type="text"
          autoComplete="username"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck="false"
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          value={bodyValue}
          onChange={handleInputChange}
          onFocus={() => {
            setIsFocused(true);
            setHasInteracted(true);
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={`w-full bg-transparent px-3 py-3 text-foreground placeholder:text-muted-foreground/40 focus:outline-none text-sm font-mono font-medium disabled:opacity-50 disabled:cursor-not-allowed ${inputClassName}`}
        />

        {/* Status Indicators in the right corner */}
        <div className="pr-3 flex items-center gap-1.5 select-none pointer-events-none">
          {isChecking && (
            <Loader2 size={16} className="animate-spin text-primary shrink-0" />
          )}

          {!isChecking && isValidAndAvailable && bodyValue && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30"
            >
              <Check size={12} strokeWidth={3} />
            </motion.div>
          )}

          {!isChecking && isError && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30"
            >
              <AlertCircle size={12} />
            </motion.div>
          )}
        </div>
      </div>

      {/* Dynamic Helper & Error Messaging */}
      <div className="min-h-[20px] px-1">
        <AnimatePresence mode="wait">
          {/* 1. Field is empty / untouched */}
          {!bodyValue && (
            <motion.p
              key="empty"
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[11px] text-muted-foreground/70 font-mono flex items-center gap-1"
            >
              <HelpCircle size={11} className="shrink-0" />
              Format: <span className="text-muted-foreground font-semibold">firstname_lastname</span> (e.g., john_doe)
            </motion.p>
          )}

          {/* 2. Checking Supabase availability */}
          {bodyValue && isChecking && (
            <motion.p
              key="checking"
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[11px] text-primary/80 font-mono flex items-center gap-1.5"
            >
              <Loader2 size={11} className="animate-spin shrink-0" />
              Checking availability...
            </motion.p>
          )}

          {/* 3. Username is already taken in Supabase */}
          {bodyValue && !isChecking && availability.checked && !availability.isAvailable && (
            <motion.p
              key="taken"
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[11px] text-rose-400 font-mono font-medium flex items-center gap-1"
            >
              <AlertCircle size={11} className="shrink-0" />
              {availability.message || 'This username is already taken. Please choose another.'}
            </motion.p>
          )}

          {/* 4. Format warning or error (e.g. missing underscore, trailing underscore) */}
          {bodyValue && !formatValidation.isValid && (
            <motion.p
              key="format-error"
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`text-[11px] font-mono flex items-center gap-1 ${
                formatValidation.state === 'warning' ? 'text-amber-400/90' : 'text-rose-400'
              }`}
            >
              <AlertCircle size={11} className="shrink-0" />
              {formatValidation.message}
            </motion.p>
          )}

          {/* 5. Valid and Available */}
          {bodyValue && !isChecking && isValidAndAvailable && (
            <motion.p
              key="success"
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[11px] text-emerald-400 font-mono font-medium flex items-center gap-1"
            >
              <Sparkles size={11} className="shrink-0" />
              {availability.checked && availability.message ? availability.message : 'Username handle is valid.'}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
