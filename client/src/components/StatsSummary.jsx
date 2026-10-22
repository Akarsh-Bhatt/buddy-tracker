import React from 'react';
import { Users, Target, CheckCircle2, Crown, Zap } from 'lucide-react';

export const StatsSummary = ({ leaderboard = [], currentCourse }) => {
  const totalEnrolled = leaderboard.length;
  const totalCourseLectures = currentCourse?.totalLectures || 100;

  const totalGroupCompleted = leaderboard.reduce(
    (acc, curr) => acc + (curr.completedLectures || 0),
    0
  );

  const averagePercentage = totalEnrolled > 0
    ? Math.round(
        (leaderboard.reduce((acc, curr) => acc + (curr.completionPercentage || 0), 0) /
          totalEnrolled) *
          10
      ) / 10
    : 0;

  const leader = leaderboard[0];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      
      {/* Metric 1: Group Average */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 flex-shrink-0">
          <Target className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Group Average
          </p>
          <p className="text-xl sm:text-2xl font-black text-white mt-0.5">
            {averagePercentage}%
          </p>
        </div>
      </div>

      {/* Metric 2: Total Completed */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Finished
          </p>
          <p className="text-xl sm:text-2xl font-black text-white mt-0.5">
            {totalGroupCompleted} <span className="text-xs text-slate-500 font-normal">lecs</span>
          </p>
        </div>
      </div>

      {/* Metric 3: Group Leader */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
          <Crown className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Current Leader
          </p>
          <p className="text-sm sm:text-base font-bold text-white mt-0.5 truncate">
            {leader ? leader.user?.name : 'None yet'}
          </p>
          {leader && (
            <p className="text-[11px] text-amber-400 font-medium">
              {leader.completionPercentage}% ({leader.completedLectures} lecs)
            </p>
          )}
        </div>
      </div>

      {/* Metric 4: Enrolled Buddies */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Active Buddies
          </p>
          <p className="text-xl sm:text-2xl font-black text-white mt-0.5">
            {totalEnrolled}
          </p>
        </div>
      </div>

    </div>
  );
};
