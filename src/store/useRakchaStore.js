import { create } from 'zustand';

const MOCK_USER = { 
  id: 'u1', 
  name: 'Alex', 
  username: '@alex_dev',
  bio: 'Software Engineer & Designer',
  avatar: 'https://i.pravatar.cc/150?u=alex', 
  status: 'online',
  friends: ['u2']
};

const MOCK_GROUPS = [
  { 
    id: 'g1', 
    name: 'Frontend Wizards', 
    description: 'A place to discuss the latest in frontend development, share tips, and build cool stuff together.',
    icon: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=100&auto=format&fit=crop', 
    isGroup: true,
    inviteCode: 'WIZARDS-2026',
    adminId: 'u2', // someone else
    members: [MOCK_USER, { id: 'u2', name: 'Sarah', avatar: 'https://i.pravatar.cc/150?u=sarah', status: 'online' }]
  },
  { 
    id: 'g2', 
    name: 'Sarah', 
    description: 'Direct Message',
    icon: 'https://i.pravatar.cc/150?u=sarah', 
    isGroup: false,
    inviteCode: null,
    adminId: null,
    members: [MOCK_USER, { id: 'u2', name: 'Sarah', avatar: 'https://i.pravatar.cc/150?u=sarah', status: 'online' }]
  }
];

// Helper to safely set hash without triggering an infinite loop
const setHash = (page) => {
  if (window.location.hash !== `#/${page}`) {
    window.location.hash = `#/${page}`;
  }
};

export const useRakchaStore = create((set) => ({
  currentPage: window.location.hash.replace('#/', '') || 'landing',
  
  currentUser: MOCK_USER,
  groups: MOCK_GROUPS,
  activeGroupId: 'g1',
  activeCallGroupId: null,
  
  searchQuery: '',
  isMuted: false,
  isCameraOn: true,
  isScreenSharing: false,
  
  messages: {
    'g1': [{ id: 'm1', userId: 'u2', text: 'Hey guys, check out this new React feature!', timestamp: new Date().toISOString() }],
    'g2': [{ id: 'm2', userId: 'u2', text: 'Are we still on for the meeting?', timestamp: new Date().toISOString() }]
  },

  // Navigate now updates the store and the URL hash
  navigate: (page) => set((state) => {
    setHash(page);
    return { currentPage: page };
  }),

  // Used by the event listener to just update the store when hash changes externally
  syncRoute: (page) => set({ currentPage: page }),
  
  setActiveGroup: (id) => set({ activeGroupId: id }),
  
  leaveGroup: (groupId) => set((state) => {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return state;

    const remainingGroups = state.groups.filter(g => g.id !== groupId);
    const newActiveGroupId = remainingGroups.length > 0 ? remainingGroups[0].id : null;

    if (group.isGroup) {
      const leaveMessage = { 
        id: Date.now().toString(), 
        userId: 'system', 
        text: `${state.currentUser.name} left the group`, 
        timestamp: new Date().toISOString() 
      };
      
      return {
        groups: remainingGroups,
        activeGroupId: state.activeGroupId === groupId ? newActiveGroupId : state.activeGroupId,
        messages: {
          ...state.messages,
          [groupId]: [...(state.messages[groupId] || []), leaveMessage]
        }
      };
    } else {
      return {
        groups: remainingGroups,
        activeGroupId: state.activeGroupId === groupId ? newActiveGroupId : state.activeGroupId,
      };
    }
  }),

  removeFriend: (friendId) => set((state) => {
    const dmGroup = state.groups.find(g => !g.isGroup && g.members.some(m => m.id === friendId));
    
    // Remove from friends array
    const newFriends = state.currentUser.friends.filter(id => id !== friendId);
    
    if (dmGroup) {
      const remainingGroups = state.groups.filter(g => g.id !== dmGroup.id);
      const newActiveGroupId = remainingGroups.length > 0 ? remainingGroups[0].id : null;
      return {
        currentUser: { ...state.currentUser, friends: newFriends },
        groups: remainingGroups,
        activeGroupId: state.activeGroupId === dmGroup.id ? newActiveGroupId : state.activeGroupId,
      };
    }
    
    return { currentUser: { ...state.currentUser, friends: newFriends } };
  }),

  addFriend: (friendId) => set((state) => {
    if (!state.currentUser.friends.includes(friendId)) {
      return {
        currentUser: { ...state.currentUser, friends: [...state.currentUser.friends, friendId] }
      };
    }
    return state;
  }),
  
  startDirectMessage: (user) => set((state) => {
    const existingDm = state.groups.find(g => !g.isGroup && g.members.some(m => m.id === user.id));
    if (existingDm) {
      setHash('app');
      return { activeGroupId: existingDm.id, currentPage: 'app' };
    }
    
    const newDmId = `dm_${Date.now()}`;
    const newDmGroup = {
      id: newDmId,
      name: user.name,
      description: 'Direct Message',
      icon: user.avatar,
      isGroup: false,
      inviteCode: null,
      adminId: null,
      members: [state.currentUser, user]
    };
    
    setHash('app');
    return {
      groups: [newDmGroup, ...state.groups],
      activeGroupId: newDmId,
      messages: { ...state.messages, [newDmId]: [] },
      currentPage: 'app'
    };
  }),
  
  joinCall: (groupId) => set({ activeCallGroupId: groupId, isMuted: false, isCameraOn: true, isScreenSharing: false }),
  leaveCall: () => set({ activeCallGroupId: null }),

  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleCamera: () => set((state) => ({ isCameraOn: !state.isCameraOn })),
  toggleScreenShare: () => set((state) => ({ isScreenSharing: !state.isScreenSharing })),
  
  addMessage: (groupId, text) => set((state) => ({
    messages: {
      ...state.messages,
      [groupId]: [...(state.messages[groupId] || []), { id: Date.now().toString(), userId: state.currentUser.id, text, timestamp: new Date().toISOString() }]
    }
  })),

  updateProfile: (updates) => set((state) => ({
    currentUser: { ...state.currentUser, ...updates }
  })),

  updateGroup: (groupId, updates) => set((state) => ({
    groups: state.groups.map(g => g.id === groupId ? { ...g, ...updates } : g)
  })),

  regenerateGroupCode: (groupId) => set((state) => {
    const newCode = `${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      groups: state.groups.map(g => g.id === groupId ? { ...g, inviteCode: newCode } : g)
    };
  }),

  createGroup: (name, description, icon) => {
    let createdGroup;
    set((state) => {
      const newGroupId = `g${Date.now()}`;
      createdGroup = {
        id: newGroupId,
        name,
        description: description || '',
        icon: icon || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop',
        isGroup: true,
        inviteCode: `${name.toUpperCase().substring(0, 4).replace(/\s/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
        adminId: state.currentUser.id, // The creator is the admin
        members: [state.currentUser]
      };
      return {
        groups: [...state.groups, createdGroup],
        activeGroupId: newGroupId,
        messages: { ...state.messages, [newGroupId]: [] }
      };
    });
    return createdGroup;
  },

  joinGroupByCode: (code) => set((state) => {
    const group = state.groups.find(g => g.inviteCode === code);
    if (group) {
      if (!group.members.find(m => m.id === state.currentUser.id)) {
        const updatedGroup = { ...group, members: [...group.members, state.currentUser] };
        setHash('app');
        return {
          groups: state.groups.map(g => g.id === group.id ? updatedGroup : g),
          activeGroupId: group.id,
          currentPage: 'app'
        };
      }
      setHash('app');
      return { activeGroupId: group.id, currentPage: 'app' };
    }
    alert('Invalid Invite Code');
    return state;
  })
}));
