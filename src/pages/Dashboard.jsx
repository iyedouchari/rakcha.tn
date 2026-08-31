import React, { useState, useEffect, useRef } from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { Settings, Plus, Video, VideoOff, Mic, MicOff, Image as ImageIcon, Smile, Phone, PhoneOff, MonitorUp, Send, MoreVertical, X, UserPlus, Users, Sparkles, LogOut, Bell, ArrowLeft, MoreHorizontal, Info, Play, Pause, Trash2, StopCircle, Copy, RefreshCw, Reply, SmilePlus, PhoneCall, Clock, Shield } from 'lucide-react';
import { cn, normalizeUsername, DEFAULT_AVATAR } from '../lib/utils';
import { AddFriendModal, InvitationsPanel, InviteCodeModal, ConfirmModal, UnfriendConfirmModal, BlockUserConfirmModal, DisconnectModal } from '../components/Modals';
import { IncomingCallModal } from '../components/IncomingCallModal';
import { CallUI } from '../components/CallUI';
import { GroupCallUI } from '../components/GroupCallUI';
import EmojiPicker from 'emoji-picker-react';
import DOMPurify from 'dompurify';
import { VoicePlayer } from '../components/VoicePlayer';
import MessageBubble from '../components/MessageBubble';
import { playIncomingRingtone, stopIncomingRingtone } from '../lib/audio';
import { useTypingIndicator } from '../hooks/useTypingIndicator';
import { TypingIndicator } from '../components/TypingIndicator';

