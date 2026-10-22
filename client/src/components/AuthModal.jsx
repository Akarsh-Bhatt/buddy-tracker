import React, { useState, useEffect } from 'react';
import {
  X,
  LogIn,
  UserPlus,
  Key,
  Mail,
  User,
  Copy,
  Check,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  LogOut,
  Clock
} from 'lucide-react';
import { api } from '../api/client';

export const AuthModal = ({
  isOpen,
  onClose,
  currentUser,
  onLogin,
  onRegister,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState(currentUser ? 'keys' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // API Key state
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyData, setNewKeyData] = useState(null);
  const [keyName, setKeyName] = useState('');
  const [copied, setCopied] = useState(false);

  // Sync default tab when opening modal
  useEffect(() => {
    if (isOpen) {
      setActiveTab(currentUser ? 'keys' : 'login');
      setError('');
    }
  }, [isOpen, currentUser]);

  // Load API keys when switching to keys tab
  useEffect(() => {
    if (isOpen && activeTab === 'keys' && currentUser) {
      loadKeys();
    }
  }, [isOpen, activeTab, currentUser]);

  const loadKeys = async () => {
    try {
      const keys = await api.getApiKeys();
      setApiKeys(keys);
    } catch {
      setApiKeys([]);
    }
  };

  if (!isOpen) return null;

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (activeTab === 'login') {
        await onLogin({ email, password });
      } else if (activeTab === 'register') {
        await onRegister({ name, email, password });
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.createApiKey(keyName || 'Chrome Extension');
      const keyObj = res?.apiKey ? res : res?.data;
      setNewKeyData(keyObj);
      setKeyName('');

      // Auto-copy key to clipboard immediately
      if (keyObj?.apiKey && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(keyObj.apiKey);
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        } catch {
          // Clipboard API permission denied; user can click the manual Copy button
        }
      }

      await loadKeys();
    } catch (err) {
      setError(err.message || 'Failed to generate API key');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeKey = async (keyId) => {
    if (
      !window.confirm(
        'Are you sure you want to revoke this extension API key? The extension will immediately stop syncing until a new key is added.'
      )
    ) {
      return;
    }
    try {
      await api.revokeApiKey(keyId);
      await loadKeys();
    } catch (err) {
      setError(err.message || 'Failed to revoke API key');
    }
  };

  const handleCopyKey = () => {
    if (newKeyData?.apiKey) {
      navigator.clipboard.writeText(newKeyData.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in-0 duration-200">
      <div
        className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-7 shadow-2xl shadow-black/80 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Tabs */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-white mb-3">
            Security & Authentication
          </h3>
          <div className="grid grid-cols-3 rounded-xl bg-slate-950 p-1 border border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('keys');
                setError('');
              }}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold truncate transition-all ${
                activeTab === 'keys'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Extension Keys
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError('');
              }}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold truncate transition-all ${
                activeTab === 'login'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setError('');
              }}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold truncate transition-all ${
                activeTab === 'register'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Tab 1: Extension Scoped API Keys */}
        {activeTab === 'keys' && (
          <div className="space-y-5">
            {!currentUser ? (
              <div className="p-6 text-center space-y-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <ShieldCheck className="w-8 h-8 text-brand-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Sign In to Manage Keys</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  To generate scoped extension keys, you must be signed in with your BuddyTracker account.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 transition-all"
                >
                  Sign In Now
                </button>
              </div>
            ) : (
              <>
                <div className="p-3.5 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-xs text-brand-300">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <ShieldCheck className="w-4 h-4 text-brand-400" />
                    Scoped Extension Authentication
                  </div>
                  <p className="text-slate-300">
                    To protect your web session, your master JWT is stored in{' '}
                    <strong>HttpOnly, SameSite: Strict</strong> cookies. Generate a scoped extension key below to paste into the Chrome Extension.
                  </p>
                </div>

                {/* Newly Generated Key Banner */}
                {newKeyData?.apiKey && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-2.5 animate-in fade-in-0 duration-200">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        New Scoped API Key Generated
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold">
                        {copied ? 'Copied to clipboard!' : 'Click Copy below'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={newKeyData.apiKey}
                        onClick={(e) => e.target.select()}
                        className="w-full font-mono text-[11px] bg-slate-950 p-2.5 rounded-xl border border-emerald-500/40 text-emerald-300 select-all cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={handleCopyKey}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs transition-all flex-shrink-0 shadow-sm active:scale-95"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied!' : 'Copy Key'}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-amber-300 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      Paste this full key into your Chrome Extension. It is stored hashed in the database and cannot be retrieved later.
                    </p>
                  </div>
                )}

                {/* Generate Key Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Key label (e.g. Laptop Chrome)"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-brand-500 transition-all placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleGenerateKey}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-brand-600 hover:bg-brand-500 transition-all shadow-md shadow-brand-500/20 disabled:opacity-50 whitespace-nowrap"
                  >
                    + Generate Key
                  </button>
                </div>

                {/* List of Active Keys */}
                <div className="space-y-2 pt-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Active Extension Keys ({apiKeys.length})
                  </h4>
                  {apiKeys.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 text-center border border-dashed border-slate-800 rounded-xl">
                      No active extension keys yet. Generate one to sync from Udemy.
                    </p>
                  ) : (
                    apiKeys.map((k) => (
                      <div
                        key={k._id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-200">{k.name}</span>
                            <span
                              className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                                k.isActive
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}
                            >
                              {k.isActive ? 'Active' : 'Revoked'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                            <span>{k.prefix}</span>
                            {k.lastUsedAt && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <Clock className="w-3 h-3" />
                                Used {new Date(k.lastUsedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {k.isActive && (
                          <button
                            type="button"
                            onClick={() => handleRevokeKey(k._id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:text-white hover:bg-red-500/20 border border-red-500/30 transition-all"
                            title="Revoke this API Key immediately"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revoke</span>
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2 & 3: Real Auth Form */}
        {(activeTab === 'login' || activeTab === 'register') && (
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {activeTab === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Lin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-brand-500 transition-all placeholder:text-slate-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-brand-500 transition-all placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-slate-500" />
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-brand-500 transition-all placeholder:text-slate-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl font-bold text-xs text-white bg-brand-600 hover:bg-brand-500 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50"
            >
              {loading
                ? 'Authenticating...'
                : activeTab === 'login'
                ? 'Sign In'
                : 'Create Account & Sign In'}
            </button>
          </form>
        )}

        {/* Modal Footer with Logout Option if logged in */}
        {currentUser && (
          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Signed in as: <strong className="text-slate-300">{currentUser.name}</strong> ({currentUser.email})
            </span>
            <button
              type="button"
              onClick={async () => {
                await onLogout?.();
                onClose();
              }}
              className="flex items-center gap-1 text-slate-400 hover:text-red-400 transition-colors font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
