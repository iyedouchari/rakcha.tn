import React from 'react';

/**
 * Pure JavaScript TypingIndicator component
 * Messenger / Discord style animated 3-dots and formatted text.
 *
 * @param {Array} typingUsers - Array of { userId, username }
 */
export function TypingIndicator({ typingUsers = [] }) {
  if (!typingUsers || typingUsers.length === 0) {
    return (
      <div
        className="h-6 transition-all duration-200 opacity-0 pointer-events-none"
        aria-hidden="true"
      />
    );
  }

  // Format typing label
  let text = '';
  const count = typingUsers.length;

  if (count === 1) {
    text = `${typingUsers[0].username} is typing...`;
  } else if (count === 2) {
    text = `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`;
  } else {
    text = 'Several people are typing...';
  }

  return (
    <div className="flex items-center gap-2.5 px-4 py-1 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-200 min-h-[24px]">
      {/* Bouncing 3-Dot Animation */}
      <div className="flex items-center gap-1 shrink-0 bg-surface-container-high/80 px-2 py-1 rounded-full border border-outline-variant/20 shadow-sm">
        <span
          className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: '0ms', animationDuration: '900ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: '200ms', animationDuration: '900ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: '400ms', animationDuration: '900ms' }}
        />
      </div>

      <span className="font-medium truncate italic select-none">
        {text}
      </span>
    </div>
  );
}
export default TypingIndicator;
