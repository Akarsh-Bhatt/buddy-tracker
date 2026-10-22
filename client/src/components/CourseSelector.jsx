import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, ChevronDown, Check, Plus, ExternalLink, Hash, Trash2 } from 'lucide-react';

export const CourseSelector = ({
  courses = [],
  selectedCourse,
  onSelectCourse,
  onOpenAddCourse,
  onDeleteCourse
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
        Tracked Udemy Course
      </label>

      {/* Main Trigger Button */}
      <button
        id="course-selector-trigger"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-850/90 border border-slate-800 hover:border-slate-700 transition-all text-left group shadow-lg"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:text-indigo-300">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                {selectedCourse?.title || 'Select a course...'}
              </h2>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
              <span className="flex items-center gap-1 font-mono text-[11px] bg-slate-800 px-2 py-0.5 rounded-md text-slate-300 border border-slate-700">
                <Hash className="w-3 h-3 text-slate-500" />
                {selectedCourse?.udemyCourseId || 'N/A'}
              </span>
              <span>•</span>
              <span className="font-medium text-slate-300">
                {selectedCourse?.totalLectures || 0} Total Lectures
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 pl-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20 hidden md:inline-block">
            {courses.length} Available
          </span>
          <ChevronDown
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-brand-400' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 z-50 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl shadow-black/80 overflow-hidden backdrop-blur-2xl animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="p-2 max-h-72 overflow-y-auto space-y-1">
            {courses.length === 0 ? (
              <div className="py-6 px-3 text-center text-xs text-slate-500">
                No courses added yet. Click below to add your first course!
              </div>
            ) : (
              courses.map((course) => {
                const isSelected = course._id === selectedCourse?._id;
                return (
                  <button
                    key={course._id}
                    type="button"
                    onClick={() => {
                      onSelectCourse(course);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left ${
                      isSelected
                        ? 'bg-brand-600/15 text-white border border-brand-500/30'
                        : 'hover:bg-slate-800/70 text-slate-300 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className={`text-sm font-semibold truncate ${isSelected ? 'text-brand-300' : 'text-slate-200'}`}>
                        {course.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <span className="font-mono text-[11px] bg-slate-950 px-1.5 py-0.5 rounded text-slate-400">
                          ID: {course.udemyCourseId}
                        </span>
                        <span>•</span>
                        <span>{course.totalLectures} lectures</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                      {onDeleteCourse && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Are you sure you want to remove "${course.title}"?`)) {
                              onDeleteCourse(course._id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remove course"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Add Course Footer Action */}
          <div className="p-2 border-t border-slate-800 bg-slate-950/60">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenAddCourse();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 border border-brand-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Another Udemy Course
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
