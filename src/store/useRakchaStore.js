import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// Helper to safely set hash without triggering an infinite loop
const setHash = (page) => {
  if (window.location.hash !== `#/${page}`) {
    window.location.hash = `#/${page}`;
  }
};

export const DEFAULT_SETTINGS = {
  theme: 'dark-slate', // 'dark-slate' | 'oled-black' | 'midnight-purple'
  accentColor: 'indigo', // 'indigo' | 'crimson' | 'emerald' | 'violet'
  chatDensity: 'cozy', // 'cozy' | 'compact'
  fontSize: 15, // 13 - 18
  reducedMotion: false,
  // Hardware & WebRTC
  selectedAudioInputId: '',
  selectedAudioOutputId: '',
  selectedVideoInputId: '',
  micGain: 100,
  masterVolume: 100,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  videoResolution: '720p', // '720p' | '1080p' | '480p'
  // Privacy & Safety
  dmScope: 'all', // 'all' | 'friends_only'
  showCallPresence: true,
  showTypingIndicators: true,
  showVoiceReceipts: true,
};

export const getStoredSettings = () => {
  try {
    const raw = localStorage.getItem('rakcha_settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {}
  return DEFAULT_SETTINGS;
};

export const useRakchaStore = create((set, get) => ({
  currentPage: window.location.hash.replace('#/', '') || 'landing',
  
  currentUser: null,
  session: null,
  groups: [],
  activeGroupId: null,
  activeCallGroupId: null,

  // ── Settings & Personalization ───────────────────────────────────────────
  settings: getStoredSettings(),

  // ── Blocked Users ────────────────────────────────────────────────────────
  blockedUsers: [], // Array of { id, blocker_id, blocked_id, created_at, profile }

  // ── Group call state ──────────────────────────────────────────────────────
  activeCallSession: null,      // { id, group_id, call_type, started_by, started_at, participant_count }
  callParticipants: [],         // [{ user_id, display_name, avatar_url }]
  groupCallSubscription: null,  // realtime channel tracking call_sessions for active group
  incomingGroupCall: null,      // { session_id, group_id, group_name, group_avatar, call_type, starter_name }
  // ─────────────────────────────────────────────────────────────────────────

  searchQuery: '',
  isMuted: false,
  isCameraOn: true,
  isScreenSharing: false,

  incomingCall: null, // { callerId, callerName, callerAvatar, groupId, callType } — DM calls only
  activeCallType: 'video', // 'video' | 'audio'
  isCaller: false,

  messages: [], // Array of messages for the active group
  friendRequests: [], // Pending incoming friend requests
  friends: [], // Accepted friends
  mutedUsers: [], // Array of muted user IDs

  onlineUsers: [], // Array of online user IDs
  globalSubscription: null,
  typingUsers: {}, // { groupId: [ {userId, username} ] }
  activeGroupSubscription: null,
  
  // Toast notifications
  toast: null,
  showToast: (message, type = 'info') => {
    set({ toast: { message, type } });
    setTimeout(() => {
      set((state) => (state.toast?.message === message ? { toast: null } : state));
    }, 4000);
  },
  hideToast: () => set({ toast: null }),
  
  // Navigation
  navigate: (page) => set((state) => {
    setHash(page);
    return { currentPage: page };
  }),
  syncRoute: (page) => set({ currentPage: page }),

  // Auth & User Session
  initAuth: () => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session });
      if (session) {
        let { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (error || !profile) {
          // Sanitize username to match DB constraints
          let safeUsername = session.user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
          if (safeUsername.length < 2) safeUsername += '_user';
          // Always append a random string to guarantee uniqueness
          safeUsername += '_' + Math.random().toString(36).substring(2, 8);
          safeUsername = safeUsername.substring(0, 30);
          
          let { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              username: safeUsername,
              display_name: session.user.email.split('@')[0],
            })
            .select()
            .single();
            
          if (insertError) {
             console.error("Failed to insert fallback profile:", insertError);
             // If insert fails, try fetching one last time just in case it was created concurrently
             const { data: retryProfile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
             newProfile = retryProfile;
          }
          profile = newProfile;
        }
        
        // Recover active call from sessionStorage if present
        const savedCall = sessionStorage.getItem('activeCall');
        if (savedCall) {
          try {
            const callData = JSON.parse(savedCall);
            set({ 
              activeCallGroupId: callData.groupId, 
              activeCallType: callData.callType, 
              isCaller: callData.isCaller,
              isCameraOn: callData.callType === 'video'
            });
            // We set the activeGroup to match so the UI immediately shows the CallUI
            set({ activeGroupId: callData.groupId });
          } catch (e) {
            sessionStorage.removeItem('activeCall');
          }
        }
        
        if (profile) {
          profile.banner_color = profile.banner_color || localStorage.getItem(`rakcha_banner_${profile.id}`) || 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)';
        }
        set({ currentUser: profile });
        get().applySettingsToDOM();
        get().fetchUserGroups();
        get().fetchFriendRequests();
        get().fetchFriends();
        get().fetchMutedUsers();
        get().fetchBlockedUsers();
        get().initRealtimeGlobal();
      } else {
        const { globalSubscription, groupCallSubscription } = get();
        if (globalSubscription) supabase.removeChannel(globalSubscription);
        if (groupCallSubscription) supabase.removeChannel(groupCallSubscription);
        set({
          currentUser: null, groups: [], messages: [], friendRequests: [],
          friends: [], mutedUsers: [], blockedUsers: [], onlineUsers: [], globalSubscription: null,
          activeCallSession: null, callParticipants: [], groupCallSubscription: null,
        });
      }
    });
  },

  initRealtimeGlobal: () => {
    const user = get().currentUser;
    if (!user) return;

    // Clean up existing if any
    const existing = get().globalSubscription;
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase.channel('global_system')
      // Presence for online status
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineIds = Object.values(state).map((presenceArray) => presenceArray[0].user_id);
        set({ onlineUsers: onlineIds });
      })
      // Listen for DM creation broadcasts
      .on('broadcast', { event: 'dm_created' }, async ({ payload }) => {
        if (payload && payload.targetUserId === user.id && payload.joinCode) {
           await supabase.rpc('join_group_by_code', { code_input: payload.joinCode }).then().catch(() => {});
           get().fetchUserGroups();
        }
      })
      // Listen for incoming call
      .on('broadcast', { event: 'call_offer' }, ({ payload }) => {
        if (payload && payload.targetUserId === user.id) {
          set({ incomingCall: payload });
        }
      })
      // Listen for caller cancelling before accept
      .on('broadcast', { event: 'call_cancel' }, ({ payload }) => {
        if (payload && payload.targetUserId === user.id) {
          set({ incomingCall: null });
        }
      })
      // Listen for receiver declining
      .on('broadcast', { event: 'call_decline' }, ({ payload }) => {
        if (payload && payload.targetUserId === user.id) {
          set({ activeCallGroupId: null });
          get().showToast('Call declined', 'info');
        }
      })
      // Listen for new friend requests or updates
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${user.id}` }, (payload) => {
        get().fetchFriendRequests();
        get().fetchFriends();
      })
      // Listen to accepted friend requests (when YOU sent it and they accept)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `sender_id=eq.${user.id}` }, (payload) => {
        get().fetchFriendRequests();
        get().fetchFriends();
      })
      // Listen to new group memberships (e.g. accepted DM, or added to group)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_members', filter: `user_id=eq.${user.id}` }, (payload) => {
        get().fetchUserGroups();
      })
      // Listen to deleted group memberships (e.g. unfriend)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_members', filter: `user_id=eq.${user.id}` }, (payload) => {
        get().fetchUserGroups();
        if (get().activeGroupId === payload.old.group_id) {
          get().clearActiveGroup();
        }
      })
      // Listen to muted_users updates
      .on('postgres_changes', { event: '*', schema: 'public', table: 'muted_users', filter: `user_id=eq.${user.id}` }, (payload) => {
        get().fetchMutedUsers();
      })
      // Listen to blocked_users updates
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_users', filter: `blocker_id=eq.${user.id}` }, (payload) => {
        get().fetchBlockedUsers();
        get().fetchFriends();
        get().fetchUserGroups();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id });
        }
      });

    set({ globalSubscription: channel });
  },

  // Friend Requests
  fetchFriendRequests: async () => {
    const user = get().currentUser;
    if (!user) return;
    const { data, error } = await supabase
      .from('friend_requests')
      .select('*, sender:profiles!friend_requests_sender_id_fkey(id, username, display_name, avatar_url)')
      .eq('receiver_id', user.id)
      .eq('status', 'pending');
    if (!error && data) set({ friendRequests: data });
  },

  fetchFriends: async () => {
    const user = get().currentUser;
    if (!user) return;
    
    // Fetch all accepted requests involving the user
    const { data: requests, error } = await supabase
      .from('friend_requests')
      .select('*, sender:profiles!friend_requests_sender_id_fkey(*), receiver:profiles!friend_requests_receiver_id_fkey(*)')
      .eq('status', 'accepted')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
      
    if (error || !requests) return;
    
    // Extract the other profile
    const friendsList = requests.map(req => {
      const isSender = req.sender_id === user.id;
      const friendProfile = isSender ? req.receiver : req.sender;
      return {
        ...friendProfile,
        friendshipId: req.id,
      };
    });
    
    set({ friends: friendsList });
  },

  searchUsers: async (query) => {
    const currentUser = get().currentUser;
    if (!currentUser || !query || query.trim() === '') return [];
    
    // Search strictly by username as requested
    const cleanQuery = query.replace('@', '').trim();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .neq('id', currentUser.id)
      .ilike('username', `%${cleanQuery}%`)
      .limit(10);
      
    if (error) throw error;
    
    // Fetch friend requests to determine relationship status
    const { data: requests, error: reqErr } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status')
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
      
    if (reqErr) throw reqErr;

    return data.map(user => {
      // Find any relationship with this user
      const relationship = requests?.find(r => r.sender_id === user.id || r.receiver_id === user.id);
      
      let relationshipStatus = 'none';
      if (relationship) {
        if (relationship.status === 'accepted') relationshipStatus = 'friends';
        else if (relationship.status === 'pending') {
          relationshipStatus = relationship.sender_id === currentUser.id ? 'request_sent' : 'request_received';
        }
      }
      
      return {
        ...user,
        relationshipStatus,
        requestId: relationship?.id // Store request ID if needed
      };
    });
  },

  sendFriendRequest: async (targetId) => {
    const currentUser = get().currentUser;
    if (targetId === currentUser.id) throw new Error('You cannot send a friend request to yourself.');

    // Check if a pending request already exists
    const { data: existing, error: fetchErr } = await supabase
      .from('friend_requests')
      .select('id, status')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${currentUser.id})`)
      .maybeSingle();
      
    if (existing) {
      if (existing.status === 'pending') throw new Error('A friend request is already pending with this user.');
      if (existing.status === 'accepted') throw new Error('You are already friends with this user.');
    }

    const { error } = await supabase
      .from('friend_requests')
      .insert({ sender_id: currentUser.id, receiver_id: targetId, status: 'pending' });
    
    if (error) {
      if (error.code === '23505') {
        throw new Error('A friend request is already pending or you are already friends.');
      }
      throw error;
    }
  },

  acceptFriendRequest: async (requestId) => {
    // Fetch the request first to get the sender's id
    const { data: req, error: reqErr } = await supabase
      .from('friend_requests')
      .select('sender_id, receiver_id')
      .eq('id', requestId)
      .single();
    if (reqErr) throw reqErr;

    // Mark as accepted
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId);
    if (error) throw error;

    let newGroupId = null;
    const currentUser = get().currentUser;
    
    // Generate deterministic join_code (still useful as unique identifier)
    const sortedIds = [currentUser.id, req.sender_id].sort();
    const joinCode = `DM_${sortedIds[0].substring(0,8)}_${sortedIds[1].substring(0,8)}`.toUpperCase();

    // Check if the group already exists via code
    const { data: existingGroup } = await supabase.from('groups').select('id').eq('code', joinCode).single();

    if (existingGroup) {
      newGroupId = existingGroup.id;
    } else {
      // Create the DM group with user1_id and user2_id explicitly set
      // Fetch other user's name
      const { data: otherUser } = await supabase.from('profiles').select('display_name, username').eq('id', req.sender_id).single();
      const otherName = otherUser?.display_name || otherUser?.username || 'User';

      const { data: newGroup, error: groupErr } = await supabase
        .from('groups')
        .insert({
          name: 'DM with ' + otherName,
          type: 'private',
          code: joinCode,
          creator_id: currentUser.id,
          user1_id: currentUser.id,
          user2_id: req.sender_id
        })
        .select()
        .single();

      if (groupErr) {
        console.error("Group creation failed:", groupErr);
        throw new Error(`Failed to create conversation group: ${groupErr.message}`);
      }
      newGroupId = newGroup.id;
      // Note: We DO NOT add members to `group_members` for DMs anymore
    }

    // Broadcast to the other user so they can join immediately if online
    const channel = get().globalSubscription;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'dm_created',
        payload: { targetUserId: req.sender_id, joinCode: joinCode }
      });
    }

    if (newGroupId) {
      // Navigate to the new DM immediately
      await get().fetchUserGroups();
      set({ activeGroupId: newGroupId });
    }

    get().fetchFriendRequests();
    get().fetchFriends();
  },

  openDirectMessage: async (targetId) => {
    const currentUser = get().currentUser;
    if (!currentUser) return;
    
    // Find the DM room
    const { data: dmGroup } = await supabase
      .from('groups')
      .select('id')
      .eq('type', 'private')
      .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${targetId}),and(user1_id.eq.${targetId},user2_id.eq.${currentUser.id})`)
      .maybeSingle();

    if (dmGroup) {
      set({ activeGroupId: dmGroup.id });
    } else {
      throw new Error("Direct message room not found. Please try adding them as a friend again.");
    }
  },

  removeFriend: async (friendId) => {
    // Legacy alias, defer to unfriendUser
    return get().unfriendUser(friendId);
  },

  unfriendUser: async (targetId) => {
    const { error } = await supabase.rpc('unfriend_user', { target_user_id: targetId });
    if (error) {
      console.error("Failed to unfriend user:", error);
      throw error;
    }
    get().fetchFriends();
    get().fetchUserGroups();
    get().showToast('Friend removed and chat deleted.', 'info');
  },

  // Note: the canonical joinGroup implementation is further below, near the leaveGroup/joinGroup section.

  regenerateGroupCode: async (groupId) => {
    const { data, error } = await supabase.rpc('regenerate_group_code', { p_group_id: groupId });
    if (error) {
      console.error("Failed to regenerate code:", error);
      throw error;
    }
    if (data && data.success) {
      // Update local state instantly
      set((state) => ({
        groups: state.groups.map(g => g.id === groupId ? { ...g, code: data.new_code } : g)
      }));
      get().showToast('Group code regenerated successfully.', 'success');
      return data.new_code;
    }
  },

  fetchMutedUsers: async () => {
    const user = get().currentUser;
    if (!user) return;
    const { data, error } = await supabase
      .from('muted_users')
      .select('muted_user_id')
      .eq('user_id', user.id);
    if (!error && data) {
      set({ mutedUsers: data.map(r => r.muted_user_id) });
    }
  },

  muteUser: async (targetId) => {
    const user = get().currentUser;
    if (!user) return;
    const { error } = await supabase
      .from('muted_users')
      .insert({ user_id: user.id, muted_user_id: targetId });
    if (error) throw error;
    get().showToast('User muted.', 'info');
  },

  unmuteUser: async (targetId) => {
    const user = get().currentUser;
    if (!user) return;
    const { error } = await supabase
      .from('muted_users')
      .delete()
      .match({ user_id: user.id, muted_user_id: targetId });
    if (error) throw error;
    get().showToast('User unmuted.', 'info');
  },

  // ── Settings & Personalization Actions ─────────────────────────────────────
  updateSettings: (partial) => {
    const current = get().settings || DEFAULT_SETTINGS;
    const updated = { ...current, ...partial };
    try {
      localStorage.setItem('rakcha_settings', JSON.stringify(updated));
    } catch (e) {}
    set({ settings: updated });
    get().applySettingsToDOM();
  },

  applySettingsToDOM: () => {
    const settings = get().settings || DEFAULT_SETTINGS;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', settings.theme || 'dark-slate');
      document.documentElement.setAttribute('data-accent', settings.accentColor || 'indigo');
      document.documentElement.style.setProperty('--font-size-chat', `${settings.fontSize || 15}px`);
    }
  },

  clearLocalMediaCache: () => {
    try {
      sessionStorage.clear();
      get().showToast('Local media cache purged.', 'success');
    } catch (e) {
      get().showToast('Failed to purge media cache.', 'error');
    }
  },

  // ── Blocked Users Actions ──────────────────────────────────────────────────
  fetchBlockedUsers: async () => {
    const user = get().currentUser;
    if (!user) return;
    try {
      // Direct select and populate profile
      const { data: rawBlocks, error: rawError } = await supabase
        .from('blocked_users')
        .select('*')
        .eq('blocker_id', user.id);

      if (!rawError && rawBlocks) {
        if (rawBlocks.length === 0) {
          set({ blockedUsers: [] });
          return;
        }
        const blockedIds = rawBlocks.map(b => b.blocked_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, custom_status')
          .in('id', blockedIds);

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        const merged = rawBlocks.map(b => ({
          ...b,
          profile: profileMap.get(b.blocked_id) || { id: b.blocked_id, display_name: 'Rakcha User', username: 'user' }
        }));
        set({ blockedUsers: merged });
      }
    } catch (err) {
      console.warn('Could not fetch blocked users:', err);
    }
  },

  blockUser: async (targetId) => {
    const user = get().currentUser;
    if (!user) return;
    if (user.id === targetId) {
      get().showToast('You cannot block yourself.', 'error');
      return;
    }

    try {
      // 1. Try RPC first
      const { error: rpcError } = await supabase.rpc('block_user', { target_user_id: targetId });
      if (rpcError) {
        // Fallback: direct table insert
        await supabase
          .from('blocked_users')
          .insert({ blocker_id: user.id, blocked_id: targetId });
        
        // Auto-unfriend fallback
        await supabase
          .from('friend_requests')
          .delete()
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${user.id})`);
      }

      await get().fetchBlockedUsers();
      await get().fetchFriends();
      await get().fetchFriendRequests();
      await get().fetchUserGroups();
      get().showToast('User blocked.', 'success');
    } catch (err) {
      get().showToast('Failed to block user: ' + err.message, 'error');
      throw err;
    }
  },

  unblockUser: async (targetId) => {
    const user = get().currentUser;
    if (!user) return;

    try {
      const { error: rpcError } = await supabase.rpc('unblock_user', { target_user_id: targetId });
      if (rpcError) {
        await supabase
          .from('blocked_users')
          .delete()
          .match({ blocker_id: user.id, blocked_id: targetId });
      }

      set(state => ({
        blockedUsers: state.blockedUsers.filter(b => b.blocked_id !== targetId && b.id !== targetId)
      }));
      await get().fetchBlockedUsers();
      get().showToast('User unblocked successfully', 'success');
    } catch (err) {
      get().showToast('Failed to unblock user: ' + err.message, 'error');
      throw err;
    }
  },

  isUserBlocked: (targetId) => {
    if (!targetId) return false;
    const { blockedUsers } = get();
    return blockedUsers.some(b => b.blocked_id === targetId || b.id === targetId);
  },

  declineFriendRequest: async (requestId) => {
    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId);
    if (error) throw error;
    get().fetchFriendRequests();
    get().fetchFriends();
  },

  cancelFriendRequest: async (requestId) => {
    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId);
    if (error) throw error;
    get().fetchFriendRequests();
    get().fetchFriends();
    get().showToast('Friend request cancelled.', 'info');
  },

  signUp: async ({ email, password, username, displayName }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: displayName,
        }
      }
    });
    if (error) throw error;
    return data;
  },

  signIn: async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // UI redirect should handle hash change
  },

  updateProfile: async ({ displayName, username, avatarUrl, avatarFile, status, customStatus, bannerColor }) => {
    let user = get().currentUser;
    if (!user) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      user = { id: session.user.id };
    }

    let finalAvatarUrl = avatarUrl;
    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile);
        
      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        finalAvatarUrl = publicUrlData.publicUrl;
      }
    }

    const updateData = {};
    if (displayName !== undefined) updateData.display_name = displayName;
    if (username !== undefined) updateData.username = username;
    if (status !== undefined) updateData.status = status;
    if (customStatus !== undefined) updateData.custom_status = customStatus;
    if (finalAvatarUrl !== undefined) updateData.avatar_url = finalAvatarUrl;
    if (bannerColor !== undefined) updateData.banner_color = bannerColor;

    let updatedProfile = null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      updatedProfile = data;
    } catch (err) {
      // If banner_color column doesn't exist yet in Supabase, retry without it
      if (err?.message?.includes('banner_color') || err?.code === '42703') {
        delete updateData.banner_color;
        const { data, error: retryErr } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', user.id)
          .select()
          .single();
        if (retryErr) throw retryErr;
        updatedProfile = { ...data, banner_color: bannerColor };
      } else {
        throw err;
      }
    }

    if (bannerColor) {
      localStorage.setItem(`rakcha_banner_${user.id}`, bannerColor);
    }
    const finalProfile = {
      ...get().currentUser,
      ...updatedProfile,
      banner_color: bannerColor || updatedProfile?.banner_color || localStorage.getItem(`rakcha_banner_${user.id}`) || 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)'
    };
    set({ currentUser: finalProfile });
  },

  // Groups Management
  fetchUserGroups: async () => {
    const user = get().currentUser;
    if (!user) return;
    
    // We no longer automatically join `group_members` for DMs since they use user1_id and user2_id
    
    // Fetch normal groups
    const { data: groupMembersData, error: gmError } = await supabase
      .from('group_members')
      .select(`
        groups (
          *,
          group_members (
            profiles (
              id, username, display_name, avatar_url
            )
          )
        )
      `)
      .eq('user_id', user.id);
      
    if (gmError) {
      console.error("Error fetching group_members:", gmError);
    }

    // Fetch DMs (where user is either user1_id or user2_id)
    const { data: dmData, error: dmError } = await supabase
      .from('groups')
      .select(`
        *,
        user1:user1_id(id, username, display_name, avatar_url),
        user2:user2_id(id, username, display_name, avatar_url)
      `)
      .eq('type', 'private')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
      
    if (dmError) {
      console.error("Error fetching DMs:", dmError);
    }

    const allGroups = [];

    if (groupMembersData) {
      groupMembersData.forEach(item => {
        const g = item.groups;
        if (g && g.type === 'group') { // filter out legacy DMs if any just in case
          allGroups.push(g);
        }
      });
    }

    if (dmData) {
      dmData.forEach(g => {
        // Find the "other" user
        const otherMember = (g.user1 && g.user1.id !== user.id) ? g.user1 : 
                            (g.user2 && g.user2.id !== user.id) ? g.user2 : null;
        if (otherMember) {
          g.name = otherMember.display_name || otherMember.username;
          g.avatar_url = otherMember.avatar_url;
          g.otherUserId = otherMember.id;
          g.otherUsername = otherMember.username;
        }
        allGroups.push(g);
      });
    }
    
    set({ groups: allGroups });
    
    const { activeGroupId } = get();
    if (!activeGroupId && allGroups.length > 0) {
      set({ activeGroupId: allGroups[0].id });
    }
  },

  setActiveGroup: (id) => set({ activeGroupId: id }),
  clearActiveGroup: () => set({ activeGroupId: null }),

  createGroup: async ({ name, description, avatarFile }) => {
    const user = get().currentUser;
    if (!user) return;
    
    let avatarUrl = null;
    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile);
        
      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        avatarUrl = publicUrlData.publicUrl;
      }
    }
    
    const { data: newGroup, error } = await supabase.rpc('create_group', {
      group_name: name,
      group_description: description,
      group_avatar_url: avatarUrl
    });
      
    if (error) throw error;
    
    await get().fetchUserGroups();
    if (newGroup) {
      // In some cases RPC might return an array if not configured as single row
      const groupId = Array.isArray(newGroup) ? newGroup[0]?.id : newGroup.id;
      if (groupId) set({ activeGroupId: groupId });
    }
    return newGroup;
  },

  createDirectMessage: async (targetUserId) => {
    const user = get().currentUser;
    if (!user) return null;
    
    // Check if already exists in state
    const existing = get().groups.find(g => g.type === 'private' && (g.user1_id === targetUserId || g.user2_id === targetUserId));
    if (existing) return existing;

    // Generate consistent code based on sorted UUIDs
    const sorted = [user.id, targetUserId].sort();
    const code = 'DM_' + sorted[0].substring(0,8).toUpperCase() + '_' + sorted[1].substring(0,8).toUpperCase();

    // Insert new private group
    const { data: newGroup, error: insertError } = await supabase
      .from('groups')
      .insert({
        name: code,
        type: 'private',
        is_private: true,
        user1_id: sorted[0],
        user2_id: sorted[1],
        code: code,
        creator_id: user.id
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') { // Unique violation means it already exists
        const { data: existingGroup } = await supabase.from('groups').select('*').eq('code', code).single();
        if (existingGroup) {
          await get().fetchUserGroups();
          return existingGroup;
        }
      }
      throw insertError;
    }

    // Broadcast to the other user so they join it
    const { globalSubscription } = get();
    if (globalSubscription) {
      globalSubscription.send({
        type: 'broadcast',
        event: 'dm_created',
        payload: { targetUserId, joinCode: code }
      });
    }

    await get().fetchUserGroups();
    return newGroup;
  },

  joinGroup: async (code) => {
    if (!code) throw new Error("Invite code is required.");
    const { data: result, error } = await supabase.rpc('join_group_by_code', { code_input: code });
    if (error) throw error;

    await get().fetchUserGroups();

    // The RPC returns { id: uuid, success: true, already_member: boolean }
    // If it returns an array (which sometimes happens with Supabase RPCs depending on setup), handle it safely.
    const res = Array.isArray(result) ? result[0] : result;

    if (res && res.id) {
      set({ activeGroupId: res.id });
    }
    return res;
  },



  leaveGroup: async (groupId) => {
    const user = get().currentUser;
    if (!user) return;
    
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', user.id);
      
    if (error) throw error;
    await get().fetchUserGroups();
  },

  fetchGroupMembers: async (groupId) => {
    const { data, error } = await supabase
      .from('group_members')
      .select('role, profiles(*)')
      .eq('group_id', groupId);
    if (error) throw error;
    return data.map(r => ({ ...r.profiles, groupRole: r.role }));
  },

  // Messages & Realtime
  fetchMessages: async (groupId) => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        profiles (
          id, username, display_name, avatar_url
        ),
        message_reactions (
          id, user_id, emoji, profiles (username, display_name)
        ),
        reply_to:reply_to_id (
          id, content, media_type, media_url, duration, profiles (username, display_name)
        )
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error("Error fetching messages:", error);
      return;
    }
    
    set({ messages: data });
  },

  sendMessage: async ({ groupId, content, file, waveform, duration, replyToId }) => {
    const user = get().currentUser;
    if (!user) return;
    
    let fileUrl = null;
    let fileType = null;
    if (file) {
      const isAudio = file.type?.startsWith('audio');
      const fileExt = file.name.split('.').pop();
      const prefix = isAudio ? 'voice_' : '';
      const fileName = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(fileName, file);
        
      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage.from('attachments').getPublicUrl(fileName);
        fileUrl = publicUrlData.publicUrl;
        // Store clean base media type (no codec suffix) so startsWith('audio') always works
        fileType = isAudio ? 'audio' : file.type;
      }
    }
    
    const { error } = await supabase
      .from('messages')
      .insert({
        group_id: groupId,
        sender_id: user.id,
        content,
        media_url: fileUrl,
        media_type: fileType,
        waveform,
        duration,
        reply_to_id: replyToId
      });
      
    if (error) throw error;
  },

  initiateCall: (groupId, targetUserId, callType) => {
    const { groups, currentUser } = get();
    const group = groups.find(g => g.id === groupId);

    // ── Group call: use server-managed session flow ──────────────────────────
    if (group?.type === 'group') {
      get().startGroupCall(groupId, callType);
      return;
    }

    // ── DM call: existing P2P broadcast flow (unchanged) ────────────────────
    const user = currentUser;
    const channel = get().globalSubscription;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'call_offer',
        payload: {
          targetUserId,
          callerId: user.id,
          callerName: user.display_name || user.username,
          callerAvatar: user.avatar_url,
          groupId,
          callType
        }
      });
    }

    sessionStorage.setItem('activeCall', JSON.stringify({ groupId, callType, isCaller: true }));
    set({ activeCallGroupId: groupId, activeCallType: callType, isCaller: true, isCameraOn: callType === 'video' });
  },

  // ── Group Call Actions ──────────────────────────────────────────────────────

  startGroupCall: async (groupId, callType = 'video') => {
    const { data, error } = await supabase.rpc('start_group_call', {
      p_group_id: groupId,
      p_call_type: callType,
    });
    if (error) {
      console.error('start_group_call error:', error);
      get().showToast('Could not start call.', 'error');
      return;
    }
    const sessionId = data.session_id;
    // Fetch full session details
    await get().fetchActiveCallSession(groupId);
    await get().fetchCallParticipants(sessionId);
    set({ activeCallGroupId: groupId, activeCallType: callType, isCaller: true, isCameraOn: callType === 'video' });
  },

  joinGroupCall: async (sessionId, groupId, callType = 'video') => {
    const { data, error } = await supabase.rpc('join_call_session', { p_session_id: sessionId });
    if (error) {
      console.error('join_call_session error:', error);
      get().showToast('Could not join call.', 'error');
      return;
    }
    await get().fetchActiveCallSession(groupId);
    await get().fetchCallParticipants(sessionId);
    set({ activeCallGroupId: groupId, activeCallType: callType, isCaller: false, isCameraOn: callType === 'video', incomingGroupCall: null });
  },

  leaveGroupCall: async (sessionId) => {
    const { data, error } = await supabase.rpc('leave_call_session', { p_session_id: sessionId });
    if (error) console.error('leave_call_session error:', error);
    sessionStorage.removeItem('activeCall');
    set({ activeCallGroupId: null, activeCallSession: null, callParticipants: [], isCaller: false, incomingGroupCall: null });
    // Refresh messages so the call_end pill appears
    const { activeGroupId } = get();
    if (activeGroupId) get().fetchMessages(activeGroupId);
  },

  fetchActiveCallSession: async (groupId) => {
    const { data, error } = await supabase.rpc('get_active_call_session', { p_group_id: groupId });
    if (error) { console.error('fetchActiveCallSession error:', error); return; }
    set({ activeCallSession: data || null });
    return data;
  },

  fetchCallParticipants: async (sessionId) => {
    if (!sessionId) return;
    const { data, error } = await supabase
      .from('call_participants')
      .select('user_id, status, profiles(id, display_name, username, avatar_url)')
      .eq('call_session_id', sessionId)
      .eq('status', 'joined');
    if (error) { console.error('fetchCallParticipants error:', error); return; }
    const participants = (data || []).map(r => ({
      user_id: r.user_id,
      ...r.profiles,
    }));
    set({ callParticipants: participants });
  },

  subscribeToCallSession: (groupId) => {
    // Clean up previous subscription
    const existing = get().groupCallSubscription;
    if (existing) supabase.removeChannel(existing);

    const channel = supabase
      .channel(`call-session-watch:${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'call_sessions', filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const session = payload.new;
          const currentUser = get().currentUser;

          await get().fetchActiveCallSession(groupId);
          await get().fetchCallParticipants(session.id);
          get().fetchMessages(groupId);

          // If someone else started the call, show the accept/decline notification
          if (currentUser && session.started_by !== currentUser.id) {
            // Fetch the group and starter info for the modal
            const { data: groupData } = await supabase
              .from('groups')
              .select('name, avatar_url')
              .eq('id', groupId)
              .single();
            const { data: starterData } = await supabase
              .from('profiles')
              .select('display_name, username')
              .eq('id', session.started_by)
              .single();

            set({
              incomingGroupCall: {
                session_id:   session.id,
                group_id:     groupId,
                group_name:   groupData?.name || 'Group',
                group_avatar: groupData?.avatar_url || null,
                call_type:    session.call_type,
                starter_name: starterData?.display_name || starterData?.username || 'Someone',
              }
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'call_sessions', filter: `group_id=eq.${groupId}` },
        async (payload) => {
          // Session ended
          if (payload.new.ended_at) {
            set({ activeCallSession: null, callParticipants: [], incomingGroupCall: null });
          } else {
            await get().fetchActiveCallSession(groupId);
            const { activeCallSession } = get();
            if (activeCallSession?.id) await get().fetchCallParticipants(activeCallSession.id);
          }
          get().fetchMessages(groupId);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_participants', filter: `group_id=eq.${groupId}` },
        async () => {
          const { activeCallSession } = get();
          if (activeCallSession?.id) {
            await get().fetchCallParticipants(activeCallSession.id);
          }
        }
      )
      .subscribe();

    set({ groupCallSubscription: channel });
    return () => {
      supabase.removeChannel(channel);
      set({ groupCallSubscription: null });
    };
  },

  dismissGroupCall: () => set({ incomingGroupCall: null }),

  acceptCall: () => {
    const incoming = get().incomingCall;
    if (incoming) {
      sessionStorage.setItem('activeCall', JSON.stringify({ groupId: incoming.groupId, callType: incoming.callType, isCaller: false }));
      set({ 
        activeGroupId: incoming.groupId,
        activeCallGroupId: incoming.groupId, 
        activeCallType: incoming.callType,
        isCaller: false,
        isCameraOn: incoming.callType === 'video',
        incomingCall: null 
      });
    }
  },

  declineCall: () => {
    const incoming = get().incomingCall;
    if (incoming) {
      const channel = get().globalSubscription;
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'call_decline',
          payload: { targetUserId: incoming.callerId, groupId: incoming.groupId }
        });
      }
      set({ incomingCall: null });
    }
  },

  cancelCall: (targetUserId, groupId) => {
    const channel = get().globalSubscription;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'call_cancel',
        payload: { targetUserId, groupId }
      });
    }
    set({ activeCallGroupId: null, isCaller: false });
  },

  endCall: () => {
    sessionStorage.removeItem('activeCall');
    set({ activeCallGroupId: null, incomingCall: null, isCaller: false, activeCallSession: null });
  },

  deleteMessage: async (messageId) => {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);
    if (error) throw error;
  },

  addReaction: async (messageId, emoji) => {
    const user = get().currentUser;
    if (!user) return;
    await supabase.from('message_reactions').insert({ message_id: messageId, user_id: user.id, emoji });
  },

  removeReaction: async (messageId, emoji) => {
    const user = get().currentUser;
    if (!user) return;
    await supabase.from('message_reactions').delete().match({ message_id: messageId, user_id: user.id, emoji });
  },

  subscribeToGroup: (groupId) => {
    const channel = supabase
      .channel(`group-messages:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`
        },
        async (payload) => {
          // Clear typing state immediately when a message is received from a sender
          const senderId = payload.new?.sender_id;
          if (senderId) {
            set((state) => {
              const currentTyping = state.typingUsers[groupId] || [];
              return {
                typingUsers: {
                  ...state.typingUsers,
                  [groupId]: currentTyping.filter((u) => u.userId !== senderId)
                }
              };
            });
          }
          get().fetchMessages(groupId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`
        },
        async () => { get().fetchMessages(groupId); }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`
        },
        (payload) => {
          set((state) => ({
            messages: state.messages.filter((m) => m.id !== payload.old.id)
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        () => { get().fetchMessages(groupId); }
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, username, isTyping } = payload.payload || {};
        const currentUserId = get().currentUser?.id;
        // Ignore self broadcasts
        if (!userId || userId === currentUserId) return;

        set((state) => {
          const currentTyping = state.typingUsers[groupId] || [];
          const newTyping = isTyping
            ? [...currentTyping.filter(u => u.userId !== userId), { userId, username }]
            : currentTyping.filter(u => u.userId !== userId);
          return { typingUsers: { ...state.typingUsers, [groupId]: newTyping } };
        });
      })
      .subscribe();

    set({ activeGroupSubscription: channel });
    return () => {
      supabase.removeChannel(channel);
      set({ activeGroupSubscription: null });
    };
  },

  sendTypingEvent: async (groupId, isTyping) => {
    const channel = get().activeGroupSubscription;
    const user = get().currentUser;
    const settings = get().settings;
    if (isTyping && settings && settings.showTypingIndicators === false) {
      return; // Respect privacy settings
    }
    if (channel && user) {
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, username: user.display_name || user.username, isTyping },
      }).catch(() => {});
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleCamera: () => set((state) => ({ isCameraOn: !state.isCameraOn })),
  toggleScreenShare: () => set((state) => ({ isScreenSharing: !state.isScreenSharing })),
}));
