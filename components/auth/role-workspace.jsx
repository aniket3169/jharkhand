'use client';
import Link from 'next/link';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import Dashboard from '@/components/dashboards/dashboard';
import { usePortal } from '@/components/providers/portal-provider';
export default function RoleWorkspace({ role }) { const { user, loading } = usePortal(); const allowed = user?.role === role || user?.role === 'admin' || role === 'partner' && ['industry', 'ngo'].includes(user?.role); if (loading) return <div className="page-skeleton"><div /><div /><div /><div /></div>; if (!allowed) return <div className="empty-state card"><ShieldCheck size={35} /><h2>Your {role} workspace</h2><p>Sign in with the appropriate account to access this workspace and its tools.</p><Link className="btn btn-primary" href="/login">Choose your account <ArrowRight size={16} /></Link></div>; return <Dashboard role={role === 'partner' ? user.role : role} />; }
