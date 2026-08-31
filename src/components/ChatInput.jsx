import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Smile, Send, Mic, Trash2, X } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { cn } from '../lib/utils';
import { useRakchaStore } from '../store/useRakchaStore';

import VoiceRecorder from './VoiceRecorder';

/**
 * Pure JavaScript ChatInput component
 * Handles debounced typing triggers, instant resets on submit/blur/empty,
 * file uploads, emoji picker, and voice recording with VoiceRecorder.
 */
export function ChatInput({
  group,
  replyTo,
  onClearReply,
  onSendMessage,
  onTypingKeystroke,
  onStopTyping
}) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const textareaRef = useRef(null);

  // Focus textarea when group changes or reply opens
  useEffect(() => {
    if (textareaRef.current && !isRecording) {
      textareaRef.current.focus();
    }
  }, [group?.id, replyTo, isRecording]);

  // Input change handler with active text trigger
  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    if (onTypingKeystroke) {
      onTypingKeystroke(val);
    }
  };

  // Blur handler with instant typing cancellation
  const handleBlur = () => {
    if (onStopTyping) {
      onStopTyping();
    }
  };

  // Send message and clear local & typing states
  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!text.trim() && !file) return;

    if (onStopTyping) {
      onStopTyping();
    }

    onSendMessage(text.trim(), file, null, 0, replyTo?.id);
    setText('');
    setFile(null);
    setShowEmoji(false);
    if (onClearReply) onClearReply();
  };

  // Voice recording send handler
  const handleSendVoice = async ({ audioFile, waveform, duration }) => {
    if (onStopTyping) onStopTyping();
    onSendMessage('', audioFile, waveform, duration, replyTo?.id);
    setIsRecording(false);
    if (onClearReply) onClearReply();
  };

  return (
    <div className="w-full">
      {file && (
        <div className="mb-1.5 px-3 py-2 bg-surface-container rounded-lg flex items-center justify-between text-xs animate-in fade-in">
          <span className="truncate max-w-[200px]">📎 {file.name}</span>
          <button type="button" onClick={() => setFile(null)}>
            <X size={14} className="text-red-500" />
          </button>
        </div>
      )}

      {isRecording ? (
        <VoiceRecorder
          onSend={handleSendVoice}
          onCancel={() => setIsRecording(false)}
        />
      ) : (
        <form
          onSubmit={handleSubmit}
          className={cn(
            'border border-outline-variant/20 flex items-end px-4 py-3 gap-2',
            'focus-within:ring-1 focus-within:border-primary transition shadow-sm',
            replyTo ? 'rounded-b-xl bg-surface-container' : 'rounded-2xl bg-surface-container-low'
          )}
        >
          <label className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0 pb-0.5" title="Attach file">
            <ImageIcon size={20} />
            <input
              type="file"
              className="hidden"
              onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); }}
            />
          </label>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={`Message ${group?.name || ''}…`}
            rows={1}
            className="flex-1 bg-transparent border-none text-foreground placeholder:text-muted-foreground/50 focus:ring-0 focus:outline-none resize-none max-h-32 min-h-[24px] text-sm"
          />

          <div className="flex items-center gap-1 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmoji(!showEmoji)}
                className="text-muted-foreground hover:text-primary transition p-1"
                title="Add emoji"
              >
                <Smile size={20} />
              </button>
              {showEmoji && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowEmoji(false)} />
                  <div className="absolute bottom-full right-0 mb-2 z-50">
                    <EmojiPicker
                      theme="dark"
                      onEmojiClick={d => {
                        const newText = text + d.emoji;
                        setText(newText);
                        if (onTypingKeystroke) onTypingKeystroke(newText);
                        setShowEmoji(false);
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={startRecording}
              className="text-muted-foreground hover:text-red-500 transition p-1.5"
              title="Record voice message"
            >
              <Mic size={20} />
            </button>

            <button
              type="submit"
              disabled={!text.trim() && !file}
              className="bg-primary text-white p-1.5 rounded-lg disabled:opacity-40 transition"
              title="Send message"
            >
              <Send size={17} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
export default ChatInput;
