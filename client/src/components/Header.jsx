import React from 'react';
import { Trophy, BookOpen, Plus, UserCheck, Sparkles, RefreshCw } from 'lucide-react';

export const Header = ({
  currentUser,
  onOpenAuth,
  onOpenAddCourse,
  isLiveApi,
  coursesCount
}) => {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 via-purple-600 to-indigo-500 shadow-lg shadow-brand-500/25 ring-1 ring-white/20">
            <Trophy className="w-6 h-6 text-white" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                BuddyTracker
              </h1>
              <span className="hidden sm:inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                Udemy
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Shared Course Progress & Live Leaderboards
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          
          {/* Backend Status indicator */}
          <div
            title={isLiveApi ? 'Connected to live Express backend' : 'Attempting to reach backend API'}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              isLiveApi
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLiveApi ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            <span>{isLiveApi ? 'API Online' : 'Connecting...'}</span>
          </div>

          {/* Add Course button */}
          <button
            id="btn-add-course"
            onClick={onOpenAddCourse}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4 text-brand-400" />
            <span className="hidden sm:inline">Add Course</span>
          </button>

          {/* User profile / Account */}
          <button
            id="btn-user-switcher"
            onClick={onOpenAuth}
            className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-brand-500/40 transition-all text-left group"
          >
            <img
              src={currentUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser?.name || 'Guest')}`}
              alt={currentUser?.name || 'User'}
              className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 group-hover:scale-105 transition-transform"
            />
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-slate-200 truncate max-w-[110px]">
                {currentUser?.name || 'Guest'}
              </p>
              <p className="text-[10px] text-brand-400 font-medium">
                {currentUser ? 'Account / Keys' : 'Sign In'}
              </p>
            </div>
          </button>

        </div>
      </div>
    </header>
  );
};
