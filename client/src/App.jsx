import React, { useState, useEffect } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient
} from '@tanstack/react-query';
import { Header } from './components/Header';
import { CourseSelector } from './components/CourseSelector';
import { ProgressLogger } from './components/ProgressLogger';
import { Leaderboard } from './components/Leaderboard';
import { AddCourseModal } from './components/AddCourseModal';
import { AuthModal } from './components/AuthModal';
import { StatsSummary } from './components/StatsSummary';
import {
  api,
  getStoredUser,
  setStoredAuth,
  clearStoredAuth
} from './api/client';
import { RefreshCw } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

function Dashboard() {
  const qc = useQueryClient();

  const [currentUser, setCurrentUser] = useState(getStoredUser());
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLiveApi, setIsLiveApi] = useState(false);

  // Check backend health and restore session from HttpOnly cookie on mount
  useEffect(() => {
    api.checkHealth().then((res) => {
      setIsLiveApi(res.live);
    });

    api.getMe().then((user) => {
      if (user) {
        setCurrentUser(user);
        setStoredAuth(null, user);
      } else {
        setCurrentUser(null);
        clearStoredAuth();
      }
    }).catch(() => {
      setCurrentUser(null);
      clearStoredAuth();
    });
  }, []);

  // Fetch available courses from real backend database
  const {
    data: courses = [],
    isLoading: isLoadingCourses,
    refetch: refetchCourses
  } = useQuery({
    queryKey: ['courses'],
    queryFn: api.getCourses
  });

  // Default selected course
  useEffect(() => {
    if (courses.length > 0 && !selectedCourse) {
      setSelectedCourse(courses[0]);
    } else if (courses.length === 0) {
      setSelectedCourse(null);
    }
  }, [courses, selectedCourse]);

  // Fetch leaderboard for selected course
  const {
    data: leaderboardData,
    isLoading: isLoadingLeaderboard,
    isFetching: isFetchingLeaderboard,
    refetch: refetchLeaderboard
  } = useQuery({
    queryKey: ['leaderboard', selectedCourse?._id],
    queryFn: () => api.getLeaderboard(selectedCourse?._id),
    enabled: !!selectedCourse?._id
  });

  const leaderboard = leaderboardData?.leaderboard || [];

  // Find current user's entry in the leaderboard
  const currentUserEntry = leaderboard.find(
    (item) => item.user?._id === currentUser?._id || item.user?.email === currentUser?.email
  );

  // Mutation for syncing progress with OPTIMISTIC UI updates
  const syncMutation = useMutation({
    mutationFn: ({ courseId, completedLectures, allowRollback }) =>
      api.syncProgress({ courseId, completedLectures, allowRollback }),

    onMutate: async ({ courseId, completedLectures }) => {
      // 1. Cancel outgoing queries so they don't overwrite optimistic update
      await qc.cancelQueries({ queryKey: ['leaderboard', courseId] });

      // 2. Snapshot previous value
      const previousData = qc.getQueryData(['leaderboard', courseId]);

      // 3. Optimistically update leaderboard cache
      if (previousData) {
        const total = selectedCourse?.totalLectures || 100;
        const newPct = Math.round((completedLectures / total) * 1000) / 10;

        let updatedList = [...(previousData.leaderboard || [])];
        const existingIndex = updatedList.findIndex(
          (entry) => entry.user?._id === currentUser?._id || entry.user?.email === currentUser?.email
        );

        const newEntry = {
          user: currentUser,
          completedLectures,
          totalLectures: total,
          completionPercentage: newPct,
          lastWatchedAt: new Date().toISOString()
        };

        if (existingIndex >= 0) {
          updatedList[existingIndex] = { ...updatedList[existingIndex], ...newEntry };
        } else {
          updatedList.push(newEntry);
        }

        // Sort by highest completion
        updatedList.sort((a, b) => (b.completionPercentage || 0) - (a.completionPercentage || 0));

        // Re-assign ranks
        updatedList = updatedList.map((entry, idx) => ({
          ...entry,
          rank: idx + 1
        }));

        qc.setQueryData(['leaderboard', courseId], {
          ...previousData,
          leaderboard: updatedList
        });
      }

      return { previousData };
    },

    onError: (err, variables, context) => {
      // Rollback to previous value on failure
      if (context?.previousData) {
        qc.setQueryData(['leaderboard', variables.courseId], context.previousData);
      }
    },

    onSettled: (data, err, variables) => {
      // Invalidate query to sync with authoritative backend response
      qc.invalidateQueries({ queryKey: ['leaderboard', variables.courseId] });
    }
  });

  // Mutation for creating a new course
  const addCourseMutation = useMutation({
    mutationFn: api.createCourse,
    onSuccess: (newCourse) => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      setSelectedCourse(newCourse);
    }
  });

  // Mutation for deleting a course
  const deleteCourseMutation = useMutation({
    mutationFn: api.deleteCourse,
    onSuccess: (deletedData, courseId) => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      if (selectedCourse?._id === courseId) {
        setSelectedCourse(null);
      }
    }
  });

  const handleLogin = async (credentials) => {
    const res = await api.login(credentials);
    setCurrentUser(res.user);
    setIsLiveApi(true);
    qc.invalidateQueries();
  };

  const handleRegister = async (data) => {
    const res = await api.register(data);
    setCurrentUser(res.user);
    setIsLiveApi(true);
    qc.invalidateQueries();
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    qc.invalidateQueries();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Header */}
      <Header
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenAddCourse={() => setIsAddCourseOpen(true)}
        isLiveApi={isLiveApi}
        coursesCount={courses.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Course Selector Dropdown & Stats Summary Bar */}
        <section className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="flex-1 max-w-xl">
              <CourseSelector
                courses={courses}
                selectedCourse={selectedCourse}
                onSelectCourse={setSelectedCourse}
                onOpenAddCourse={() => setIsAddCourseOpen(true)}
                onDeleteCourse={(courseId) => deleteCourseMutation.mutate(courseId)}
              />
            </div>

            {/* Quick Refresh Button */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  refetchCourses();
                  refetchLeaderboard();
                }}
                disabled={isFetchingLeaderboard}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-all active:scale-95"
                title="Refresh leaderboard stats"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingLeaderboard ? 'animate-spin text-brand-400' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Group Overview Stats Cards */}
          <StatsSummary
            leaderboard={leaderboard}
            currentCourse={selectedCourse}
          />
        </section>

        {/* Personal Progress Display */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Your Active Progress
            </h2>
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Extension Auto-Sync
            </span>
          </div>

          <ProgressLogger
            currentUser={currentUser}
            selectedCourse={selectedCourse}
            currentProgress={currentUserEntry}
            onOpenAuth={() => setIsAuthOpen(true)}
            userRank={currentUserEntry?.rank}
          />
        </section>

        {/* Group Leaderboard & Standings */}
        <section>
          <Leaderboard
            leaderboard={leaderboard}
            currentCourse={selectedCourse}
            currentUser={currentUser}
          />
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>BuddyTracker • Shared Udemy Course Tracker with Real-Time Leaderboards</p>
      </footer>

      {/* Modals */}
      <AddCourseModal
        isOpen={isAddCourseOpen}
        onClose={() => setIsAddCourseOpen(false)}
        onAddCourse={(courseData) => addCourseMutation.mutateAsync(courseData)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onLogout={handleLogout}
      />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
