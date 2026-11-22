import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  Mail,
  Store,
  Shield,
  CheckCircle,
  AlertCircle,
  X,
  LogIn,
  UserPlus,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { setCurrentUser, getCurrentUser } from '../utils/persistentSync.js';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [tab, setTab] = useState('login'); // 'login' or 'register'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regShopName, setRegShopName] = useState('Waffel Den');
  const [regRole, setRegRole] = useState('owner');

  // Existing accounts list for quick switcher
  const [existingUsers, setExistingUsers] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchExistingUsers();
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  const fetchExistingUsers = async () => {
    try {
      const res = await fetch('/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        setExistingUsers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Could not fetch users list:', err);
    }
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!loginUsername.trim() || !loginPassword) {
      setErrorMsg('Please enter username and password');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setCurrentUser(data.user, data.token);
      setSuccessMsg(`Welcome back, ${data.user.name}!`);
      setTimeout(() => {
        if (onAuthSuccess) onAuthSuccess(data.user);
        if (onClose) onClose();
      }, 600);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regName.trim()) {
      setErrorMsg('Please enter your full name');
      return;
    }
    if (!regUsername.trim() || regUsername.trim().length < 3) {
      setErrorMsg('Username must be at least 3 characters');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setErrorMsg('Password must be at least 4 characters');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          username: regUsername.trim(),
          email: regEmail.trim(),
          password: regPassword,
          shop_name: regShopName.trim() || 'Waffel Den',
          role: regRole
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setCurrentUser(data.user, data.token);
      setSuccessMsg(`Account created! Welcome, ${data.user.name}!`);
      setTimeout(() => {
        if (onAuthSuccess) onAuthSuccess(data.user);
        if (onClose) onClose();
      }, 700);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = (username, password) => {
    setLoginUsername(username);
    setLoginPassword(password);
    setTab('login');
  };

  if (!isOpen) return null;

  const currentUser = getCurrentUser();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header Banner */}
        <div className="bg-gradient-to-br from-amber-600 via-amber-700 to-stone-900 text-white p-6 relative">
          {currentUser && onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-xs flex items-center justify-center text-2xl shadow-inner">
              🧇
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Waffel Den Account</h2>
              <p className="text-xs text-amber-200/90 mt-0.5">
                {currentUser 
                  ? `Signed in as ${currentUser.name} (${currentUser.username})` 
                  : 'Individual account login for isolated counter data'}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex rounded-xl bg-black/20 p-1 mt-5">
            <button
              type="button"
              onClick={() => { setTab('login'); setErrorMsg(''); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                tab === 'login' ? 'bg-white text-stone-900 shadow-sm' : 'text-amber-100 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setErrorMsg(''); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                tab === 'register' ? 'bg-white text-stone-900 shadow-sm' : 'text-amber-100 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {tab === 'login' ? (
            /* --- LOGIN FORM --- */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="e.g. admin or your username"
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-600 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-600 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In to Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* --- REGISTER FORM --- */
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Your Full Name
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Nithin Sai or Sarah Jenkins"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-600 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. nithin31"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Role
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-600 focus:bg-white"
                  >
                    <option value="owner">Store Owner</option>
                    <option value="manager">Manager</option>
                    <option value="cashier">Counter Cashier</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Create password (min 4 chars)"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Shop / Counter Name
                </label>
                <input
                  type="text"
                  value={regShopName}
                  onChange={(e) => setRegShopName(e.target.value)}
                  placeholder="e.g. Waffel Den Counter 1"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-600 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create My Individual Account</span>
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Quick Demo Accounts Helper */}
          <div className="pt-4 border-t border-stone-100">
            <span className="block text-[11px] font-bold uppercase text-stone-600 tracking-wider mb-2">
              Fast Demo Accounts (1-Click Fill)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin', 'admin123')}
                className="p-2 bg-stone-50 hover:bg-amber-50 border border-stone-200 hover:border-amber-300 rounded-xl text-left transition cursor-pointer"
              >
                <div className="text-xs font-bold text-stone-800">Admin Manager</div>
                <div className="text-[10px] text-stone-500 font-mono">admin / admin123</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setRegName('Cashier Staff');
                  setRegUsername('cashier1');
                  setRegPassword('cashier123');
                  setRegRole('cashier');
                  setRegShopName('Waffel Den Counter');
                }}
                className="p-2 bg-stone-50 hover:bg-amber-50 border border-stone-200 hover:border-amber-300 rounded-xl text-left transition cursor-pointer"
              >
                <div className="text-xs font-bold text-stone-800">+ New Cashier</div>
                <div className="text-[10px] text-stone-500">Create second account</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
