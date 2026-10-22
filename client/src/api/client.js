// API Client for BuddyTracker Express backend (HttpOnly cookies & real data)

const API_BASE = '/api';

const USER_KEY = 'buddy_tracker_user';

export const setStoredAuth = (token, user) => {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
};

export const clearStoredAuth = () => {
  localStorage.removeItem(USER_KEY);
};

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

let isRefreshing = false;

const request = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  let res = await fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: 'include', // Automatically send & receive HttpOnly cookies
    headers
  });

  // Handle 401 with silent token refresh attempt
  if (res.status === 401 && !url.includes('/auth/refresh') && !url.includes('/auth/login') && !isRefreshing) {
    try {
      isRefreshing = true;
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include'
      });

      if (refreshRes.ok) {
        // Token rotated successfully in HttpOnly cookie; retry original request
        res = await fetch(`${API_BASE}${url}`, {
          ...options,
          credentials: 'include',
          headers
        });
      }
    } catch {
      // Ignore refresh network errors
    } finally {
      isRefreshing = false;
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    let message = data.message;
    if (!message) {
      if (res.status === 502 || res.status === 503) {
        message = 'Backend API on port 5000 is offline. Please make sure the Express server is running (npm run dev:server).';
      } else {
        message = `Request failed with status ${res.status}`;
      }
    }
    const error = new Error(message);
    error.errors = data.errors;
    error.status = res.status;
    throw error;
  }

  return data;
};

// API Services directly communicating with the Express backend
export const api = {
  checkHealth: async () => {
    try {
      const data = await request('/health');
      return { live: true, data };
    } catch {
      return { live: false };
    }
  },

  getMe: async () => {
    try {
      const res = await request('/auth/me');
      return res.data?.user || null;
    } catch {
      return null;
    }
  },

  login: async ({ email, password }) => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setStoredAuth(null, res.data.user);
    return res.data;
  },

  register: async ({ name, email, password, avatar }) => {
    const res = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, avatar })
    });
    setStoredAuth(null, res.data.user);
    return res.data;
  },

  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    clearStoredAuth();
  },

  getCourses: async () => {
    try {
      const res = await request('/courses');
      return res.data?.courses || [];
    } catch {
      return [];
    }
  },

  createCourse: async ({ title, udemyCourseId, totalLectures }) => {
    const res = await request('/courses', {
      method: 'POST',
      body: JSON.stringify({ title, udemyCourseId, totalLectures })
    });
    return res.data.course;
  },

  deleteCourse: async (courseId) => {
    const res = await request(`/courses/${courseId}`, {
      method: 'DELETE'
    });
    return res.data;
  },

  getLeaderboard: async (courseId) => {
    if (!courseId) {
      return { course: null, enrolledCount: 0, leaderboard: [] };
    }
    const res = await request(`/courses/${courseId}/leaderboard`);
    return res.data;
  },

  syncProgress: async ({ courseId, completedLectures, completedLectureIds, allowRollback, clientTimestamp }) => {
    const res = await request('/progress/sync', {
      method: 'PATCH',
      body: JSON.stringify({
        courseId,
        completedLectures,
        completedLectureIds,
        allowRollback,
        clientTimestamp: clientTimestamp || new Date().toISOString(),
        source: 'web_manual'
      })
    });
    return res.data;
  },

  getApiKeys: async () => {
    try {
      const res = await request('/auth/api-keys');
      return res.data?.keys || [];
    } catch {
      return [];
    }
  },

  createApiKey: async (name = 'Chrome Extension') => {
    const res = await request('/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    return res.data;
  },

  revokeApiKey: async (keyId) => {
    const res = await request(`/auth/api-keys/${keyId}`, {
      method: 'DELETE'
    });
    return res.data;
  },

  getProgressHistory: async (courseId) => {
    if (!courseId) return { history: [], dailyStreak: 0 };
    try {
      const res = await request(`/progress/${courseId}/history`);
      return res.data;
    } catch {
      return { history: [], dailyStreak: 0 };
    }
  }
};