function FriendCard({ friend, currentUser, groups, setActiveGroup, onUnfriend, onBlock, onlineUsers, mutedUsers, muteUser, unmuteUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const isMuted = mutedUsers.includes(friend.id);
  const isOnline = onlineUsers.includes(friend.id);

  const handleMessage = async () => {
    // Find DM group
    let dmGroup = groups.find(g => g.type === 'private' && (g.otherUserId === friend.id || g.user1_id === friend.id || g.user2_id === friend.id));
    if (!dmGroup) {
      // Create new DM if not exists
      dmGroup = await useRakchaStore.getState().createDirectMessage(friend.id);
    }
    if (dmGroup) setActiveGroup(dmGroup.id);
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container transition group">
      <div className="relative shrink-0">
        <img src={friend.avatar_url || DEFAULT_AVATAR} alt={friend.display_name} className="w-11 h-11 rounded-full object-cover" />
        {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-surface-container-low" />}
      </div>
      <div className="hidden md:flex flex-col flex-1 min-w-0 cursor-pointer" onClick={handleMessage}>
        <span className="font-semibold text-[14px] truncate">{friend.display_name || friend.username}</span>
        <span className="text-xs text-muted-foreground truncate">@{normalizeUsername(friend.username)}</span>
      </div>
      <div className="hidden md:flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition relative">
        <button onClick={handleMessage} className="p-1.5 text-muted-foreground hover:text-primary transition"><Send size={16} /></button>
        <button onClick={() => setIsOpen(!isOpen)} className="p-1.5 text-muted-foreground hover:text-foreground transition"><MoreVertical size={16} /></button>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 top-8 w-44 bg-surface-container-high rounded-xl shadow-2xl border border-outline-variant/20 py-2 z-50">
              <button onClick={() => { isMuted ? unmuteUser(friend.id) : muteUser(friend.id); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-surface-container-highest flex items-center gap-2">
                {isMuted ? <Mic size={14} /> : <MicOff size={14} />} {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button onClick={() => { onUnfriend(friend); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-surface-container-highest flex items-center gap-2">
                <Trash2 size={14} /> Remove Friend
              </button>
              <button onClick={() => { onBlock(friend); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-crimson hover:bg-surface-container-highest flex items-center gap-2">
                <Shield size={14} /> Block User
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const {
    currentUser, groups, activeGroupId, activeCallGroupId, messages,
    setActiveGroup, clearActiveGroup, initiateCall, endCall, leaveGroup, sendMessage,
    navigate, searchQuery, setSearchQuery, isMuted, toggleMute,
    fetchGroupMembers, fetchMessages, subscribeToGroup,
    mutedUsers, muteUser, unmuteUser, removeFriend, unfriendUser, blockUser, unblockUser, isUserBlocked, settings, regenerateGroupCode,
    activeCallSession, callParticipants, subscribeToCallSession, fetchActiveCallSession,
    joinGroupCall, incomingGroupCall, dismissGroupCall,
  } = useRakchaStore();

  const friendRequests = useRakchaStore(s => s.friendRequests);
  const friends = useRakchaStore(s => s.friends);
  const activeGroup = groups.find(g => g.id === activeGroupId) || null;
  const isCallActive = activeCallGroupId === activeGroup?.id;
  const isGroupCall = isCallActive && activeGroup?.type === 'group';
  const isDMCall = isCallActive && activeGroup?.type === 'private';

  const [groupMembers, setGroupMembers] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isInvitationsOpen, setIsInvitationsOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [unfriendTarget, setUnfriendTarget] = useState(null);
  const [blockTarget, setBlockTarget] = useState(null);
  const [sidebarTab, setSidebarTab] = useState('chats'); // 'chats' | 'friends'
  const onlineUsers = useRakchaStore(s => s.onlineUsers);

  // Fetch members + subscribe to messages when active group changes
  useEffect(() => {
    if (!activeGroupId) return;
    fetchMessages(activeGroupId);
    fetchGroupMembers(activeGroupId).then(members => setGroupMembers(members || []));
    const unsubscribeMessages = subscribeToGroup(activeGroupId);
    const unsubscribeCalls = subscribeToCallSession(activeGroupId);
    // Also fetch current active call session for banner
    fetchActiveCallSession(activeGroupId);
    return () => {
      if (typeof unsubscribeMessages === 'function') unsubscribeMessages();
      if (typeof unsubscribeCalls === 'function') unsubscribeCalls();
    };
  }, [activeGroupId]);

  const handleConfirmDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      await useRakchaStore.getState().signOut();
    } catch (err) {
      console.error("Failed to disconnect:", err);
      navigate('landing');
    } finally {
      setIsDisconnecting(false);
      setIsDisconnectOpen(false);
    }
  };

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes((searchQuery || '').toLowerCase())
  );

  const getGroupAvatar = (g) =>
    g?.avatar_url || DEFAULT_AVATAR;

  const getOtherUserIdInDM = (g) => {
    return g.otherUserId || null;
  };

  const getUserAvatar = (user) =>
    user?.avatar_url || DEFAULT_AVATAR;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      <IncomingCallModal />
      <GroupCallNotification />

      {/* ── Left Sidebar ─────────────────────────────────────── */}
      <aside className={cn(
        "w-full md:w-[280px] flex flex-col bg-surface-container-low shrink-0 border-r border-outline-variant/10 z-10",
        activeGroupId ? "hidden md:flex" : "flex"
      )}>
        {/* Sidebar Header: Reordered with Notifications tab / bell on the right */}
        <header className="h-16 flex items-center px-3 border-b border-outline-variant/10 shrink-0 gap-2">
          {/* 1. Search Box */}
          <div className="hidden md:flex relative flex-1">
            <input
              value={searchQuery || ''}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search groups..."
              className="w-full bg-surface-container-lowest border-none rounded-lg h-9 px-3 text-sm placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
          {/* 2. New Group Button */}
          <button
            type="button"
            onClick={() => navigate('create-join')}
            className="w-9 h-9 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-indigo-600 transition shrink-0 shadow-sm shadow-primary/20"
            title="New Group / Join"
            aria-label="Create or Join Group"
          >
            <Plus size={18} />
          </button>
          {/* 3. Add Friend Button */}
          <button
            type="button"
            onClick={() => setIsAddFriendOpen(true)}
            className="w-9 h-9 bg-surface-container-highest rounded-xl flex items-center justify-center hover:bg-surface-bright transition shrink-0 border border-outline-variant/10"
            title="Add Friend"
            aria-label="Add Friend"
          >
            <UserPlus size={18} />
          </button>
          {/* 4. Notifications Bell Icon (Positioned to the Right) */}
          <button
            type="button"
            onClick={() => setIsInvitationsOpen(true)}
            className="relative w-9 h-9 bg-surface-container-highest rounded-xl flex items-center justify-center hover:bg-surface-bright transition shrink-0 border border-outline-variant/10"
            title="Invitations & Notifications"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {friendRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md ring-2 ring-surface-container-low pointer-events-none animate-in zoom-in duration-150">
                {friendRequests.length > 99 ? '99+' : friendRequests.length}
              </span>
            )}
          </button>
        </header>

        {/* Tabs */}
        <div className="flex px-3 pb-2 gap-2 shrink-0">
          <button 
            onClick={() => setSidebarTab('chats')} 
            className={cn("flex-1 text-xs font-bold py-1.5 rounded-lg transition", sidebarTab === 'chats' ? "bg-surface-container-highest text-foreground" : "text-muted-foreground hover:bg-surface-container")}
          >
            All Chats
          </button>
          <button 
            onClick={() => setSidebarTab('friends')} 
            className={cn("flex-1 text-xs font-bold py-1.5 rounded-lg transition", sidebarTab === 'friends' ? "bg-surface-container-highest text-foreground" : "text-muted-foreground hover:bg-surface-container")}
          >
            Friends
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-1">
          {sidebarTab === 'chats' ? (
            <>
              {filteredGroups.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-center px-4 mt-4">
                  <Users size={28} className="text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No groups yet.</p>
                </div>
              )}
              {filteredGroups.map(g => (
                <div
                  key={g.id}
                  onClick={() => setActiveGroup(g.id)}
                  className={cn('flex items-center gap-3 p-2 rounded-xl cursor-pointer transition', activeGroupId === g.id ? 'bg-surface-container-highest' : 'hover:bg-surface-container')}
                >
                  <div className="relative shrink-0">
                    <img
                      src={getGroupAvatar(g)}
                      alt={g.name}
                      className={cn('w-11 h-11 object-cover', g.type === 'private' ? 'rounded-full' : 'rounded-xl')}
                    />
                    {g.type === 'private' && g.otherUserId && onlineUsers.includes(g.otherUserId) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-surface-container-low" />
                    )}
                  </div>
                  <div className="hidden md:flex flex-col flex-1 min-w-0">
                    <span className="font-semibold truncate text-[14px]">{g.name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {g.type === 'private' ? (g.otherUsername ? `@${normalizeUsername(g.otherUsername)}` : 'Direct Message') : (g.description || 'Group chat')}
                    </span>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {friends.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-center px-4 mt-4">
                  <UserPlus size={28} className="text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No friends yet. Search someone to add them!</p>
                </div>
              )}
              {friends.filter(f => (f.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) || f.username?.toLowerCase().includes(searchQuery.toLowerCase()))).map(friend => (
                <FriendCard 
                  key={friend.id} 
                  friend={friend} 
                  currentUser={currentUser} 
                  groups={groups} 
                  setActiveGroup={setActiveGroup} 
                  onUnfriend={(f) => setUnfriendTarget(f)}
                  onBlock={(f) => setBlockTarget(f)}
                  onlineUsers={onlineUsers} 
                  mutedUsers={mutedUsers} 
                  muteUser={muteUser} 
                  unmuteUser={unmuteUser} 
                />
              ))}
            </>
          )}
        </div>


        {/* User Footer */}
        <div className="mt-auto px-5 py-4 border-t border-outline-variant/10 flex items-center justify-between bg-surface-container-low shrink-0 z-10 relative">
          <img 
            src={currentUser?.avatar_url || DEFAULT_AVATAR}
            alt="My Profile" 
            className="w-10 h-10 rounded-full object-cover shrink-0 cursor-pointer mr-3 md:mr-0"
            onClick={() => navigate('settings')}
          />
          <div className="hidden md:flex flex-col flex-1 min-w-0 cursor-pointer ml-3" onClick={() => navigate('settings')}>
            <span className="text-sm font-semibold truncate">{currentUser?.display_name || currentUser?.username || 'User'}</span>
            <span className="text-xs text-muted-foreground truncate">{currentUser?.username ? `@${normalizeUsername(currentUser.username)}` : ''}</span>
          </div>
          <div className="hidden md:flex gap-1 shrink-0">
            <IconBtn onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? <MicOff size={16} className="text-red-500" /> : <Mic size={16} />}
            </IconBtn>
            <IconBtn onClick={() => navigate('settings')} title="Settings">
              <Settings size={16} />
            </IconBtn>
            <IconBtn onClick={() => setIsDisconnectOpen(true)} title="Log Out / Disconnect">
              <LogOut size={16} className="text-red-500" />
            </IconBtn>
          </div>
        </div>
      </aside>

      {/* ── Main Canvas ──────────────────────────────────────── */}
      <main className={cn(
        "flex-1 flex flex-col min-w-0 bg-surface relative",
        !activeGroupId ? "hidden md:flex" : "flex"
      )}>
        {!activeGroup ? (
          <EmptyState onCreateJoin={() => navigate('create-join')} onAddFriend={() => setIsAddFriendOpen(true)} />
        ) : isGroupCall && activeCallSession ? (
          // ── Group Call View ────────────────────────────────────────────────
          <GroupCallUI
            group={activeGroup}
            currentUser={currentUser}
            session={activeCallSession}
            callParticipants={callParticipants}
          />
        ) : isDMCall ? (
          // ── DM Call View (1-to-1, existing) ───────────────────────────────
          <CallUI group={activeGroup} currentUser={currentUser} onLeave={endCall} />
        ) : (
          <>
            {/* Chat Header */}
            <header className="h-14 flex items-center justify-between px-5 border-b border-outline-variant/10 shrink-0 bg-surface/90 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <button onClick={clearActiveGroup} className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground">
                  <ArrowLeft size={20} />
                </button>
                <img
                  src={
                    activeGroup.type === 'private' && isUserBlocked(activeGroup.otherUserId)
                      ? DEFAULT_AVATAR
                      : getGroupAvatar(activeGroup)
                  }
                  alt={activeGroup.name}
                  className="w-9 h-9 rounded-lg object-cover shrink-0"
                />
                <div className="min-w-0">
                  <h2 className="font-semibold leading-tight truncate">
                    {activeGroup.type === 'private' && isUserBlocked(activeGroup.otherUserId)
                      ? 'Rakcha User'
                      : activeGroup.name}
                  </h2>
                  {activeGroup.type === 'group' ? (
                    <span className="text-xs text-muted-foreground block truncate">{groupMembers.length} member{groupMembers.length !== 1 ? 's' : ''}</span>
                  ) : isUserBlocked(activeGroup.otherUserId) ? (
                    <span className="text-xs text-rose-400 font-mono block truncate">Blocked</span>
                  ) : (
                    <span className="text-xs text-muted-foreground block truncate">
                      {onlineUsers.includes(activeGroup.otherUserId) ? '🟢 Online' : 'Offline'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={activeGroup.type === 'private' && isUserBlocked(activeGroup.otherUserId)}
                  onClick={() => initiateCall(activeGroupId, getOtherUserIdInDM(activeGroup), 'audio')}
                  className="flex items-center gap-1.5 bg-surface-container-highest hover:bg-surface-bright disabled:opacity-40 disabled:pointer-events-none px-3 py-1.5 rounded-lg text-sm font-medium transition"
                  title={activeGroup.type === 'private' && isUserBlocked(activeGroup.otherUserId) ? 'Cannot call a blocked user' : 'Audio Call'}
                >
                  <Phone size={16} /> <span className="hidden sm:inline">Call</span>
                </button>
                <button
                  disabled={activeGroup.type === 'private' && isUserBlocked(activeGroup.otherUserId)}
                  onClick={() => initiateCall(activeGroupId, getOtherUserIdInDM(activeGroup), 'video')}
                  className="flex items-center gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 disabled:pointer-events-none px-3 py-1.5 rounded-lg text-sm font-medium transition"
                  title={activeGroup.type === 'private' && isUserBlocked(activeGroup.otherUserId) ? 'Cannot call a blocked user' : 'Video Call'}
                >
                  <Video size={16} /> <span className="hidden sm:inline">Video</span>
                </button>
                <div className="relative">
                  <IconBtn onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                    <MoreVertical size={18} />
                  </IconBtn>
                  {isDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                      <div className="absolute right-0 top-10 w-44 bg-surface-container-high rounded-xl shadow-2xl border border-outline-variant/20 py-2 z-50 animate-in fade-in zoom-in duration-150">
                        <button onClick={() => { toggleMute(); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-surface-container-highest flex items-center gap-2">
                          {isMuted ? <Mic size={15} /> : <MicOff size={15} />} {isMuted ? 'Unmute' : 'Mute'}
                        </button>
                        <div className="h-px bg-outline-variant/20 my-1" />
                        {activeGroup.type === 'group' ? (
                          <>
                            <button onClick={() => { setIsInviteModalOpen(true); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-surface-container-highest flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Invitation Code
                            </button>
                            <button 
                              onClick={() => { 
                                setIsDropdownOpen(false); 
                                setConfirmAction({
                                  title: 'Leave Group?',
                                  message: `Are you sure you want to leave ${activeGroup.name}? You'll need a new invite code to rejoin.`,
                                  action: () => leaveGroup(activeGroupId)
                                });
                              }} 
                              className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-surface-container-highest flex items-center gap-2"
                            >
                              <PhoneOff size={15} /> Leave Group
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => { 
                                setIsDropdownOpen(false); 
                                setUnfriendTarget({
                                  id: activeGroup.otherUserId,
                                  friendshipId: activeGroup.otherUserId,
                                  display_name: activeGroup.name
                                });
                              }} 
                              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-surface-container-highest flex items-center gap-2"
                            >
                              <Trash2 size={15} /> Remove Friend
                            </button>
                            {isUserBlocked(activeGroup.otherUserId) ? (
                              <button
                                onClick={() => {
                                  setIsDropdownOpen(false);
                                  unblockUser(activeGroup.otherUserId);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-muted-foreground hover:bg-surface-container-highest flex items-center gap-2"
                              >
                                <Shield size={15} /> Unblock User
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setIsDropdownOpen(false);
                                  setBlockTarget({
                                    id: activeGroup.otherUserId,
                                    display_name: activeGroup.name
                                  });
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-crimson hover:bg-surface-container-highest flex items-center gap-2"
                              >
                                <Shield size={15} /> Block User
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </header>

            {/* Ongoing Call Banner — shown when a group call is active but user is not in it */}
            {activeGroup.type === 'group' && activeCallSession && !isCallActive && (
              <OngoingCallBanner
                session={activeCallSession}
                participantCount={callParticipants.length}
                onJoin={() => joinGroupCall(
                  activeCallSession.id,
                  activeGroup.id,
                  activeCallSession.call_type
                )}
              />
            )}

            {/* Chat Stage */}
            <ChatStage
              messages={messages}
              group={activeGroup}
              currentUser={currentUser}
              groupMembers={groupMembers}
              activeCallSession={activeCallSession}
              onJoinCall={() => joinGroupCall(
                activeCallSession?.id,
                activeGroup.id,
                activeCallSession?.call_type
              )}
              onSendMessage={(text, file, waveform, duration, replyToId) => sendMessage({ groupId: activeGroup.id, content: text, file, waveform, duration, replyToId })}
            />
          </>
        )}
      </main>

      {/* ── Right Members Sidebar (Groups Only) ────────────────────────────── */}
      {activeGroup?.type === 'group' && (
        <aside className="hidden lg:flex w-[220px] flex-col bg-surface-container-low shrink-0 border-l border-outline-variant/10 py-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 mb-3">Members ({groupMembers.length})</h3>
        <div className="flex-1 overflow-y-auto px-2 flex flex-col gap-1">
          {groupMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-2">
              <Users size={28} className="text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">Select a group to see members.</p>
            </div>
          ) : (
            groupMembers.map(user => {
              const isBlocked = isUserBlocked(user.id);
              const isMe = user.id === currentUser?.id;
              const memberName = isBlocked ? 'Rakcha User' : (user.display_name || normalizeUsername(user.username));
              const memberAvatar = isBlocked ? DEFAULT_AVATAR : (user.avatar_url || DEFAULT_AVATAR);
              return (
                <div key={user.id} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-surface-container group transition">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={memberAvatar}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                      alt={memberName}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold truncate">{memberName}</span>
                      {isBlocked ? (
                        <span className="text-[10px] text-rose-400 font-mono">[Blocked]</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground truncate">@{normalizeUsername(user.username)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!isMe && (
                      isBlocked ? (
                        <button
                          type="button"
                          onClick={() => unblockUser(user.id)}
                          className="text-[10px] px-2 py-1 rounded bg-white/[0.08] hover:bg-crimson hover:text-white text-muted-foreground transition"
                        >
                          Unblock
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setBlockTarget(user)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-crimson transition rounded"
                          title="Block User"
                        >
                          <Shield size={14} />
                        </button>
                      )
                    )}
                    {onlineUsers.includes(user.id) && !isBlocked && (
                      <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
      )}

      {/* ── Modals ───────────────────────────────────────────── */}
      <AddFriendModal isOpen={isAddFriendOpen} onClose={() => setIsAddFriendOpen(false)} />
      <InvitationsPanel isOpen={isInvitationsOpen} onClose={() => setIsInvitationsOpen(false)} />
      {activeGroup?.type === 'group' && (
        <InviteCodeModal 
          isOpen={isInviteModalOpen} 
          onClose={() => setIsInviteModalOpen(false)} 
          group={activeGroup} 
          currentUser={currentUser} 
          groupMembers={groupMembers} 
          regenerateGroupCode={regenerateGroupCode} 
        />
      )}
      <ConfirmModal
        isOpen={!!confirmAction}
        title={confirmAction?.title}
        message={confirmAction?.message}
        onConfirm={async () => {
          if (confirmAction?.action) await confirmAction.action();
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
      <UnfriendConfirmModal
        isOpen={!!unfriendTarget}
        userName={unfriendTarget?.display_name || unfriendTarget?.username || 'this friend'}
        onConfirm={async () => {
          if (unfriendTarget) {
            await unfriendUser(unfriendTarget.id || unfriendTarget.friendshipId);
            if (activeGroupId === unfriendTarget.id) clearActiveGroup();
            setUnfriendTarget(null);
          }
        }}
        onCancel={() => setUnfriendTarget(null)}
      />
      <BlockUserConfirmModal
        isOpen={!!blockTarget}
        userName={blockTarget?.display_name || blockTarget?.username || 'this user'}
        onConfirm={async () => {
          if (blockTarget) {
            await blockUser(blockTarget.id);
            setBlockTarget(null);
          }
        }}
        onCancel={() => setBlockTarget(null)}
      />
      <DisconnectModal
        isOpen={isDisconnectOpen}
        isLoading={isDisconnecting}
        onClose={() => setIsDisconnectOpen(false)}
        onConfirm={handleConfirmDisconnect}
      />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function IconBtn({ children, onClick, title }) {
  return (
    <button type="button" onClick={onClick} title={title} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors">
      {children}
    </button>
  );
}

function EmptyState({ onCreateJoin, onAddFriend }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
      <div className="w-24 h-24 mb-6 flex items-center justify-center">
        <img
          src="/logo.png"
          alt="Rakcha"
          className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(99,102,241,0.55)]"
        />
      </div>
      <h2 className="text-2xl font-heading font-bold mb-3">Welcome to Rakcha</h2>
      <p className="text-muted-foreground max-w-sm mb-8 text-base leading-relaxed">
        Create a group, join one with a code, or add a friend to start chatting.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={onCreateJoin} className="bg-primary hover:bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl transition shadow-lg flex items-center gap-2">
          <Plus size={18} /> Create or Join Group
        </button>
        <button onClick={onAddFriend} className="bg-surface-container-high hover:bg-surface-bright text-foreground font-bold py-3 px-6 rounded-xl transition border border-outline-variant/20 flex items-center gap-2">
          <UserPlus size={18} /> Add a Friend
        </button>
      </div>
    </div>
  );
}

// ── OngoingCallBanner ────────────────────────────────────────────────────────
function OngoingCallBanner({ session, participantCount, onJoin }) {
  const callTypeLabel = session?.call_type === 'video' ? 'Video Call' : 'Voice Call';

  return (
    <div className="mx-3 mt-2 mb-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600/20 to-green-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 backdrop-blur-sm shrink-0 animate-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative shrink-0">
          <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full" />
          <div className="absolute inset-0 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping opacity-60" />
        </div>
        <div className="min-w-0">
          <span className="text-[13px] font-semibold text-emerald-300">Ongoing {callTypeLabel}</span>
          <span className="text-[11px] text-white/50 ml-2">
            {participantCount > 0 ? `${participantCount} participant${participantCount !== 1 ? 's' : ''}` : 'Starting…'}
          </span>
        </div>
      </div>
      <button
        onClick={onJoin}
        className="shrink-0 bg-emerald-500 hover:bg-emerald-400 text-white text-[12px] font-bold px-3.5 py-1.5 rounded-lg transition shadow-sm shadow-emerald-500/30 flex items-center gap-1.5"
      >
        <PhoneCall size={13} />
        Join
      </button>
    </div>
  );
}

function ChatStage({ messages, group, groupMembers, onSendMessage, currentUser, activeCallSession, onJoinCall }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [activeReactMsgId, setActiveReactMsgId] = useState(null);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  const { deleteMessage, addReaction, removeReaction, isUserBlocked, unblockUser, settings } = useRakchaStore();
  const { activeTypingUsers, handleTypingKeystroke, stopTyping } = useTypingIndicator(group?.id, currentUser, messages);
  const isOtherBlocked = group.type === 'private' && isUserBlocked(group.otherUserId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!text.trim() && !file) return;
    stopTyping();
    onSendMessage(text.trim(), file, null, 0, replyTo?.id);
    setText('');
    setFile(null);
    setReplyTo(null);
  };

  const startRecording = async () => {
    try {
      stopTyping();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerIntervalRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      useRakchaStore.getState().showToast('Could not access microphone.', 'error');
    }
  };

  const stopRecording = (cancel = false) => {
    if (!mediaRecorderRef.current || !isRecording) return;
    mediaRecorderRef.current.onstop = async () => {
      const tracks = mediaRecorderRef.current.stream.getTracks();
      tracks.forEach(t => t.stop());
      if (!cancel && audioChunksRef.current.length > 0) {
        const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        const audioFile = new File([blob], `voice_message.${ext}`, { type: mimeType });

        let waveform = [];
        let dur = 0;
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
          dur = buf.duration;
          const raw = buf.getChannelData(0);
          const samples = 30;
          const blockSize = Math.floor(raw.length / samples);
          for (let i = 0; i < samples; i++) {
            let sum = 0;
            for (let j = 0; j < blockSize; j++) sum += Math.abs(raw[i * blockSize + j]);
            waveform.push(sum / blockSize);
          }
          const max = Math.max(...waveform, 0.001);
          waveform = waveform.map(n => n / max);
        } catch (err) {
          console.error('Waveform error', err);
        }
        onSendMessage('', audioFile, waveform, dur, replyTo?.id);
        setReplyTo(null);
      }
      setIsRecording(false);
      setRecordingTime(0);
      audioChunksRef.current = [];
    };
    mediaRecorderRef.current.stop();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    handleTypingKeystroke(val);
  };

  const handleEmojiReact = async (messageId, emoji) => {
    const msg = messages.find(m => m.id === messageId);
    const existing = msg?.message_reactions?.find(r => r.user_id === currentUser.id && r.emoji === emoji);
    if (existing) await removeReaction(messageId, emoji);
    else await addReaction(messageId, emoji);
    setActiveReactMsgId(null);
  };

  const renderReactions = (reactions, messageId) => {
    if (!reactions?.length) return null;
    const grouped = reactions.reduce((acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = [];
      acc[r.emoji].push(r);
      return acc;
    }, {});
    return (
      <div className="flex flex-wrap gap-1 mt-1.5">
        {Object.entries(grouped).map(([emoji, reacts]) => {
          const hasMine = reacts.some(r => r.user_id === currentUser.id);
          return (
            <button
              key={emoji}
              onClick={() => handleEmojiReact(messageId, emoji)}
              title={reacts.map(r => r.profiles?.display_name || r.profiles?.username).join(', ')}
              className={cn(
                'px-2 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1 transition-all',
                hasMine
                  ? 'bg-primary/20 border-primary/40 text-primary shadow-sm'
                  : 'bg-surface-container border-outline-variant/30 text-foreground hover:bg-surface-bright'
              )}
            >
              <span>{emoji}</span>
              <span className="text-[10px]">{reacts.length}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const scrollToMessage = (id) => {
    if (!id) return;
    const el = document.getElementById(`anchor-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('highlight-message-pulse');
      void el.offsetWidth; // Restart CSS pulse animation
      el.classList.add('highlight-message-pulse');
      setTimeout(() => {
        el.classList.remove('highlight-message-pulse');
      }, 2000);
    }
  };

  const replyPreviewLabel = (msg) => {
    if (!msg) return '';
    if (msg.media_type?.startsWith('audio')) return '🎤 Voice message';
    if (msg.media_type?.startsWith('image')) return '🖼️ Image';
    return msg.content || '📎 Attachment';
  };


  return (
    <div className={cn(
      "flex-1 flex flex-col min-w-0 overflow-hidden relative",
      settings?.chatDensity === 'compact' ? 'density-compact' : 'density-cozy'
    )}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-3">
        <div className="flex flex-col items-center text-center my-6">
          <img
            src={
              group.type === 'private' && isOtherBlocked
                ? DEFAULT_AVATAR
                : (group.avatar_url || DEFAULT_AVATAR)
            }
            className="w-16 h-16 rounded-2xl object-cover mb-3 shadow"
            alt={group.type === 'private' && isOtherBlocked ? 'Rakcha User' : group.name}
          />
          <h1 className="text-lg font-bold mb-0.5">
            {group.type === 'private' && isOtherBlocked ? 'Rakcha User' : group.name}
          </h1>
          <p className="text-muted-foreground text-xs">
            {isOtherBlocked ? 'This user is currently blocked' : (group.description || 'Start chatting!')}
          </p>
        </div>

        {messages.map(m => {
          // ── System / Call event pill ─────────────────────────────────────
          if (m.message_type && m.message_type !== 'message') {
            return (
              <SystemEventPill
                key={m.id}
                message={m}
                activeCallSession={activeCallSession}
                onJoinCall={onJoinCall}
              />
            );
          }

          // ── Normal message bubble ────────────────────────────────────────
          const isSenderBlocked = m.sender_id !== currentUser?.id && isUserBlocked(m.sender_id);

          return (
            <MessageBubble
              key={m.id}
              message={m}
              currentUser={currentUser}
              isBlocked={isSenderBlocked}
              onReply={setReplyTo}
              onDelete={deleteMessage}
              onJumpToReply={scrollToMessage}
              renderReactions={renderReactions}
              renderReactionPicker={(msgId) => (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveReactMsgId(activeReactMsgId === msgId ? null : msgId)}
                    className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-container transition"
                    title="React"
                  >
                    <SmilePlus size={15} />
                  </button>
                  {activeReactMsgId === msgId && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveReactMsgId(null)} />
                      <div
                        className={cn(
                          'absolute bottom-full mb-1 z-50 shadow-2xl rounded-xl overflow-hidden border border-outline-variant/20',
                          m.sender_id === currentUser?.id ? 'right-0' : 'left-0'
                        )}
                      >
                        <EmojiPicker
                          theme="dark"
                          width={280}
                          height={300}
                          onEmojiClick={(d) => handleEmojiReact(msgId, d.emoji)}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            />
          );
        })}

        <TypingIndicator typingUsers={activeTypingUsers} />

        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-4 pt-2 shrink-0 bg-surface">
        {replyTo && (
          <div className="mb-1.5 px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-t-xl flex items-center justify-between gap-2 text-xs animate-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <Reply size={13} className="text-primary shrink-0" />
              <span className="font-semibold text-primary shrink-0">
                Replying to {replyTo.profiles?.display_name || replyTo.profiles?.username}:
              </span>
              <span className="text-muted-foreground truncate">
                {replyPreviewLabel(replyTo)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="p-1 rounded-full hover:bg-surface-container-highest transition shrink-0"
            >
              <X size={13} className="text-muted-foreground" />
            </button>
          </div>
        )}

        {file && (
          <div className="mb-1.5 px-3 py-2 bg-surface-container rounded-lg flex items-center justify-between text-xs">
            <span className="truncate max-w-[200px]">📎 {file.name}</span>
            <button type="button" onClick={() => setFile(null)}>
              <X size={14} className="text-red-500" />
            </button>
          </div>
        )}

        {isOtherBlocked ? (
          <div className="p-4 rounded-2xl bg-surface-container-high/60 border border-white/[0.08] flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2 text-rose-300 font-medium">
              <Shield size={16} className="text-crimson shrink-0" />
              <span>You have blocked this user. Unblock to send messages.</span>
            </div>
            <button
              type="button"
              onClick={() => unblockUser(group.otherUserId)}
              className="px-3.5 py-1.5 rounded-xl font-bold bg-white/[0.08] hover:bg-crimson hover:text-white transition text-xs shrink-0"
            >
              Unblock
            </button>
          </div>
        ) : isRecording ? (
          <div className={cn(
            'border border-red-500/40 flex items-center justify-between px-4 py-3',
            replyTo ? 'rounded-b-xl bg-surface-container' : 'rounded-2xl bg-surface-container-low'
          )}>
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
              <span className="text-red-500 font-bold font-mono text-sm">
                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
              </span>
              <span className="text-sm text-muted-foreground">Recording…</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => stopRecording(true)}
                className="p-2 text-muted-foreground hover:text-red-500 transition rounded-full hover:bg-red-500/10"
              >
                <Trash2 size={17} />
              </button>
              <button
                onClick={() => stopRecording(false)}
                className="p-2 bg-primary text-white hover:bg-indigo-600 transition rounded-full shadow"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSend}
            className={cn(
              'border border-outline-variant/20 flex items-end px-4 py-3 gap-2',
              'focus-within:ring-1 focus-within:border-primary transition shadow-sm',
              replyTo ? 'rounded-b-xl bg-surface-container' : 'rounded-2xl bg-surface-container-low'
            )}
          >
            <label className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0 pb-0.5">
              <ImageIcon size={20} />
              <input
                type="file"
                className="hidden"
                onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); }}
              />
            </label>

            <textarea
              value={text}
              onChange={handleTextChange}
              onBlur={() => stopTyping()}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
              }}
              placeholder={`Message ${group.name}…`}
              rows={1}
              className="flex-1 bg-transparent border-none text-foreground placeholder:text-muted-foreground/50 focus:ring-0 focus:outline-none resize-none max-h-32 min-h-[24px] text-sm"
            />

            <div className="flex items-center gap-1 shrink-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmoji(!showEmoji)}
                  className="text-muted-foreground hover:text-primary transition p-1"
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
                          handleTypingKeystroke(newText);
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
              >
                <Mic size={20} />
              </button>

              <button
                type="submit"
                disabled={!text.trim() && !file}
                className="bg-primary text-white p-1.5 rounded-lg disabled:opacity-40 transition"
              >
                <Send size={17} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── SystemEventPill ──────────────────────────────────────────────────────────
// Renders system/call events as centered, pill-style notices in the feed.
// No avatar, no directional alignment, no message bubble.
function SystemEventPill({ message, activeCallSession, onJoinCall }) {
  const isCallStart = message.message_type === 'call_start';
  const isCallEnd   = message.message_type === 'call_end';
  const isSystem    = message.message_type === 'system';

  // Is this call_start message for a STILL active session?
  const isActiveCall = isCallStart
    && activeCallSession
    && activeCallSession.id === message.call_session_id;

  return (
    <div className="flex items-center justify-center w-full py-1 px-4 select-none">
      <div
        className={cn(
          'flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-medium text-muted-foreground/70',
          'bg-surface-container/50 border border-outline-variant/10 backdrop-blur-sm',
          isCallStart && 'text-emerald-400/80 bg-emerald-500/5 border-emerald-500/15',
          isCallEnd   && 'text-white/30 bg-surface-container/30',
        )}
      >
        {/* Icon */}
        {isCallStart && <PhoneCall size={11} className="shrink-0 text-emerald-400/70" />}
        {isCallEnd   && <Clock size={11} className="shrink-0 text-white/30" />}

        {/* Content text */}
        <span>{message.content}</span>

        {/* Join button — only on active call_start */}
        {isActiveCall && onJoinCall && (
          <button
            onClick={onJoinCall}
            className="ml-1 bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full transition"
          >
            Join
          </button>
        )}
      </div>
    </div>
  );
}

// ── GroupCallNotification ────────────────────────────────────────────────────
// Accept / Decline modal for incoming group calls.
// Mirrors IncomingCallModal style. IncomingCallModal is NOT modified.
function GroupCallNotification() {
  const incomingGroupCall = useRakchaStore(s => s.incomingGroupCall);
  const dismissGroupCall  = useRakchaStore(s => s.dismissGroupCall);
  const joinGroupCall     = useRakchaStore(s => s.joinGroupCall);

  React.useEffect(() => {
    if (incomingGroupCall) {
      try { playIncomingRingtone(); } catch(e) {}
    } else {
      try { stopIncomingRingtone(); } catch(e) {}
    }
    return () => { try { stopIncomingRingtone(); } catch(e) {} };
  }, [incomingGroupCall]);

  if (!incomingGroupCall) return null;

  const { session_id, group_id, group_name, group_avatar, call_type, starter_name } = incomingGroupCall;
  const isVideo = call_type === 'video';
  const avatar  = group_avatar || DEFAULT_AVATAR;

  const handleAccept = async () => {
    dismissGroupCall();
    await joinGroupCall(session_id, group_id, call_type);
    useRakchaStore.getState().setActiveGroup(group_id);
  };

  const handleDecline = () => {
    dismissGroupCall();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-container-high w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/20 animate-in slide-in-from-top-10 duration-300">
        <div className="p-6 flex flex-col items-center text-center relative">
          <div className="absolute top-0 left-0 w-full h-24 bg-emerald-500/10 blur-3xl -z-10" />

          <img
            src={avatar}
            alt={group_name}
            className="w-20 h-20 rounded-2xl object-cover border-4 border-surface-container shadow-xl mb-4 animate-bounce"
          />

          <h2 className="text-xl font-bold mb-1">{group_name}</h2>
          <p className="text-muted-foreground text-sm mb-0.5">
            {starter_name} started a group call
          </p>
          <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-sm">
            {isVideo ? <Video size={15} /> : <Phone size={15} />}
            Incoming group {isVideo ? 'video' : 'voice'} call…
          </p>
        </div>

        <div className="bg-surface-container p-6 flex items-center justify-center gap-8">
          <button
            onClick={handleDecline}
            className="flex flex-col items-center gap-2 text-muted-foreground hover:text-white transition group"
          >
            <div className="w-14 h-14 rounded-full bg-red-500/10 group-hover:bg-red-500 flex items-center justify-center transition-colors">
              <PhoneOff size={24} className="text-red-500 group-hover:text-white" />
            </div>
            <span className="text-sm font-medium">Decline</span>
          </button>

          <button
            onClick={handleAccept}
            className="flex flex-col items-center gap-2 text-muted-foreground hover:text-white transition group"
          >
            <div className="w-14 h-14 rounded-full bg-green-500/10 group-hover:bg-green-500 flex items-center justify-center transition-colors shadow-lg shadow-green-500/20 animate-pulse">
              {isVideo
                ? <Video size={24} className="text-green-500 group-hover:text-white" />
                : <Phone size={24} className="text-green-500 group-hover:text-white" />
              }
            </div>
            <span className="text-sm font-medium">Join</span>
          </button>
        </div>
      </div>
    </div>
  );
}
