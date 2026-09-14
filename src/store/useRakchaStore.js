import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { stopCallingSound, stopIncomingRingtone } from '../lib/audio';
import { applyThemeToDOM, resetThemeToDefault } from '../context/ThemeContext';

// Helper to safely set hash without triggering an infinite loop
const setHash = (page) => {
  if (typeof window !== 'undefined' && window.location.hash !== `#/${page}`) {
    window.location.hash = `#/${page}`;
  }
};

export const DEFAULT_SETTINGS = {
  theme: 'dark-slate', // 'dark-slate' | 'oled-black' | 'midnight-purple'
  accentColor: 'indigo', // 'indigo' | 'crimson' | 'emerald' | 'violet'
  chatDensity: 'cozy', // 'cozy' | 'compact'
  fontSize: 13.5, // 12 - 16 (compact density)
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

export const getStoredSettings = (userId) => {
  try {
    if (typeof localStorage !== 'undefined') {
      const key = userId ? `rakcha_settings_${userId}` : 'rakcha_settings';
      const raw = localStorage.getItem(key);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {}
  return { ...DEFAULT_SETTINGS };
};

export const useRakchaStore = create((set, get) => ({
  currentPage: typeof window !== 'undefined' ? (window.location.hash.replace('#/', '') || 'landing') : 'landing',
  
  currentUser: null,
  session: null,
  authInitialized: false,
  pendingEmail: typeof localStorage !== 'undefined' ? (localStorage.getItem('rakcha_pending_email') || '') : '',
  
  groups: [],
  activeGroupId: null,
  activeCallGroupId: null,

  // ── Settings & Personalization ───────────────────────────────────────────
  settings: getStoredSettings(),

  // ── Blocked Users ────────────────────────────────────────────────────────
  blockedUsers: [], // Array of { id, blocker_id, blocked_id, created_at, profile }

  // ── Group Call State ──────────────────────────────────────────────────────
  activeCallSession: null,      // { id, group_id, call_type, started_by, started_at, participant_count }
  callParticipants: [],         // [{ user_id, display_name, avatar_url }]
  groupCallSubscription: null,  // Realtime channel tracking call_sessions for active group
  incomingGroupCall: null,      // { session_id, group_id, group_name, group_avatar, call_type, starter_name }

  // ── Call & Media Controls ────────────────────────────────────────────────
  searchQuery: '',
  isMuted: false,
  isCameraOn: true,
  isScreenSharing: false,

  isCalling: false,
  currentCall: null, // { id, groupId, targetUserId, callType, isCaller, status }
  localStream: null,

  incomingCall: null, // { callerId, callerName, callerAvatar, groupId, callType, id } — DM calls only
  activeCallType: 'video', // 'video' | 'audio'
  isCaller: false,

  // ── Chat, Friends, and Realtime Collections ──────────────────────────────
  messages: [], // Array of messages for the active group
  friendRequests: [], // Pending incoming friend requests
  friends: [], // Accepted friends
  mutedUsers: [], // Array of muted user IDs

  onlineUsers: [], // Array of online user IDs
  globalSubscription: null,
  typingUsers: {}, // { groupId: [ {userId, username} ] }
  activeGroupSubscription: null,
  
  // ── Toast Notifications ──────────────────────────────────────────────────
  toast: null,
  showToast: (message, type = 'info') => {
    set({ toast: { message, type } });
    setTimeout(() => {
      set((state) => (state.toast?.message === message ? { toast: null } : state));
    }, 4000);
  },
  hideToast: () => set({ toast: null }),
  
  // ── Navigation ───────────────────────────────────────────────────────────
  navigate: (page) => set(() => {
    setHash(page);
    return { currentPage: page };
  }),
  syncRoute: (page) => set({ currentPage: page }),

  setPendingEmail: (email) => {
    try {
      if (email) localStorage.setItem('rakcha_pending_email', email);
      else localStorage.removeItem('rakcha_pending_email');
    } catch (e) {}
    set({ pendingEmail: email });
  },

  setOnlineUsers: (onlineIds) => set({ onlineUsers: onlineIds }),

  // ── Auth & User Session ──────────────────────────────────────────────────
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
          // Sanitize username to match DB constraints (@firstname_lastname)
          const emailPrefix = (session.user.email || 'user').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
          let safeUsername = `@${emailPrefix}`;
          if (!safeUsername.includes('_')) safeUsername += '_user';
          if (safeUsername.length > 30) safeUsername = safeUsername.substring(0, 30);
          
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              username: safeUsername,
              display_name: session.user.email?.split('@')[0] || 'User',
              is_onboarded: false
            })
            .select()
            .single();
            
          if (insertError) {
            console.warn("Fallback profile insert notice:", insertError.message);
            const { data: retryProfile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
            profile = retryProfile;
          } else {
            profile = newProfile;
          }
        }
        
        // Recover active call from sessionStorage if present
        if (typeof sessionStorage !== 'undefined') {
          const savedCall = sessionStorage.getItem('activeCall');
          if (savedCall) {
            try {
              const callData = JSON.parse(savedCall);
              set({ 
                activeCallGroupId: callData.groupId, 
                activeCallType: callData.callType, 
                isCaller: callData.isCaller,
                isCameraOn: callData.callType === 'video',
                activeGroupId: callData.groupId
              });
            } catch (e) {
              sessionStorage.removeItem('activeCall');
            }
          }
        }
        
        if (profile) {
          const savedBanner = typeof localStorage !== 'undefined' ? localStorage.getItem(`rakcha_banner_${profile.id}`) : null;
          profile.banner_color = profile.banner_color || savedBanner || 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)';
        }
        
        // Load user-scoped settings and overlay DB persisted appearance values
        const userSettings = getStoredSettings(session.user.id);
        if (profile?.accent_color) {
          userSettings.accentColor = profile.accent_color;
        }
        if (profile?.theme) {
          userSettings.theme = profile.theme;
        }

        set({ currentUser: profile, settings: userSettings, authInitialized: true });
        applyThemeToDOM(userSettings.theme, userSettings.accentColor, userSettings.fontSize);

        get().fetchUserGroups();
        get().fetchFriendRequests();
        get().fetchFriends();
        get().fetchMutedUsers();
        get().fetchBlockedUsers();
        get().initRealtimeGlobal();

        // If user is already authenticated, redirect away from public landing/auth screens directly into app
        const rawHash = typeof window !== 'undefined' ? window.location.hash.replace('#/', '') : '';
        const currentTarget = rawHash || get().currentPage;
        if (!currentTarget || currentTarget === 'landing' || currentTarget === 'login' || currentTarget === 'register') {
          get().navigate('app');
        }
      } else {
        // Disconnected / Signed Out: Purge user state & reset DOM theme to default
        resetThemeToDefault();
        const { globalSubscription, groupCallSubscription } = get();
        if (globalSubscription) supabase.removeChannel(globalSubscription);
        if (groupCallSubscription) supabase.removeChannel(groupCallSubscription);
        set({
          currentUser: null,
          session: null,
          settings: { ...DEFAULT_SETTINGS },
          authInitialized: true,
          groups: [],
          messages: [],
          friendRequests: [],
          friends: [],
          mutedUsers: [],
          blockedUsers: [],
          onlineUsers: [],
          globalSubscription: null,
          activeCallSession: null,
          callParticipants: [],
          groupCallSubscription: null,
        });
      }
    });
  },

  initRealtimeGlobal: async () => {
    const user = get().currentUser;
    if (!user) return;

    // Avoid duplicate subscriptions if already joined or joining
    const existing = get().globalSubscription;
    if (existing && (existing.state === 'joined' || existing.state === 'joining')) {
      return;
    }

    // Clean up any stale instances of global_system from supabase channels map
    try {
      const activeChannels = supabase.getChannels() || [];
      for (const ch of activeChannels) {
        if (ch.topic === 'realtime:global_system' || ch.topic === 'global_system') {
          await supabase.removeChannel(ch);
        }
      }
      if (existing) {
        await supabase.removeChannel(existing);
      }
    } catch (e) {
      console.warn('[Rakcha Realtime] Cleanup notice:', e);
    }

    const channel = supabase.channel('global_system')
      // Presence for online status
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineIds = Object.values(state)
          .map((presenceArray) => presenceArray[0]?.user_id)
          .filter(Boolean);
        set({ onlineUsers: onlineIds });
      })
      // Listen for DM creation broadcasts
      .on('broadcast', { event: 'dm_created' }, async ({ payload }) => {
        if (payload && payload.targetUserId === user.id && payload.joinCode) {
          await supabase.rpc('join_group_by_code', { code_input: payload.joinCode }).catch(() => {});
          get().fetchUserGroups();
        }
      })
      // Listen for incoming call
      .on('broadcast', { event: 'call_offer' }, ({ payload }) => {
        if (payload && payload.targetUserId === user.id) {
          set({ incomingCall: payload });
        }
      })
      // Listen for caller cancelling before accept (instant dismissal)
      .on('broadcast', { event: 'call_cancelled' }, ({ payload }) => {
        const incoming = get().incomingCall;
        if (
          payload &&
          (payload.targetUserId === user.id ||
            payload.groupId === incoming?.groupId ||
            payload.callId === incoming?.callId ||
            payload.callId === incoming?.id)
        ) {
          stopIncomingRingtone();
          set({ incomingCall: null });
          get().showToast('Call cancelled by caller', 'info');
        }
      })
      // Listen for caller cancelling before accept (legacy event)
      .on('broadcast', { event: 'call_cancel' }, ({ payload }) => {
        const incoming = get().incomingCall;
        if (
          payload &&
          (payload.targetUserId === user.id ||
            payload.groupId === incoming?.groupId ||
            payload.callId === incoming?.callId ||
            payload.callId === incoming?.id)
        ) {
          stopIncomingRingtone();
          set({ incomingCall: null });
        }
      })
      // Listen for receiver declining
      .on('broadcast', { event: 'call_decline' }, ({ payload }) => {
        if (payload && (payload.targetUserId === user.id || payload.groupId === get().activeCallGroupId)) {
          stopCallingSound();
          get().cancelOutgoingCall({ groupId: payload.groupId });
          get().showToast('Call declined', 'info');
        }
      })
      // Listen for call session state changes (e.g. cancelled in DB)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_sessions' }, (payload) => {
        const incoming = get().incomingCall;
        if (incoming && (incoming.groupId === payload.new.group_id || incoming.session_id === payload.new.id || incoming.callId === payload.new.id)) {
          if (payload.new.status === 'cancelled' || payload.new.ended_at) {
            stopIncomingRingtone();
            set({ incomingCall: null });
            get().showToast('Call was cancelled', 'info');
          }
        }
      })
      // Listen for new friend requests or updates
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${user.id}` }, (payload) => {
        if (payload?.eventType === 'DELETE' && payload.old?.id) {
          set((state) => ({
            friendRequests: state.friendRequests.filter((r) => r.id !== payload.old.id),
          }));
        }
        get().fetchFriendRequests();
        get().fetchFriends();
      })
      // Listen to accepted/deleted friend requests (when YOU sent it and they accept or reject/delete)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `sender_id=eq.${user.id}` }, () => {
        get().fetchFriendRequests();
        get().fetchFriends();
      })
      // Listen to new group memberships
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_members', filter: `user_id=eq.${user.id}` }, () => {
        get().fetchUserGroups();
      })
      // Listen to deleted group memberships
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_members', filter: `user_id=eq.${user.id}` }, (payload) => {
        get().fetchUserGroups();
        if (get().activeGroupId === payload.old.group_id) {
          get().clearActiveGroup();
        }
      })
      // Listen to muted_users updates
      .on('postgres_changes', { event: '*', schema: 'public', table: 'muted_users', filter: `user_id=eq.${user.id}` }, () => {
        get().fetchMutedUsers();
      })
      // Listen to blocked_users updates
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_users', filter: `blocker_id=eq.${user.id}` }, () => {
        get().fetchBlockedUsers();
        get().fetchFriends();
        get().fetchUserGroups();
      });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await channel.track({ user_id: user.id });
        } catch (err) {}
      }
    });

    set({ globalSubscription: channel });
  },

  // ── Friend Requests ──────────────────────────────────────────────────────
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
    const friendsList = requests.map((req) => {
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

    return (data || []).map((user) => {
      const relationship = requests?.find((r) => r.sender_id === user.id || r.receiver_id === user.id);
      
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
        requestId: relationship?.id
      };
    });
  },

  sendFriendRequest: async (targetId) => {
    const currentUser = get().currentUser;
    if (!currentUser) throw new Error('You must be logged in to send friend requests.');
    if (targetId === currentUser.id) throw new Error('You cannot send a friend request to yourself.');

    const { data: existing } = await supabase
      .from('friend_requests')
      .select('id, status')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${currentUser.id})`)
      .maybeSingle();
      
    if (existing) {
      if (existing.status === 'pending') throw new Error('A friend request is already pending with this user.');
      if (existing.status === 'accepted') throw new Error('You are already friends with this user.');
    }

    const { data, error } = await supabase
      .from('friend_requests')
      .insert({ sender_id: currentUser.id, receiver_id: targetId, status: 'pending' })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        throw new Error('A friend request is already pending or you are already friends.');
      }
      throw error;
    }

    await get().fetchFriendRequests();
    return data;
  },

  acceptFriendRequest: async (requestId) => {
    const { data: req, error: reqErr } = await supabase
      .from('friend_requests')
      .select('sender_id, receiver_id, status')
      .eq('id', requestId)
      .maybeSingle();

    if (reqErr || !req) {
      get().fetchFriendRequests();
      throw new Error('This friend request is no longer available or was cancelled.');
    }

    if (req.status === 'accepted') {
      get().fetchFriends();
      get().fetchFriendRequests();
      return;
    }

    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId);
    if (error) throw error;

    let newGroupId = null;
    const currentUser = get().currentUser;
    
    const sortedIds = [currentUser.id, req.sender_id].sort();
    const joinCode = `DM_${sortedIds[0].substring(0,8)}_${sortedIds[1].substring(0,8)}`.toUpperCase();

    const { data: existingGroup } = await supabase.from('groups').select('id').eq('code', joinCode).maybeSingle();

    if (existingGroup) {
      newGroupId = existingGroup.id;
    } else {
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
    }

    const channel = get().globalSubscription;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'dm_created',
        payload: { targetUserId: req.sender_id, joinCode: joinCode }
      });
    }

    if (newGroupId) {
      await get().fetchUserGroups();
      set({ activeGroupId: newGroupId });
    }

    get().fetchFriendRequests();
    get().fetchFriends();
  },

  openDirectMessage: async (targetId) => {
    const currentUser = get().currentUser;
    if (!currentUser) return;
    
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

  regenerateGroupCode: async (groupId) => {
    const { data, error } = await supabase.rpc('regenerate_group_code', { p_group_id: groupId });
    if (error) {
      console.error("Failed to regenerate code:", error);
      throw error;
    }
    if (data && data.success) {
      set((state) => ({
        groups: state.groups.map((g) => (g.id === groupId ? { ...g, code: data.new_code } : g))
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
      set({ mutedUsers: data.map((r) => r.muted_user_id) });
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

  // ── Settings & Personalization Actions ───────────────────────────────────
  updateSettings: (partial) => {
    const user = get().currentUser;
    const current = get().settings || DEFAULT_SETTINGS;
    const updated = { ...current, ...partial };
    
    try {
      if (typeof localStorage !== 'undefined') {
        const key = user?.id ? `rakcha_settings_${user.id}` : 'rakcha_settings';
        localStorage.setItem(key, JSON.stringify(updated));
      }
    } catch (e) {}

    set({ settings: updated });
    applyThemeToDOM(updated.theme, updated.accentColor, updated.fontSize);

    // Asynchronously persist appearance updates to Supabase profile
    if (user?.id && (partial.accentColor !== undefined || partial.theme !== undefined)) {
      const profileUpdates = {};
      if (partial.accentColor !== undefined) {
        profileUpdates.accent_color = partial.accentColor;
      }
      if (partial.theme !== undefined) {
        profileUpdates.theme = partial.theme;
      }

      supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) {
            console.warn('[Rakcha Store] Appearance persistence notice:', error.message);
          }
        });
    }
  },

  applySettingsToDOM: () => {
    const settings = get().settings || DEFAULT_SETTINGS;
    applyThemeToDOM(settings.theme, settings.accentColor, settings.fontSize);
  },

  clearLocalMediaCache: () => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
      get().showToast('Local media cache purged.', 'success');
    } catch (e) {
      get().showToast('Failed to purge media cache.', 'error');
    }
  },

  // ── Blocked Users Actions ────────────────────────────────────────────────
  fetchBlockedUsers: async () => {
    const user = get().currentUser;
    if (!user) return;
    try {
      const { data: rawBlocks, error: rawError } = await supabase
        .from('blocked_users')
        .select('*')
        .eq('blocker_id', user.id);

      if (!rawError && rawBlocks) {
        if (rawBlocks.length === 0) {
          set({ blockedUsers: [] });
          return;
        }
        const blockedIds = rawBlocks.map((b) => b.blocked_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, custom_status')
          .in('id', blockedIds);

        const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
        const merged = rawBlocks.map((b) => ({
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
      const { error: rpcError } = await supabase.rpc('block_user', { target_user_id: targetId });
      if (rpcError) {
        await supabase
          .from('blocked_users')
          .insert({ blocker_id: user.id, blocked_id: targetId });
        
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

      set((state) => ({
        blockedUsers: state.blockedUsers.filter((b) => b.blocked_id !== targetId && b.id !== targetId)
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
    return blockedUsers.some((b) => b.blocked_id === targetId || b.id === targetId);
  },

  declineFriendRequest: async (requestId) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);
      if (error && error.code !== 'PGRST116') {
        console.warn('[FriendRequest] decline error:', error);
      }
    } finally {
      get().fetchFriendRequests();
      get().fetchFriends();
    }
  },

  cancelFriendRequest: async (requestIdOrTargetUserId) => {
    const currentUser = get().currentUser;
    if (!currentUser || !requestIdOrTargetUserId) return;

    const targetId = typeof requestIdOrTargetUserId === 'object' ? requestIdOrTargetUserId.targetUserId : requestIdOrTargetUserId;
    const reqId = typeof requestIdOrTargetUserId === 'object' ? requestIdOrTargetUserId.requestId : requestIdOrTargetUserId;

    // Optimistically update store
    set((state) => ({
      friendRequests: state.friendRequests.filter((r) => r.id !== reqId && r.sender_id !== targetId && r.receiver_id !== targetId),
    }));

    try {
      let query = supabase.from('friend_requests').delete();

      if (reqId && reqId !== targetId) {
        query = query.or(`id.eq.${reqId},and(sender_id.eq.${currentUser.id},receiver_id.eq.${targetId})`);
      } else {
        query = query.or(`id.eq.${reqId},and(sender_id.eq.${currentUser.id},receiver_id.eq.${targetId}),and(receiver_id.eq.${currentUser.id},sender_id.eq.${targetId})`);
      }

      const { error } = await query;
      if (error) {
        console.error('[FriendRequest] cancelFriendRequest error:', error);
        await get().fetchFriendRequests();
        await get().fetchFriends();
        throw error;
      }

      await get().fetchFriendRequests();
      await get().fetchFriends();
      get().showToast('Friend request cancelled.', 'info');
    } catch (err) {
      await get().fetchFriendRequests();
      await get().fetchFriends();
      throw err;
    }
  },

  signUp: async ({ email, password, username, displayName }) => {
    const formattedUsername = username ? (username.startsWith('@') ? username : `@${username}`) : username;
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/#/email-confirmed` : undefined;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: formattedUsername,
          display_name: displayName,
        },
        emailRedirectTo: redirectUrl
      }
    });
    if (error) throw error;
    
    if (email) {
      get().setPendingEmail(email);
    }
    return data;
  },

  resendConfirmationEmail: async (targetEmail) => {
    const emailToUse = (targetEmail || get().pendingEmail || '').trim();
    if (!emailToUse) {
      throw new Error('Please enter a valid email address.');
    }
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/#/email-confirmed` : undefined;
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email: emailToUse,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    if (error) throw error;
    get().setPendingEmail(emailToUse);
    get().showToast('Confirmation email resent! Please check your inbox.', 'success');
    return data;
  },

  resetPasswordForEmail: async (email) => {
    const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) throw error;
    get().showToast('Password reset link sent! Please check your inbox.', 'success');
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
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
      const { globalSubscription, groupCallSubscription, activeGroupSubscription } = get();
      if (globalSubscription) supabase.removeChannel(globalSubscription);
      if (groupCallSubscription) supabase.removeChannel(groupCallSubscription);
      if (activeGroupSubscription) supabase.removeChannel(activeGroupSubscription);
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn("Supabase signOut error:", error);
      }
    } catch (err) {
      console.warn("signOut encountered exception:", err);
    } finally {
      resetThemeToDefault();
      set({
        currentUser: null,
        session: null,
        settings: { ...DEFAULT_SETTINGS },
        groups: [],
        messages: [],
        friendRequests: [],
        friends: [],
        mutedUsers: [],
        blockedUsers: [],
        onlineUsers: [],
        globalSubscription: null,
        groupCallSubscription: null,
        activeGroupSubscription: null,
        activeCallSession: null,
        callParticipants: [],
        activeGroupId: null,
        activeCallGroupId: null,
        incomingCall: null,
        incomingGroupCall: null,
        isCalling: false,
        currentCall: null,
        localStream: null,
        searchQuery: '',
      });
      setHash('landing');
      set({ currentPage: 'landing' });
    }
  },

  updateProfile: async ({ displayName, username, avatarUrl, avatarFile, status, customStatus, bannerColor, is_onboarded, isOnboarded }) => {
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
        .upload(fileName, avatarFile, { upsert: true });
        
      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        finalAvatarUrl = publicUrlData.publicUrl;
      }
    }

    const updateData = {};
    if (displayName !== undefined) updateData.display_name = displayName;
    if (username !== undefined) {
      updateData.username = username ? (username.startsWith('@') ? username : `@${username}`) : username;
    }
    if (status !== undefined) updateData.status = status;
    if (customStatus !== undefined) updateData.custom_status = customStatus;
    if (finalAvatarUrl !== undefined) updateData.avatar_url = finalAvatarUrl;
    if (bannerColor !== undefined) updateData.banner_color = bannerColor;
    if (is_onboarded !== undefined || isOnboarded !== undefined) {
      updateData.is_onboarded = is_onboarded !== undefined ? is_onboarded : isOnboarded;
    }

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

    if (bannerColor && typeof localStorage !== 'undefined') {
      localStorage.setItem(`rakcha_banner_${user.id}`, bannerColor);
    }
    const finalProfile = {
      ...get().currentUser,
      ...updatedProfile,
      banner_color: bannerColor || updatedProfile?.banner_color || (typeof localStorage !== 'undefined' ? localStorage.getItem(`rakcha_banner_${user.id}`) : null) || 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)'
    };
    set({ currentUser: finalProfile });
    return finalProfile;
  },

  // ── Groups Management ────────────────────────────────────────────────────
  fetchUserGroups: async () => {
    const user = get().currentUser;
    if (!user) return;
    
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
      groupMembersData.forEach((item) => {
        const g = item.groups;
        if (g && g.type === 'group') {
          allGroups.push(g);
        }
      });
    }

    if (dmData) {
      dmData.forEach((g) => {
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
      const groupId = Array.isArray(newGroup) ? newGroup[0]?.id : newGroup.id;
      if (groupId) set({ activeGroupId: groupId });
    }
    return newGroup;
  },

  createDirectMessage: async (targetUserId) => {
    const user = get().currentUser;
    if (!user) return null;
    
    const existing = get().groups.find((g) => g.type === 'private' && (g.user1_id === targetUserId || g.user2_id === targetUserId));
    if (existing) return existing;

    const sorted = [user.id, targetUserId].sort();
    const code = 'DM_' + sorted[0].substring(0,8).toUpperCase() + '_' + sorted[1].substring(0,8).toUpperCase();

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
      if (insertError.code === '23505') {
        const { data: existingGroup } = await supabase.from('groups').select('*').eq('code', code).single();
        if (existingGroup) {
          await get().fetchUserGroups();
          return existingGroup;
        }
      }
      throw insertError;
    }

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
    return (data || []).map((r) => ({ ...r.profiles, groupRole: r.role }));
  },

  // ── Messages & Realtime ──────────────────────────────────────────────────
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
    
    set({ messages: data || [] });
  },

  sendMessage: async ({ groupId, content, file, waveform, duration, replyToId }) => {
    const user = get().currentUser;
    if (!user) return;
    
    let fileUrl = null;
    let fileType = null;
    let finalContent = content;

    if (file) {
      const isAudio = file.type?.startsWith('audio') || file.name?.startsWith('voice_');
      const fileExt = file.name?.split('.').pop() || (isAudio ? 'webm' : 'bin');
      
      let bucket = 'chat-media';
      let filePath = isAudio
        ? `vocals/voice_${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
        : `attachments/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

      let { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        bucket = 'attachments';
        filePath = isAudio
          ? `voice_${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
          : `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        const fallbackRes = await supabase.storage
          .from(bucket)
          .upload(filePath, file, { upsert: true });

        uploadData = fallbackRes.data;
        uploadError = fallbackRes.error;
      }

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        fileUrl = publicUrlData.publicUrl;
        fileType = isAudio ? 'audio' : (file.type?.startsWith('image') ? 'image' : 'file');
        if (isAudio && (!finalContent || !finalContent.trim())) {
          finalContent = '🎤 Voice message';
        }
      }
    }
    
    const { error } = await supabase
      .from('messages')
      .insert({
        group_id: groupId,
        sender_id: user.id,
        content: finalContent,
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
    const group = groups.find((g) => g.id === groupId);

    // Group call: use server-managed session flow
    if (group?.type === 'group') {
      get().startGroupCall(groupId, callType);
      return;
    }

    // DM call: existing P2P broadcast flow
    const user = currentUser;
    const callId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `call_${Date.now()}`;
    const callPayload = {
      id: callId,
      callId,
      targetUserId,
      callerId: user?.id,
      callerName: user?.display_name || user?.username || 'User',
      callerAvatar: user?.avatar_url,
      groupId,
      callType,
      createdAt: new Date().toISOString(),
    };

    const channel = get().globalSubscription;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'call_offer',
        payload: callPayload,
      });
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('activeCall', JSON.stringify({ callId, groupId, callType, isCaller: true }));
    }

    set({
      isCalling: true,
      currentCall: {
        id: callId,
        groupId,
        targetUserId,
        callType,
        isCaller: true,
        status: 'calling',
      },
      activeCallGroupId: groupId,
      activeCallType: callType,
      isCaller: true,
      isCameraOn: callType === 'video',
    });
  },

  cancelOutgoingCall: async (options = {}) => {
    const state = get();
    const activeGroupId = options.groupId || state.activeCallGroupId || state.currentCall?.groupId;
    const targetUserId = options.targetUserId || state.currentCall?.targetUserId;
    const callId = options.callId || state.currentCall?.id;
    const stream = options.stream || state.localStream;

    // 1. Stop all active media tracks (audio and video) immediately
    try {
      if (stream) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch {
            /* ignore */
          }
        });
      }
      if (state.localStream && state.localStream !== stream) {
        state.localStream.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch {
            /* ignore */
          }
        });
      }
    } catch (err) {
      console.warn('[Rakcha Store] Error stopping media tracks on cancel:', err);
    }

    // Stop ringback/calling sound immediately
    try {
      stopCallingSound();
      stopIncomingRingtone();
    } catch {
      /* ignore */
    }

    // 2. Send real-time cancellation broadcast events over active call channel and global channel
    const cancelPayload = {
      type: 'call_cancelled',
      callId,
      groupId: activeGroupId,
      targetUserId,
      callerId: state.currentUser?.id,
      timestamp: new Date().toISOString(),
    };

    try {
      // Global broadcast to target user
      if (state.globalSubscription) {
        state.globalSubscription.send({
          type: 'broadcast',
          event: 'call_cancelled',
          payload: cancelPayload,
        }).catch(() => {});

        // Also broadcast legacy call_cancel event for backward compatibility
        state.globalSubscription.send({
          type: 'broadcast',
          event: 'call_cancel',
          payload: { targetUserId, groupId: activeGroupId, callId },
        }).catch(() => {});
      }

      // Broadcast over the call channel if activeGroupId exists
      if (activeGroupId) {
        const callChannel = (supabase.getChannels() || []).find(ch => 
          ch.topic === `realtime:call-${activeGroupId}` || ch.topic === `call-${activeGroupId}`
        );
        if (callChannel) {
          callChannel.send({
            type: 'broadcast',
            event: 'call_cancelled',
            payload: cancelPayload,
          }).catch(() => {});
          
          callChannel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'call_cancelled', from: state.currentUser?.id, callId },
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[Rakcha Store] Broadcast cancel notification notice:', err);
    }

    // 3. Update call row in Supabase database setting status: 'cancelled' and ended_at
    if (activeGroupId || callId) {
      try {
        const nowISO = new Date().toISOString();
        
        // Attempt update on call_sessions
        if (callId) {
          const { error: sessionErr } = await supabase
            .from('call_sessions')
            .update({ status: 'cancelled', ended_at: nowISO })
            .eq('id', callId);

          if (sessionErr && (sessionErr.code === '42703' || sessionErr.message?.includes('status'))) {
            await supabase
              .from('call_sessions')
              .update({ ended_at: nowISO })
              .eq('id', callId);
          }
        } else if (activeGroupId) {
          const { error: sessionErr } = await supabase
            .from('call_sessions')
            .update({ status: 'cancelled', ended_at: nowISO })
            .eq('group_id', activeGroupId)
            .is('ended_at', null);

          if (sessionErr && (sessionErr.code === '42703' || sessionErr.message?.includes('status'))) {
            await supabase
              .from('call_sessions')
              .update({ ended_at: nowISO })
              .eq('group_id', activeGroupId)
              .is('ended_at', null);
          }
        }

        // Also attempt update on 'calls' table if present in DB schema
        try {
          if (callId) {
            await supabase
              .from('calls')
              .update({ status: 'cancelled', ended_at: nowISO })
              .eq('id', callId);
          } else if (activeGroupId) {
            await supabase
              .from('calls')
              .update({ status: 'cancelled', ended_at: nowISO })
              .eq('group_id', activeGroupId)
              .is('ended_at', null);
          }
        } catch {
          /* ignore */
        }
      } catch (err) {
        console.warn('[Rakcha Store] DB cancel call update notice:', err);
      }
    }

    // 4. Unsubscribe and clean up the Supabase Realtime channel
    try {
      if (activeGroupId) {
        const activeChannels = supabase.getChannels() || [];
        for (const ch of activeChannels) {
          if (ch.topic === `realtime:call-${activeGroupId}` || ch.topic === `call-${activeGroupId}`) {
            supabase.removeChannel(ch);
          }
        }
      }
    } catch (e) {
      console.warn('[Rakcha Store] Clean up call channel notice:', e);
    }

    // 5. Reset local UI call states
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('activeCall');
    }

    set({
      isCalling: false,
      currentCall: null,
      localStream: null,
      activeCallGroupId: null,
      isCaller: false,
      activeCallSession: null,
      incomingCall: null,
    });
  },

  cancelCall: (targetUserId, groupId) => {
    return get().cancelOutgoingCall({ targetUserId, groupId });
  },

  endCall: () => {
    const state = get();
    if (state.localStream) {
      try {
        state.localStream.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch {
            /* ignore */
          }
        });
      } catch {
        /* ignore */
      }
    }
    try {
      stopCallingSound();
      stopIncomingRingtone();
    } catch {
      /* ignore */
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('activeCall');
    }
    set({
      isCalling: false,
      currentCall: null,
      localStream: null,
      activeCallGroupId: null,
      incomingCall: null,
      isCaller: false,
      activeCallSession: null,
    });
  },

  // ── Group Call Actions ───────────────────────────────────────────────────
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
    await get().fetchActiveCallSession(groupId);
    await get().fetchCallParticipants(sessionId);
    set({ activeCallGroupId: groupId, activeCallType: callType, isCaller: true, isCameraOn: callType === 'video' });
  },

  joinGroupCall: async (sessionId, groupId, callType = 'video') => {
    const { error } = await supabase.rpc('join_call_session', { p_session_id: sessionId });
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
    const { error } = await supabase.rpc('leave_call_session', { p_session_id: sessionId });
    if (error) console.error('leave_call_session error:', error);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('activeCall');
    }
    set({ activeCallGroupId: null, activeCallSession: null, callParticipants: [], isCaller: false, incomingGroupCall: null });
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
    const participants = (data || []).map((r) => ({
      user_id: r.user_id,
      ...r.profiles,
    }));
    set({ callParticipants: participants });
  },

  subscribeToCallSession: (groupId) => {
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

          if (currentUser && session.started_by !== currentUser.id) {
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
                session_id: session.id,
                group_id: groupId,
                group_name: groupData?.name || 'Group',
                group_avatar: groupData?.avatar_url || null,
                call_type: session.call_type,
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
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('activeCall', JSON.stringify({ groupId: incoming.groupId, callType: incoming.callType, isCaller: false }));
      }
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
    const existing = get().activeGroupSubscription;
    if (existing) {
      supabase.removeChannel(existing);
    }

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
        if (!userId || userId === currentUserId) return;

        set((state) => {
          const currentTyping = state.typingUsers[groupId] || [];
          const newTyping = isTyping
            ? [...currentTyping.filter((u) => u.userId !== userId), { userId, username }]
            : currentTyping.filter((u) => u.userId !== userId);
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
      return;
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
