import React, { useState } from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { Settings, Plus, Phone, Video, VideoOff, Mic, MicOff, Headphones, Image as ImageIcon, Smile, PhoneOff, MonitorUp, Send, MoreVertical, X, UserPlus, PhoneIncoming, MessageSquare, Users, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfileModal, EditGroupModal, AddFriendModal } from '../components/Modals';
import EmojiPicker from 'emoji-picker-react';

export default function Dashboard() {
  const { currentUser, groups, activeGroupId, activeCallGroupId, messages, setActiveGroup, joinCall, leaveCall, leaveGroup, removeFriend, addMessage, navigate, searchQuery, setSearchQuery, isMuted, toggleMute } = useRakchaStore();
  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];
  const groupMessages = activeGroup ? (messages[activeGroup.id] || []) : [];
  const isCallActive = activeCallGroupId === (activeGroup?.id);
  const isAdmin = activeGroup?.adminId === currentUser.id;

  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);

  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      
      {/* 1. Group Sidebar (Left) */}
      <aside className="w-[80px] md:w-[300px] flex flex-col bg-surface-container-low shrink-0 border-r border-outline-variant/10 z-10">
        <header className="h-16 flex items-center px-4 border-b border-outline-variant/10 shrink-0 gap-2">
          <div className="hidden md:flex relative flex-1">
            <input 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chats..." 
              className="w-full bg-surface-container-lowest border-none rounded-lg h-9 px-3 text-sm placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none" 
            />
          </div>
          <button onClick={() => setIsAddFriendOpen(true)} className="w-10 h-10 bg-surface-container-highest text-foreground rounded-xl flex items-center justify-center hover:bg-surface-bright transition shadow-sm shrink-0" title="Add Friend">
            <UserPlus size={20} />
          </button>
          <button onClick={() => navigate('create-join')} className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center font-bold hover:bg-indigo-600 transition shadow-sm shrink-0" title="Add Group">
            <Plus size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-1">
          {filteredGroups.map(g => (
            <div 
              key={g.id} 
              onClick={() => setActiveGroup(g.id)}
              className={cn("flex items-center gap-3 p-2 rounded-xl cursor-pointer transition", activeGroupId === g.id ? "bg-surface-container-highest" : "hover:bg-surface-container")}
            >
              <div className="relative shrink-0">
                <img src={g.icon} alt={g.name} className={cn("object-cover", g.isGroup ? "w-12 h-12 rounded-xl" : "w-12 h-12 rounded-full")} />
                {activeCallGroupId === g.id && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-surface-container-low flex items-center justify-center text-white">
                    <Video size={10} />
                  </div>
                )}
              </div>
              <div className="hidden md:flex flex-col flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-semibold truncate text-[15px]">{g.name}</span>
                  <span className="text-xs text-muted-foreground">12:30</span>
                </div>
                <span className="text-sm text-muted-foreground truncate">
                  {messages[g.id]?.[messages[g.id].length - 1]?.text || "Say hi!"}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* User Footer */}
        <div className="h-16 bg-surface-container-highest border-t border-outline-variant/10 flex items-center px-3 gap-2 shrink-0">
          <div className="relative shrink-0 cursor-pointer" onClick={() => navigate('settings')}>
            <img src={currentUser.avatar} alt="User" className="w-10 h-10 rounded-full hover:opacity-80 transition" />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-surface-container-highest"></div>
          </div>
          <div className="hidden md:flex flex-col flex-1 min-w-0 cursor-pointer" onClick={() => navigate('settings')}>
            <span className="text-sm font-semibold truncate leading-tight">{currentUser.name}</span>
            <span className="text-xs text-muted-foreground truncate">{currentUser.status}</span>
          </div>
          <div className="hidden md:flex shrink-0">
            <IconButton icon={<PhoneIncoming size={16} />} onClick={() => setIncomingCall(true)} title="Simulate Call" />
            <IconButton icon={isMuted ? <MicOff size={18} className="text-red-500"/> : <Mic size={18} />} onClick={toggleMute} title="Toggle Mute" />
            <IconButton icon={<Settings size={18} />} onClick={() => navigate('settings')} title="Settings" />
          </div>
        </div>
      </aside>

      {/* 2. Main Canvas (Center) */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface relative">
        {!activeGroup ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 bg-surface-container-lowest">
            <div className="w-24 h-24 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mb-8 rotate-3 shadow-lg shadow-primary/5">
              <Sparkles size={40} />
            </div>
            <h2 className="text-3xl font-heading font-bold mb-4">Welcome to Rakcha</h2>
            <p className="text-muted-foreground max-w-md mb-10 leading-relaxed text-lg">
              It looks a bit quiet in here. Start your journey by creating a new group, joining a friend's space, or adding a direct message.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => navigate('create-join')} className="bg-primary hover:bg-indigo-600 text-white font-bold py-3.5 px-8 rounded-xl transition shadow-lg shadow-primary/20 flex items-center gap-2">
                <Plus size={20} /> Create or Join Group
              </button>
              <button onClick={() => setIsAddFriendOpen(true)} className="bg-surface-container-high hover:bg-surface-bright text-foreground font-bold py-3.5 px-8 rounded-xl transition border border-outline-variant/20 flex items-center gap-2">
                <UserPlus size={20} /> Add a Friend
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="h-16 flex items-center justify-between px-6 border-b border-outline-variant/10 shrink-0 bg-surface/90 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <img src={activeGroup.icon} alt={activeGroup.name} className={cn("object-cover shrink-0", activeGroup.isGroup ? "w-10 h-10 rounded-lg" : "w-10 h-10 rounded-full")} />
            <div className="flex flex-col">
              <h2 className="font-semibold text-lg leading-tight">{activeGroup.name}</h2>
              <span className="text-xs text-muted-foreground">{activeGroup.members.length} members</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isCallActive ? (
              <button onClick={() => joinCall(activeGroupId)} className="flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-lg font-medium transition">
                <Video size={18} /> <span className="hidden sm:inline">Start Call</span>
              </button>
            ) : (
              <span className="flex items-center gap-2 text-green-500 bg-green-500/10 px-3 py-1 rounded-full text-sm font-semibold animate-pulse">
                <Video size={16} /> Call in progress
              </span>
            )}
            {isAdmin && <IconButton icon={<Settings size={20} />} onClick={() => setIsEditGroupOpen(true)} title="Group Settings" />}
            <div className="relative">
              <IconButton icon={<MoreVertical size={20} />} onClick={() => setIsDropdownOpen(!isDropdownOpen)} />
              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-surface-container-high rounded-xl shadow-2xl border border-outline-variant/20 py-2 z-50 animate-in fade-in zoom-in duration-200">
                    {activeGroup.isGroup ? (
                      <>
                        <button onClick={() => { toggleMute(); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-surface-container-highest transition flex items-center gap-2">
                          {isMuted ? <Mic size={16} /> : <MicOff size={16} />} {isMuted ? 'Unmute Group' : 'Mute Group'}
                        </button>
                        {isAdmin && (
                          <button onClick={() => { setIsEditGroupOpen(true); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-surface-container-highest transition flex items-center gap-2">
                            <Settings size={16} /> Group Details
                          </button>
                        )}
                        <div className="h-[1px] bg-outline-variant/20 my-1"></div>
                        <button onClick={() => { leaveGroup(activeGroupId); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-surface-container-highest transition flex items-center gap-2">
                          <PhoneOff size={16} /> Leave Group
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { toggleMute(); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-surface-container-highest transition flex items-center gap-2">
                          {isMuted ? <Mic size={16} /> : <MicOff size={16} />} {isMuted ? 'Unmute User' : 'Mute User'}
                        </button>
                        <button onClick={() => { 
                          const friendUser = activeGroup.members.find(m => m.id !== currentUser.id) || activeGroup.members[0];
                          setSelectedUser(friendUser);
                          setIsDropdownOpen(false); 
                        }} className="w-full text-left px-4 py-2 text-sm hover:bg-surface-container-highest transition flex items-center gap-2">
                          <UserPlus size={16} /> See Profile
                        </button>
                        <div className="h-[1px] bg-outline-variant/20 my-1"></div>
                        <button onClick={() => { removeFriend(activeGroup.members.find(m => m.id !== currentUser.id)?.id); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-surface-container-highest transition flex items-center gap-2">
                          <PhoneOff size={16} /> Remove Friend
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

            {/* Dynamic Stage */}
            {isCallActive ? (
              <VideoStage activeGroup={activeGroup} onLeave={leaveCall} />
            ) : (
              <ChatStage messages={groupMessages} group={activeGroup} onSendMessage={(text) => addMessage(activeGroup.id, text)} onUserClick={setSelectedUser} currentUser={currentUser} />
            )}
          </>
        )}
      </main>

      {/* 3. Member Sidebar (Right) */}
      <aside className="hidden lg:flex w-[260px] flex-col bg-surface-container-low shrink-0 border-l border-outline-variant/10 py-4 z-10">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 mb-3">Group Members</h3>
        <div className="flex-1 overflow-y-auto px-2">
          {!activeGroup ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <Users size={32} className="text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Select a group or chat to see its members.</p>
            </div>
          ) : (
            activeGroup.members.filter(u => u.id !== currentUser.id).map(user => (
              <div key={user.id} onClick={() => setSelectedUser(user)} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-container cursor-pointer group transition">
                <div className="relative shrink-0">
                  <img src={user.avatar} className="w-9 h-9 rounded-full object-cover" alt={user.name} />
                  {user.status === 'online' && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-surface-container-low group-hover:border-surface-container transition-colors"></div>}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{user.name}</span>
                  {user.bio && <span className="text-[11px] text-muted-foreground truncate">{user.bio}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Modals */}
      <UserProfileModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      <EditGroupModal group={activeGroup} isOpen={isEditGroupOpen} onClose={() => setIsEditGroupOpen(false)} />
      <AddFriendModal isOpen={isAddFriendOpen} onClose={() => setIsAddFriendOpen(false)} />

      {/* Incoming Call Mock */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface-container rounded-3xl p-8 flex flex-col items-center max-w-sm w-full text-center border border-outline-variant/20 shadow-2xl animate-in zoom-in slide-in-from-bottom-8">
            <div className="relative mb-6">
              <img src="https://i.pravatar.cc/150?img=11" alt="Caller" className="w-24 h-24 rounded-full border-4 border-surface-container object-cover" />
              <div className="absolute -bottom-2 -right-2 bg-primary w-8 h-8 rounded-full flex items-center justify-center animate-bounce shadow-lg"><PhoneIncoming size={16} className="text-white" /></div>
            </div>
            <h2 className="text-2xl font-bold mb-1">Incoming Call</h2>
            <p className="text-muted-foreground mb-8">From User in {activeGroup.name}</p>
            <div className="flex gap-4 w-full">
              <button onClick={() => setIncomingCall(false)} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-red-500/20">Decline</button>
              <button onClick={() => { setIncomingCall(false); joinCall(activeGroupId); }} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-green-500/20">Accept</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconButton({ icon, onClick }) {
  return (
    <button onClick={onClick} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors">
      {icon}
    </button>
  );
}

function ChatStage({ messages, group, onSendMessage, onUserClick, currentUser }) {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleSend = (e) => {
    e.preventDefault();
    if (text.trim()) {
      onSendMessage(text);
      setText('');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
        <div className="flex flex-col items-center justify-center text-center mt-10 mb-8">
          <img src={group.icon} className={cn("object-cover mb-4", group.isGroup ? "w-24 h-24 rounded-2xl" : "w-24 h-24 rounded-full")} alt={group.name} />
          <h1 className="text-2xl font-bold mb-1">{group.name}</h1>
          <p className="text-muted-foreground text-sm max-w-sm">This is the beginning of your chat history with {group.name}.</p>
        </div>

        {messages.map(m => {
          if (m.userId === 'system') {
            return (
              <div key={m.id} className="flex justify-center my-2">
                <span className="bg-surface-container-high border border-outline-variant/10 text-xs font-semibold text-muted-foreground px-4 py-1.5 rounded-full shadow-sm">{m.text}</span>
              </div>
            );
          }

          const user = group.members.find(u => u.id === m.userId) || group.members[0];
          const isMe = currentUser.id === m.userId;
          return (
            <div key={m.id} className={`flex gap-4 group/msg transition-colors ${isMe ? 'flex-row-reverse' : ''}`}>
              <img onClick={() => onUserClick(user)} src={user.avatar} className="w-10 h-10 rounded-full shrink-0 cursor-pointer hover:opacity-80 transition" alt="Avatar" />
              <div className={`flex flex-col min-w-0 ${isMe ? 'items-end' : ''}`}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span onClick={() => onUserClick(user)} className="font-semibold text-[15px] hover:underline cursor-pointer">{user.name}</span>
                  <span className="text-[11px] text-muted-foreground">{new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <p className={`leading-relaxed px-4 py-2.5 rounded-2xl inline-block max-w-[85%] ${isMe ? 'bg-primary text-white rounded-tr-sm shadow-md' : 'bg-surface-container-low text-foreground/90 rounded-tl-sm'}`}>{m.text}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-6 pb-6 pt-2 shrink-0">
        <form onSubmit={handleSend} className="bg-surface-container-low border border-outline-variant/20 rounded-2xl flex items-end px-4 py-3 relative focus-within:ring-1 focus-within:border-primary transition-all shadow-sm">
          <label className="text-muted-foreground hover:text-foreground p-1.5 shrink-0 cursor-pointer">
            <Plus size={20} />
            <input type="file" className="hidden" onChange={(e) => { if(e.target.files[0]) onSendMessage(`[Attachment: ${e.target.files[0].name}]`) }} />
          </label>
          <textarea 
            value={text} 
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
            placeholder={`Message ${group.name}...`} 
            className="flex-1 bg-transparent border-none text-foreground placeholder:text-muted-foreground/50 focus:ring-0 focus:outline-none px-3 resize-none max-h-32 min-h-[24px]" 
            rows="1"
          />
          <div className="flex gap-1 shrink-0 items-center">
            <label className="text-muted-foreground hover:text-primary transition p-1.5 cursor-pointer">
              <ImageIcon size={20} />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { if(e.target.files[0]) onSendMessage(`[Image: ${e.target.files[0].name}]`) }} />
            </label>
            
            <div className="relative">
              <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-muted-foreground hover:text-primary transition p-1.5"><Smile size={20} /></button>
              {showEmojiPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)}></div>
                  <div className="absolute bottom-full right-0 mb-2 z-50 animate-in fade-in zoom-in duration-200">
                    <EmojiPicker 
                      theme="dark" 
                      onEmojiClick={(emojiData) => { setText(text + emojiData.emoji); setShowEmojiPicker(false); }} 
                    />
                  </div>
                </>
              )}
            </div>

            <button type="submit" disabled={!text.trim()} className="bg-primary text-white p-1.5 rounded-lg ml-2 disabled:opacity-50 disabled:bg-surface-container-highest transition"><Send size={18} /></button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VideoStage({ activeGroup, onLeave }) {
  const { currentUser, isMuted, isCameraOn, isScreenSharing, toggleMute, toggleCamera, toggleScreenShare } = useRakchaStore();
  const remoteMembers = activeGroup.members.filter(m => m.id !== currentUser.id);

  return (
    <div className="flex-1 flex flex-col bg-[#0B0E14] relative">
      <div className={`flex-1 grid gap-4 p-4 lg:p-8 ${remoteMembers.length > 0 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
        
        {/* Mock Local User Video */}
        <div className="w-full h-full min-h-[200px] bg-surface-container-high rounded-2xl border border-outline-variant/10 flex flex-col items-center justify-center relative overflow-hidden group">
          {isScreenSharing ? (
             <div className="absolute inset-0 bg-primary/20 flex flex-col items-center justify-center text-primary">
               <MonitorUp size={48} className="mb-2" />
               <span className="font-bold">You are sharing your screen</span>
             </div>
          ) : isCameraOn ? (
            <img src={currentUser.avatar} className="w-24 h-24 rounded-full border-4 border-green-500 animate-pulse mb-4 z-10" alt="Me" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-surface-container-highest flex items-center justify-center mb-4 z-10"><VideoOff size={32} className="text-muted-foreground" /></div>
          )}
          <h3 className="font-semibold z-10 bg-black/50 px-3 py-1 rounded-full text-sm">You</h3>
          <div className="absolute top-4 right-4 bg-black/60 p-1.5 rounded-md text-white">
            {isMuted ? <MicOff size={16} className="text-red-500"/> : <Mic size={16} />}
          </div>
        </div>

        {/* Mock Remote User Videos */}
        {remoteMembers.map(member => (
          <div key={member.id} className="w-full h-full min-h-[200px] bg-surface-container-high rounded-2xl border border-outline-variant/10 flex flex-col items-center justify-center relative overflow-hidden group">
            <img src={member.avatar} className="w-24 h-24 rounded-full border-4 border-surface-container-lowest mb-4 z-10" alt={member.name} />
            <h3 className="font-semibold z-10 bg-black/50 px-3 py-1 rounded-full text-sm">{member.name}</h3>
          </div>
        ))}
      </div>
      
      {/* Floating Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-surface-container-highest/90 backdrop-blur-md px-6 py-4 rounded-2xl border border-outline-variant/20 flex items-center gap-6 shadow-2xl">
        <button onClick={toggleMute} className={`flex flex-col items-center gap-1 transition ${isMuted ? 'text-red-500' : 'text-muted-foreground hover:text-white'}`}>
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          <span className="text-[10px] font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>
        <button onClick={toggleCamera} className={`flex flex-col items-center gap-1 transition ${!isCameraOn ? 'text-red-500' : 'text-muted-foreground hover:text-white'}`}>
          {!isCameraOn ? <VideoOff size={24} /> : <Video size={24} />}
          <span className="text-[10px] font-medium">{isCameraOn ? 'Start Video' : 'Stop Video'}</span>
        </button>
        <button onClick={toggleScreenShare} className={`flex flex-col items-center gap-1 transition ${isScreenSharing ? 'text-green-500' : 'text-muted-foreground hover:text-white'}`}>
          <MonitorUp size={24} />
          <span className="text-[10px] font-medium">{isScreenSharing ? 'Stop Share' : 'Share'}</span>
        </button>
        <div className="w-[1px] h-8 bg-outline-variant/30"></div>
        <button onClick={onLeave} className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-xl transition shadow-lg shadow-red-500/20"><PhoneOff size={24} /></button>
      </div>
    </div>
  );
}
