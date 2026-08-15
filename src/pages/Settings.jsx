import React from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { ArrowLeft, User, Palette, Mic, Shield } from 'lucide-react';

export default function Settings() {
  const { currentUser, updateProfile, navigate } = useRakchaStore();
  const [activeTab, setActiveTab] = React.useState('account');

  const handleSave = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    updateProfile({
      name: formData.get('name'),
      username: formData.get('username'),
      bio: formData.get('bio')
    });
    alert('Settings saved successfully!');
  };

  const handleChangeAvatar = () => {
    const avatars = [
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=100&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?q=80&w=100&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1529156069898-49953eb1b5ce?q=80&w=100&auto=format&fit=crop',
      currentUser.avatar
    ];
    const currentIndex = avatars.indexOf(currentUser.avatar);
    const nextIndex = (currentIndex + 1) % avatars.length;
    updateProfile({ avatar: avatars[nextIndex] });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="w-[280px] bg-surface-container-low shrink-0 border-r border-outline-variant/10 flex flex-col">
        <header className="p-6">
          <button onClick={() => navigate('app')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition font-medium mb-8">
            <ArrowLeft size={20} /> Back to App
          </button>
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">User Settings</h2>
        </header>
        
        <nav className="flex-1 px-4 flex flex-col gap-1">
          <SettingsTab icon={<User size={18} />} label="My Account" isActive={activeTab === 'account'} onClick={() => setActiveTab('account')} />
          <SettingsTab icon={<Palette size={18} />} label="Appearance" isActive={activeTab === 'appearance'} onClick={() => setActiveTab('appearance')} />
          <SettingsTab icon={<Mic size={18} />} label="Voice & Video" isActive={activeTab === 'voice'} onClick={() => setActiveTab('voice')} />
          <SettingsTab icon={<Shield size={18} />} label="Privacy & Safety" isActive={activeTab === 'privacy'} onClick={() => setActiveTab('privacy')} />
        </nav>
      </aside>

      {/* Main Settings Content */}
      <main className="flex-1 overflow-y-auto p-8 md:p-12 relative bg-surface">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-heading font-bold mb-8">
            {activeTab === 'account' && 'My Account'}
            {activeTab === 'appearance' && 'Appearance'}
            {activeTab === 'voice' && 'Voice & Video'}
            {activeTab === 'privacy' && 'Privacy & Safety'}
          </h1>
          
          {activeTab === 'account' && (
            <>
          <div className="bg-surface-container rounded-2xl border border-outline-variant/20 overflow-hidden mb-8">
            <div className="h-32 bg-gradient-to-r from-primary to-secondary w-full relative"></div>
            <div className="px-8 pb-8 relative">
              <div className="absolute -top-12 left-8 rounded-full border-8 border-surface-container bg-surface-container">
                <img src={currentUser.avatar} className="w-24 h-24 rounded-full object-cover" alt="Avatar" />
              </div>
              <div className="pt-16 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">{currentUser.name}</h2>
                  <p className="text-muted-foreground font-medium">{currentUser.username}</p>
                </div>
                <button onClick={handleChangeAvatar} className="bg-primary hover:bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium transition">
                  Change Avatar
                </button>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="bg-surface-container rounded-2xl border border-outline-variant/20 p-8 flex flex-col gap-6">
            <h3 className="text-lg font-bold">Profile Details</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Display Name</label>
                <input name="name" defaultValue={currentUser.name} className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Username</label>
                <input name="username" defaultValue={currentUser.username} className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Bio</label>
              <textarea name="bio" defaultValue={currentUser.bio} rows="4" className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition resize-none" />
              <p className="text-xs text-muted-foreground mt-2">Any details such as age, occupation or city. Example: 23 y.o. designer from San Francisco.</p>
            </div>

            <div className="pt-4 border-t border-outline-variant/10 flex justify-end">
              <button type="submit" className="bg-primary hover:bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold transition shadow-lg shadow-primary/20">
                Save Changes
              </button>
            </div>
          </form>
          </>
          )}

          {activeTab === 'appearance' && (
            <div className="bg-surface-container rounded-2xl border border-outline-variant/20 p-8 text-center text-muted-foreground">
              <Palette size={48} className="mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-bold text-foreground mb-2">Appearance Settings</h3>
              <p>Theme and customization options will go here.</p>
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="bg-surface-container rounded-2xl border border-outline-variant/20 p-8 text-center text-muted-foreground">
              <Mic size={48} className="mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-bold text-foreground mb-2">Voice & Video</h3>
              <p>Device selection and testing tools will go here.</p>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="bg-surface-container rounded-2xl border border-outline-variant/20 p-8 text-center text-muted-foreground">
              <Shield size={48} className="mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-bold text-foreground mb-2">Privacy & Safety</h3>
              <p>Blocking, data settings, and account security will go here.</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

function SettingsTab({ icon, label, isActive, onClick }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-colors ${isActive ? 'bg-surface-container-highest font-bold text-foreground' : 'text-muted-foreground hover:bg-surface-container-high hover:text-foreground font-medium'}`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
