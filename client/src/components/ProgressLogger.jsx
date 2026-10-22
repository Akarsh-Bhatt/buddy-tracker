import React from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';

const formatRelativeTime = (isoString) => {
  if (!isoString) return 'Not started yet';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const ProgressLogger = ({
  currentUser,
  selectedCourse,
  currentProgress,
  userRank,
  onOpenAuth
}) => {
  if (!currentUser) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 text-center space-y-3 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mx-auto">
          <Award className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">Track Your Progress</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Sign in to view your completed lectures, earn leaderboard rank, and synchronize automatically from Udemy.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-brand-600 hover:bg-brand-500 transition-all shadow-lg shadow-brand-500/20 active:scale-95"
        >
          Sign In to Track Progress
        </button>
      </div>
    );
  }

  if (!selectedCourse) {
    return (
      <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 text-center text-xs text-slate-500">
        No course selected. Select or add a course to view your progress.
      </div>
    );
  }

  const totalLectures = selectedCourse?.totalLectures || 100;
  const completedLectures = currentProgress?.completedLectures || 0;
  const percentage = totalLectures > 0
    ? Math.min(100, Math.round((completedLectures / totalLectures) * 1000) / 10)
    : 0;

  const remaining = Math.max(0, totalLectures - completedLectures);
  const isCompleted = completedLectures >= totalLectures;
  const lastWatchedAt = currentProgress?.lastWatchedAt;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 p-6 sm:p-7 shadow-2xl">
      {/* Decorative gradient corner glow */}
      <div className="absolute -top-24 -right-24 w-60 h-60 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar: user info & rank */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <img
              src={currentUser?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Buddy'}
              alt={currentUser?.name}
              className="w-13 h-13 rounded-2xl bg-slate-800 p-1 border-2 border-brand-500/40 shadow-md shadow-brand-500/10"
            />
            {userRank && (
              <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-[10px] font-black text-white ring-2 ring-slate-950">
                #{userRank}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white">
                {currentUser?.name || 'Your Progress'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Enrolled
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Logged in as <span className="text-slate-300 font-medium">{currentUser?.email}</span>
            </p>
          </div>
        </div>

        {/* Sync Status Badge */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              Course Completed! 🎓
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Auto-Synced from Udemy
            </span>
          )}
        </div>
      </div>

      {/* Progress Visualization */}
      <div className="relative my-6">
        <div className="flex items-baseline justify-between mb-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              {completedLectures}
            </span>
            <span className="text-sm font-semibold text-slate-400">
              / {totalLectures} lectures
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-indigo-300">
              {percentage}%
            </span>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full h-3.5 rounded-full bg-slate-800/80 p-0.5 overflow-hidden border border-slate-700/60 shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out relative ${
              percentage >= 100
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 shadow-lg shadow-emerald-500/30'
                : percentage >= 60
                ? 'bg-gradient-to-r from-brand-600 via-purple-500 to-indigo-400 shadow-lg shadow-brand-500/25'
                : 'bg-gradient-to-r from-blue-600 via-indigo-500 to-brand-500'
            }`}
            style={{ width: `${Math.max(2, percentage)}%` }}
          >
            {/* Shimmer light bar */}
            <div className="absolute inset-0 bg-white/20 animate-shimmer bg-[length:200%_100%] opacity-40 rounded-full" />
          </div>
        </div>

        {/* Subtitle remaining hint */}
        <div className="flex items-center justify-between text-xs text-slate-400 mt-2.5">
          <span>{remaining === 0 ? 'All lectures completed!' : `${remaining} lectures remaining to finish`}</span>
          <span className="truncate max-w-[220px] sm:max-w-md">{selectedCourse?.title}</span>
        </div>
      </div>

      {/* Footer Info Banner */}
      <div className="relative pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-slate-400">
          <ShieldCheck className="w-4 h-4 text-brand-400 flex-shrink-0" />
          <span>Progress is verified and automatically synced via your Chrome Extension.</span>
        </div>
        {lastWatchedAt && (
          <div className="flex items-center gap-1.5 text-slate-500 flex-shrink-0">
            <Clock className="w-3.5 h-3.5" />
            <span>Last watched: {formatRelativeTime(lastWatchedAt)}</span>
          </div>
        )}
      </div>

    </div>
  );
};
