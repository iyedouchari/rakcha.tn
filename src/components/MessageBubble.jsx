import React from 'react';
import DOMPurify from 'dompurify';
import { Reply, Smile, Trash2 } from 'lucide-react';
import { cn, normalizeUsername, DEFAULT_AVATAR } from '../lib/utils';
import { VoicePlayer } from './VoicePlayer';

/**
 * Quoted Reply Snippet inside MessageBubble
 */
function QuotedReply({ reply, isMe, onJumpToReply }) {
  if (!reply) return null;
  const isReplyVoice = reply.media_type === 'audio' || reply.media_url?.includes('/voice_') || reply.media_url?.includes('/vocals/');
  const replySender = reply.profiles?.display_name || reply.profiles?.username || 'User';

  const handleClick = (e) => {
    e.stopPropagation();
    if (onJumpToReply && reply.id) {
      onJumpToReply(reply.id);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Click to jump to replied message"
      className={cn(
        'w-full text-left mb-2 p-2 rounded-lg border-l-2 text-xs opacity-90 flex flex-col gap-0.5 cursor-pointer transition-all duration-150 active:scale-[0.98] select-none group/reply',
        isMe
          ? 'bg-black/20 hover:bg-black/35 border-white/80 text-white'
          : 'bg-surface-container hover:bg-surface-container-high border-primary text-foreground'
      )}
    >
      <div className="flex items-center justify-between gap-1 font-bold opacity-85">
        <div className="flex items-center gap-1 min-w-0">
          <Reply size={11} className="rotate-180 shrink-0 opacity-70 group-hover/reply:opacity-100 transition-opacity" />
          <span className="truncate">{replySender}</span>
        </div>
        <span className="text-[10px] font-normal opacity-60 group-hover/reply:opacity-100 transition-opacity shrink-0">
          Jump ↗
        </span>
      </div>
      <span className="truncate max-w-[240px] opacity-80 pl-3.5">
        {isReplyVoice
          ? '🎤 Voice message'
          : reply.media_url && reply.media_type?.startsWith('image')
          ? '📷 Photo'
          : reply.content || 'Attachment'}
      </span>
    </button>
  );
}

/**
 * MessageBubble Component
 * Renders voice messages with VoicePlayer, images, file attachments, and text
 * with support for replies, reactions, and blocked user masking.
 * Pure JavaScript / JSX.
 */
export default function MessageBubble({
  message,
  currentUser,
  isBlocked = false,
  onReply,
  onReact,
  onDelete,
  onJumpToReply,
  renderReactions,
  renderReactionPicker
}) {
  const m = message;
  const sender = m.profiles || {};
  const isMe = m.sender_id === currentUser?.id;

  const displayAvatar = isMe
    ? currentUser?.avatar_url
    : isBlocked
    ? DEFAULT_AVATAR
    : sender.avatar_url || DEFAULT_AVATAR;

  const displayName = isMe
    ? currentUser?.display_name || currentUser?.username || 'You'
    : isBlocked
    ? 'Rakcha User'
    : sender.display_name || sender.username || 'User';

  const isVoice =
    m.media_type?.startsWith('audio') ||
    m.media_url?.includes('/voice_') ||
    m.media_url?.includes('/vocals/') ||
    /\.(webm|mp4|ogg|m4a|aac|opus)(\?|$)/i.test(m.media_url || '');

  const isImage = m.media_type?.startsWith('image');

  return (
    <div
      id={`anchor-${m.id}`}
      className={cn(
        'flex gap-2.5 group w-full relative chat-message-row',
        isMe ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Sender Avatar for incoming messages */}
      {!isMe && (
        <img
          src={displayAvatar}
          className="w-8 h-8 rounded-full object-cover shrink-0 self-end chat-avatar border border-outline-variant/10 shadow-sm"
          alt={displayName}
        />
      )}

      {/* Bubble Container */}
      <div
        className={cn(
          'flex flex-col max-w-[85%] sm:max-w-[72%] md:max-w-[62%] relative',
          isMe ? 'items-end' : 'items-start'
        )}
      >
        {/* Name & Timestamp Header */}
        <div
          className={cn(
            'flex items-baseline gap-1.5 mb-1 px-1',
            isMe ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          {!isMe && (
            <span className="text-[11px] font-semibold text-foreground/85">
              {displayName}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground font-mono">
            {new Date(m.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>

        {/* The Visual Bubble */}
        <div
          className={cn(
            'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words transition-colors',
            isMe
              ? 'bg-primary text-white rounded-tr-sm shadow-primary/10'
              : 'bg-surface-container-highest text-foreground rounded-tl-sm'
          )}
          style={{
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            ...(isVoice ? { width: '100%', maxWidth: 300, minWidth: 260 } : {})
          }}
        >
          {/* Quoted reply if present */}
          {m.reply_to && <QuotedReply reply={m.reply_to} isMe={isMe} onJumpToReply={onJumpToReply} />}

          {/* Voice Player */}
          {isVoice && m.media_url && (
            <VoicePlayer
              audioUrl={m.media_url}
              waveform={m.waveform}
              duration={m.duration}
              isMe={isMe}
            />
          )}

          {/* Image Attachment */}
          {isImage && m.media_url && (
            <img
              src={m.media_url}
              alt="Attachment"
              className="max-w-xs w-full h-auto rounded-xl cursor-pointer hover:opacity-95 transition"
              onClick={() => window.open(m.media_url, '_blank')}
            />
          )}

          {/* Generic File Download */}
          {m.media_url && !isVoice && !isImage && (
            <a
              href={m.media_url}
              target="_blank"
              rel="noreferrer"
              className="underline font-bold text-xs flex items-center gap-1 hover:text-white transition"
            >
              📎 Download attachment
            </a>
          )}

          {/* Text Message Content (only show if not default voice note placeholder or if user added text) */}
          {m.content && (!isVoice || (m.content !== '🎤 Voice message' && m.content.trim() !== '')) && (
            <div
              className={cn('max-w-full text-sm', (isVoice || isImage) && 'mt-1.5 pt-1 border-t border-white/10')}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(m.content) }}
            />
          )}
        </div>

        {/* Message Reactions */}
        {renderReactions && renderReactions(m.message_reactions, m.id)}

        {/* Outgoing delete button */}
        {isMe && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(m.id)}
            className="text-[10px] text-muted-foreground hover:text-rose-400 transition mt-1 mr-0.5 opacity-0 group-hover:opacity-100 flex items-center gap-0.5"
            title="Delete message"
          >
            <Trash2 size={11} /> Delete
          </button>
        )}
      </div>

      {/* Floating Hover Action Buttons (Reply & Emoji Reactions) */}
      <div
        className={cn(
          'flex items-center gap-0.5 self-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0',
          isMe ? 'mr-1 order-first flex-row-reverse' : 'ml-1'
        )}
      >
        {onReply && (
          <button
            type="button"
            onClick={() => onReply(m)}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-container transition"
            title="Reply"
          >
            <Reply size={15} />
          </button>
        )}

        {renderReactionPicker && renderReactionPicker(m.id)}
      </div>
    </div>
  );
}
