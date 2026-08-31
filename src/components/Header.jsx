import React from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { Plus, UserPlus, Bell, Settings, LogOut, Search } from 'lucide-react';
import { normalizeUsername, DEFAULT_AVATAR } from '../lib/utils';

/**
 * Header component
 * Reusable top bar with actions properly ordered:
 * [Search] -> [Create/Join Group] -> [Add Friend / Settings] -> [Notifications Bell (Far Right of Actions)] -> [User Profile / Disconnect]
 */
export default function Header({
  onOpenCreateGroup,
  onOpenAddFriend,
  onOpenNotifications,
  onOpenSettings,
  onOpenDisconnect,
  showSearch = true,
  searchPlaceholder = 'Search groups...',
  className = ''
}) {
  const {
    currentUser,
    searchQuery,
    setSearchQuery,
    friendRequests,
    navigate
  } = useRakchaStore();

  const handleCreateGroup = onOpenCreateGroup || (() => navigate('create-join'));
  const handleAddFriend = onOpenAddFriend;
  const handleNotifications = onOpenNotifications;
  const handleSettings = onOpenSettings || (() => navigate('settings'));
  const handleDisconnect = onOpenDisconnect;

  const unreadCount = friendRequests?.length || 0;

  return (
    <header className={`h-16 flex items-center justify-between px-3 md:px-4 border-b border-outline-variant/10 bg-surface-container-low shrink-0 gap-2 ${className}`}>
      {/* 1. Search Bar */}
      {showSearch && (
        <div className="relative flex-1 max-w-xs md:max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
            <Search size={15} />
          </div>
          <input
            type="text"
            value={searchQuery || ''}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl h-9.5 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
          />
        </div>
      )}

      {/* Action Buttons Group */}
      <div className="flex items-center gap-1.5 md:gap-2 ml-auto">
        {/* 2. Create / Join Group button */}
        <button
          type="button"
          onClick={handleCreateGroup}
          className="w-9 h-9 md:w-9.5 md:h-9.5 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-indigo-600 active:scale-95 transition-all shadow-sm shadow-primary/20 shrink-0"
          title="Create or Join Group"
          aria-label="Create or Join Group"
        >
          <Plus size={18} />
        </button>

        {/* 3. Add Friend button */}
        {handleAddFriend && (
          <button
            type="button"
            onClick={handleAddFriend}
            className="w-9 h-9 md:w-9.5 md:h-9.5 bg-surface-container-highest text-foreground rounded-xl flex items-center justify-center hover:bg-surface-bright active:scale-95 transition-all border border-outline-variant/20 shrink-0"
            title="Add Friend"
            aria-label="Add Friend"
          >
            <UserPlus size={18} />
          </button>
        )}

        {/* 4. Settings button (if provided) */}
        {handleSettings && (
          <button
            type="button"
            onClick={handleSettings}
            className="w-9 h-9 md:w-9.5 md:h-9.5 bg-surface-container-highest text-foreground rounded-xl flex items-center justify-center hover:bg-surface-bright active:scale-95 transition-all border border-outline-variant/20 shrink-0"
            title="Settings"
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>
        )}

        {/* 5. Notification Bell Icon (positioned to the right of the actions) */}
        <button
          type="button"
          onClick={handleNotifications}
          className="relative w-9 h-9 md:w-9.5 md:h-9.5 bg-surface-container-highest text-foreground rounded-xl flex items-center justify-center hover:bg-surface-bright active:scale-95 transition-all border border-outline-variant/20 shrink-0"
          title="Notifications & Invitations"
          aria-label="Notifications"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md ring-2 ring-surface-container-low pointer-events-none animate-in zoom-in duration-150">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* 6. User Profile / Disconnect (if currentUser exists) */}
        {currentUser && (
          <div className="flex items-center gap-2 pl-1 border-l border-outline-variant/15 ml-1">
            <button
              type="button"
              onClick={handleSettings}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-surface-container-highest transition-colors"
              title="Profile & Settings"
            >
              <img
                src={currentUser.avatar_url || DEFAULT_AVATAR}
                alt={currentUser.display_name || 'Profile'}
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
              <span className="hidden lg:inline text-xs font-semibold max-w-[100px] truncate">
                {currentUser.display_name || currentUser.username}
              </span>
            </button>

            {handleDisconnect && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                title="Disconnect"
                aria-label="Disconnect"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
