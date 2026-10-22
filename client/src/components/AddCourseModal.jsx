import React, { useState } from 'react';
import { X, BookPlus, Hash, Layers, Check } from 'lucide-react';

export const AddCourseModal = ({ isOpen, onClose, onAddCourse }) => {
  const [title, setTitle] = useState('');
  const [udemyCourseId, setUdemyCourseId] = useState('');
  const [totalLectures, setTotalLectures] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Course title is required');
      return;
    }
    if (!udemyCourseId.trim()) {
      setError('Udemy course ID or URL slug is required');
      return;
    }
    const parsed = parseInt(totalLectures, 10);
    if (isNaN(parsed) || parsed < 1) {
      setError('Total lectures must be a positive number of at least 1');
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddCourse({
        title: title.trim(),
        udemyCourseId: udemyCourseId.trim(),
        totalLectures: parsed
      });
      setTitle('');
      setUdemyCourseId('');
      setTotalLectures('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add course');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in-0 duration-200">
      <div
        className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl shadow-black/80"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-add-course-title"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <BookPlus className="w-6 h-6" />
          </div>
          <div>
            <h3 id="modal-add-course-title" className="text-lg font-bold text-white">
              Add New Udemy Course
            </h3>
            <p className="text-xs text-slate-400">
              Set up a shared course tracker for you and your friends
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Course Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 100 Days of Code: Complete Python Pro Bootcamp"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-white text-sm outline-none transition-all placeholder:text-slate-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-500" />
                Udemy Course ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 2776760"
                value={udemyCourseId}
                onChange={(e) => setUdemyCourseId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-white text-sm outline-none transition-all placeholder:text-slate-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                Total Lectures
              </label>
              <input
                type="number"
                min="1"
                required
                placeholder="e.g. 620"
                value={totalLectures}
                onChange={(e) => setTotalLectures(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-white text-sm outline-none transition-all placeholder:text-slate-600 font-mono"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 active:scale-95 transition-all shadow-lg shadow-brand-500/25 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Adding...' : 'Create Course'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
