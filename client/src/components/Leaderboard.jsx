import React from 'react';
import {
  Trophy,
  Medal,
  Clock,
  CheckCircle,
  TrendingUp,
  User,
  Sparkles,
  Flame
} from 'lucide-react';

// Format relative timestamps
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

// Progress bar color coding based on percentage
const getProgressBarColor = (pct) => {
  if (pct >= 85) return 'from-emerald-500 via-teal-400 to-green-300';
  if (pct >= 60) return 'from-brand-600 via-purple-500 to-indigo-400';
  if (pct >= 35) return 'from-blue-600 via-sky-500 to-cyan-400';
  if (pct >= 15) return 'from-amber-600 via-orange-500 to-yellow-400';
  return 'from-slate-600 to-slate-500';
};

const getRankBadge = (rank) => {
  if (rank === 1) {
    return {
      icon: Trophy,
      label: '1st',
      bg: 'bg-amber-400/20 text-amber-300 border-amber-400/40 ring-1 ring-amber-400/30 shadow-md shadow-amber-500/20',
      podiumGlow: 'border-amber-400/30 shadow-amber-500/10'
    };
  }
  if (rank === 2) {
    return {
      icon: Medal,
      label: '2nd',
      bg: 'bg-slate-300/20 text-slate-200 border-slate-300/40 ring-1 ring-slate-300/20 shadow-md shadow-slate-300/10',
      podiumGlow: 'border-slate-400/30'
    };
  }
  if (rank === 3) {
    return {
      icon: Medal,
      label: '3rd',
      bg: 'bg-amber-700/25 text-amber-500 border-amber-700/40 ring-1 ring-amber-700/20',
      podiumGlow: 'border-amber-700/30'
    };
  }
  return {
    icon: null,
    label: `#${rank}`,
    bg: 'bg-slate-800 text-slate-400 border-slate-700',
    podiumGlow: ''
  };
};

export const Leaderboard = ({
  leaderboard = [],
  currentCourse,
  currentUser
}) => {
  const totalLectures = currentCourse?.totalLectures || 100;
  const topThree = leaderboard.slice(0, 3);

  return (
    <div className="space-y-6">
      
      {/* Title & Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>Group Leaderboard</span>
              <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                <TrendingUp className="w-3.5 h-3.5" />
                Live Standings
              </span>
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Tracking completion for <span className="text-slate-200 font-semibold">{currentCourse?.title}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
            {leaderboard.length} Enrolled {leaderboard.length === 1 ? 'Friend' : 'Friends'}
          </span>
        </div>
      </div>

      {/* Top 3 Podium Cards (Visual Highlights) */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {topThree.map((item, idx) => {
            const badge = getRankBadge(item.rank);
            const isMe = item.user?._id === currentUser?._id || item.user?.email === currentUser?.email;
            const percentage = item.completionPercentage ?? 0;

            return (
              <div
                key={item.user?._id || idx}
                className={`relative overflow-hidden rounded-2xl p-5 border transition-all ${
                  item.rank === 1
                    ? 'bg-gradient-to-b from-amber-500/10 via-slate-900 to-slate-900/90 border-amber-500/30 shadow-xl shadow-amber-500/5'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                } ${isMe ? 'ring-2 ring-brand-500/50' : ''}`}
              >
                {/* Crown / Trophy icon for #1 */}
                {item.rank === 1 && (
                  <div className="absolute top-3 right-3 text-amber-400/80 animate-float">
                    <Trophy className="w-6 h-6" />
                  </div>
                )}

                <div className="flex items-center gap-3.5 mb-3.5">
                  <div className="relative">
                    <img
                      src={item.user?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Buddy'}
                      alt={item.user?.name}
                      className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 object-cover"
                    />
                    <span className={`absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full text-[10px] font-black border ${badge.bg}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="min-w-0 pr-6">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-white truncate">
                        {item.user?.name}
                      </p>
                      {isMe && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-brand-500 text-white">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{formatRelativeTime(item.lastWatchedAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Progress Details */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-semibold text-slate-300">
                      {item.completedLectures} <span className="text-slate-500">/ {item.totalLectures || totalLectures}</span>
                    </span>
                    <span className="font-black text-sm text-brand-300">
                      {percentage}%
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${getProgressBarColor(percentage)} transition-all duration-500`}
                      style={{ width: `${Math.max(3, percentage)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Leaderboard List Table */}
      <div className="overflow-hidden rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            All Enrolled Buddies
          </h3>
          <span className="text-xs text-slate-500">
            Sorted by highest completion
          </span>
        </div>

        {leaderboard.length === 0 ? (
          <div className="py-12 text-center">
            <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">No buddies enrolled yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Log progress above to be the first on the leaderboard!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {leaderboard.map((entry, index) => {
              const rank = entry.rank || index + 1;
              const badge = getRankBadge(rank);
              const isMe = entry.user?._id === currentUser?._id || entry.user?.email === currentUser?.email;
              const percentage = entry.completionPercentage ?? 0;

              return (
                <div
                  key={entry.user?._id || index}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    isMe
                      ? 'bg-brand-500/10 hover:bg-brand-500/15 border-l-4 border-l-brand-500'
                      : 'hover:bg-slate-850/60'
                  }`}
                >
                  {/* Left: Rank, Avatar, Name */}
                  <div className="flex items-center gap-3.5 min-w-0 sm:w-1/3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs border ${badge.bg}`}>
                      {badge.label}
                    </div>

                    <img
                      src={entry.user?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Buddy'}
                      alt={entry.user?.name}
                      className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex-shrink-0"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-bold truncate ${isMe ? 'text-brand-300' : 'text-slate-200'}`}>
                          {entry.user?.name}
                        </p>
                        {isMe && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-brand-500 text-white flex-shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{formatRelativeTime(entry.lastWatchedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Progress Bar & Lecture Ratio */}
                  <div className="flex-1 sm:px-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-300">
                        {entry.completedLectures} <span className="text-slate-500">/ {entry.totalLectures || totalLectures} lectures</span>
                      </span>
                      <span className="font-bold text-slate-300 sm:hidden">
                        {percentage}%
                      </span>
                    </div>

                    {/* Progress Track */}
                    <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700/50">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${getProgressBarColor(percentage)} transition-all duration-300`}
                        style={{ width: `${Math.max(2, percentage)}%` }}
                      />
                    </div>
                  </div>

                  {/* Right: Percentage Pill */}
                  <div className="hidden sm:flex items-center justify-end sm:w-28">
                    <span className={`px-3 py-1.5 rounded-xl font-mono font-bold text-sm border ${
                      percentage >= 80
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : percentage >= 50
                        ? 'bg-brand-500/10 text-brand-300 border-brand-500/20'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
