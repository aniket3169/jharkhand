'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const PortalContext = createContext(null);
export async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, ...(options.body && typeof options.body !== 'string' ? { body: JSON.stringify(options.body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
export function PortalProvider({ children }) {
  const [user, setUser] = useState(null);
  const [problems, setProblems] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState({ locationThresholdMeters: 50 });
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(true);
  const [integrations, setIntegrations] = useState({ gemini: false, storage: false });
  const [toasts, setToasts] = useState([]);
  const notify = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random(); setToasts(current => [...current.slice(-3), { id, message, type }]);
    setTimeout(() => setToasts(current => current.filter(item => item.id !== id)), 5500);
  }, []);
  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([api('/api/problems'), api('/api/notifications'), api('/api/settings')]);
    if (results[0].status === 'fulfilled') setProblems(results[0].value.problems || []);
    if (results[1].status === 'fulfilled') setNotifications(results[1].value.notifications || []);
    if (results[2].status === 'fulfilled') setSettings(results[2].value.settings || {});
    if (results[0].status === 'rejected') throw results[0].reason;
  }, []);
  useEffect(() => { let live = true; (async () => { try { const session = await api('/api/auth'); if (live) { setUser(session.user); setDemo(session.demo); setIntegrations(session.integrations || {}); } await refresh(); } catch (error) { notify(error.message, 'error'); } finally { if (live) setLoading(false); } })(); return () => { live = false; }; }, [refresh, notify]);
  const login = useCallback(async (role, name) => { const result = await api('/api/auth', { method: 'POST', body: { role, name } }); setUser(result.user); await refresh(); return result.user; }, [refresh]);
  const logout = useCallback(async () => { await api('/api/auth', { method: 'DELETE' }); setUser(null); await refresh(); notify('You have been signed out.'); }, [refresh, notify]);
  const markRead = async (id) => { await api('/api/notifications', { method: 'PATCH', body: { id, all: id === 'all' } }); await refresh(); };
  return <PortalContext.Provider value={{ user, problems, notifications, settings, loading, demo, integrations, refresh, notify, login, logout, markRead }}>
    {children}<div className="toast-stack" aria-live="polite"><AnimatePresence>{toasts.map(toast => <motion.div key={toast.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`toast ${toast.type === 'error' ? 'toast-error' : ''}`}>{toast.type === 'error' ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}<span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToasts(current => current.filter(item => item.id !== toast.id))}><X size={16} /></button></motion.div>)}</AnimatePresence></div>
  </PortalContext.Provider>;
}
export function usePortal() { const value = useContext(PortalContext); if (!value) throw new Error('usePortal requires PortalProvider'); return value; }
