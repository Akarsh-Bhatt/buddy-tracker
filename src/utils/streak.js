/**
 * Streak Calculation Utility
 * Calculates consecutive daily streaks from progress audit history logs.
 */
export function calculateStreak(historyEntries = []) {
  if (!historyEntries || !Array.isArray(historyEntries) || historyEntries.length === 0) {
    return 0;
  }

  // Extract unique calendar dates (YYYY-MM-DD in UTC) where progress was made
  const dateSet = new Set();
  for (const entry of historyEntries) {
    if (entry.timestamp) {
      const d = new Date(entry.timestamp);
      if (!isNaN(d.getTime())) {
        dateSet.add(d.toISOString().slice(0, 10));
      }
    }
  }

  const sortedDates = Array.from(dateSet).sort().reverse();
  if (sortedDates.length === 0) return 0;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // If latest recorded activity was neither today nor yesterday, the streak is broken
  if (sortedDates[0] !== todayStr && sortedDates[0] !== yesterdayStr) {
    return 0;
  }

  let streak = 0;
  let expectedDate = new Date(sortedDates[0] + 'T00:00:00.000Z');

  for (const dateStr of sortedDates) {
    const currentDate = new Date(dateStr + 'T00:00:00.000Z');
    const diffDays = Math.round((expectedDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      streak += 1;
      expectedDate.setUTCDate(expectedDate.getUTCDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
