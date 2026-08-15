import React, { useState } from 'react';
import { Search, Compass, Gamepad2, Music, Code, Users } from 'lucide-react';

export default function Discover() {
  return (
    <div className="flex-1 overflow-y-auto bg-surface relative scroll-smooth flex flex-col">
      {/* Hero */}
      <section className="relative w-full h-[320px] flex items-center justify-center overflow-hidden bg-surface-container-high shrink-0">
        <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent"></div>
        <div className="relative z-10 w-full max-w-3xl px-8 text-center flex flex-col items-center">
          <h1 className="font-heading text-4xl font-bold text-foreground mb-6 drop-shadow-lg">Find your community on Rakcha</h1>
          <div className="w-full relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input 
              placeholder="Explore gaming, music, tech and more..." 
              className="w-full pl-12 pr-24 py-4 bg-surface-container-lowest/80 backdrop-blur-md border border-outline-variant/30 rounded-xl font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-lg transition-all" 
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors">
              Search
            </button>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="flex-1 p-8 max-w-7xl mx-auto w-full flex gap-8">
        {/* Categories Sidebar */}
        <aside className="w-[240px] hidden md:flex flex-col shrink-0 gap-1">
          <h2 className="font-heading font-bold text-lg mb-4">Discover</h2>
          <CategoryItem icon={<Compass />} label="Home" isActive />
          <CategoryItem icon={<Gamepad2 />} label="Gaming" />
          <CategoryItem icon={<Music />} label="Music" />
          <CategoryItem icon={<Code />} label="Science & Tech" />
        </aside>

        {/* Grid */}
        <div className="flex-1">
          <h3 className="font-heading font-bold text-xl mb-6">Featured Communities</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <ServerCard 
              name="NextGen Gamers" 
              desc="The premier community for competitive and casual gaming alike. Join us for tournaments, LFG, and chill voice chats."
              banner="https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop"
              icon="https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=100&auto=format&fit=crop"
              members="45,190"
              online="12,401"
            />
            <ServerCard 
              name="Dev/Null" 
              desc="A global collective of software engineers, designers, and tech enthusiasts. Discuss web dev, systems programming, and share projects."
              banner="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop"
              icon="https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=100&auto=format&fit=crop"
              members="112,005"
              online="8,932"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryItem({ icon, label, isActive }) {
  return (
    <button className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left transition-colors ${isActive ? 'bg-surface-container-highest font-semibold text-foreground' : 'text-muted-foreground hover:bg-surface-container-high hover:text-foreground'}`}>
      {React.cloneElement(icon, { size: 20 })}
      <span>{label}</span>
    </button>
  );
}

function ServerCard({ name, desc, banner, icon, members, online }) {
  return (
    <div className="group bg-surface-container rounded-xl overflow-hidden border border-outline-variant/20 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer flex flex-col h-[320px]">
      <div className="h-32 w-full relative shrink-0">
        <img src={banner} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Banner" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container to-transparent opacity-80"></div>
        <div className="absolute -bottom-6 left-4 p-1 bg-surface-container rounded-2xl">
          <img src={icon} className="w-14 h-14 rounded-xl object-cover" alt="Icon" />
        </div>
      </div>
      <div className="p-4 pt-8 flex flex-col flex-grow">
        <h4 className="font-heading font-bold text-foreground mb-2 flex items-center gap-1">
          {name}
        </h4>
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{desc}</p>
        <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground font-medium">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            <span>{online} Online</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-400"></div>
            <span>{members} Members</span>
          </div>
        </div>
      </div>
    </div>
  );
}
