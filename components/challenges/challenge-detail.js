'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Users, CalendarDays, Sparkles, Clock3, MessageSquare, Layers3, ArrowLeftRight, Send, ShieldCheck, GraduationCap, CheckCircle2, X, HelpCircle, FileText, LoaderCircle } from 'lucide-react';
import { usePortal } from '@/components/providers/portal-provider';
import { universities } from '@/data/seed';
import { CategoryIcon, StatusBadge } from './challenge-card';
import ProjectWorkspace from './project-workspace';
import ResolutionPanel, { EvidenceGallery } from './resolution-panel';
import '@/components/maps/maps.css';
import './challenges.css';

const MapCanvas = dynamic(() => import('@/components/maps/map-canvas'), { ssr: false, loading: () => <div className="challenge-map-loading">Loading map…</div> });
const dateLabel = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently';
const POST_ACTIONS = ['validate', 'assign', 'resolution', 'after-evidence', 'verify-location', 'resolve'];

export default function ChallengeDetail({ id }) {
  const { user, refresh, notify } = usePortal();
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('overview');
  const load = useCallback(async () => {
    const response = await fetch(`/api/problems/${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'This challenge could not be loaded.');
    setProblem(data.problem); return data.problem;
  }, [id]);
  useEffect(() => { let active = true; setLoading(true); setError(''); load().catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [load, user?.id, user?.role]);
  async function mutate(action, values) {
    setBusy(true); setError('');
    try {
      const post = POST_ACTIONS.includes(action);
      const response = await fetch(`/api/problems/${encodeURIComponent(id)}${post ? `/${action}` : ''}`, { method: post ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(post ? values : { action, ...values }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'This change could not be saved. Please try again.');
      if (data.problem) setProblem(data.problem); else await load();
      await refresh?.();
      notify?.(action === 'verify-location' ? 'Location comparison completed.' : action === 'resolve' ? 'Challenge resolved. Thank you for making a difference.' : 'Your update has been saved.', 'success');
      return data;
    } catch (e) { setError(e.message); notify?.(e.message, 'error'); return null; } finally { setBusy(false); }
  }
  if (loading) return <div className="challenge-page challenge-loading"><LoaderCircle size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />Loading the story behind this challenge…</div>;
  if (!problem) return <div className="challenge-page"><Link className="challenge-back" href="/challenges"><ArrowLeft size={14} />All challenges</Link><div className="challenge-empty"><HelpCircle size={30} /><h3>Challenge unavailable</h3><p>{error || 'We could not find this challenge.'}</p><button className="btn btn-secondary" onClick={() => { setLoading(true); load().catch(e => setError(e.message)).finally(() => setLoading(false)); }}>Try again</button></div></div>;
  const role = user?.role?.toLowerCase();
  const isAuthority = ['authority', 'admin'].includes(role);
  const isUniversity = role === 'university';
  const isPartner = ['industry', 'ngo', 'partner'].includes(role);
  const canWork = isAuthority || (isUniversity && (problem.assignedUniversityId === user.organizationId || problem.assignedTo === user.organization || problem.assignedTo === user.organizationName));
  const analysis = problem.aiAnalysis || {};
  const timeline = [...(problem.timeline || [])].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  return <motion.div className="challenge-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <Link className="challenge-back" href="/challenges"><ArrowLeft size={14} />Back to challenges</Link>
    <div className="challenge-detail-header"><CategoryIcon category={problem.category} size={26} /><div className="challenge-detail-heading"><div className="challenge-detail-id"><span>{problem.id}</span><StatusBadge status={problem.status} />{problem.sample && <span>Sample challenge</span>}</div><h1>{problem.title}</h1><div className="challenge-detail-meta"><span><MapPin size={13} />{problem.district}, Jharkhand</span><span><Users size={13} />{Number(problem.affectedPopulation || 0).toLocaleString()} people affected</span><span><CalendarDays size={13} />{dateLabel(problem.createdAt)}</span></div></div><span className={`challenge-priority priority-${(problem.priority || 'Medium').toLowerCase()}`}><span />{problem.priority} priority</span></div>
    <div className="challenge-detail-tabs" role="tablist" aria-label="Challenge information">{[[FileText, 'overview', 'Overview'], [Layers3, 'workspace', 'Project workspace'], [MessageSquare, 'discussion', 'Discussion'], [ArrowLeftRight, 'evidence', 'Before & after']].map(([Icon, key, label]) => <button key={key} id={`tab-${key}`} className={tab === key ? 'active' : ''} role="tab" aria-selected={tab === key} aria-controls={`panel-${key}`} onClick={() => setTab(key)}><Icon size={15} />{label}{key === 'discussion' && <span className="challenge-members-count">{(problem.comments || []).length}</span>}</button>)}</div>
    {error && <div role="alert" className="challenge-notice error"><HelpCircle size={17} />{error}<button className="challenge-text-button" style={{ marginLeft: 'auto' }} aria-label="Dismiss error" onClick={() => setError('')}><X size={14} /></button></div>}
    <div className="challenge-detail-layout"><main className="challenge-detail-main" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {tab === 'overview' && <><section className="challenge-panel"><div className="challenge-panel-heading"><h2>The challenge</h2><span>{problem.category}</span></div><p>{problem.description}</p><div className="challenge-fact-grid"><div><span>People affected</span><strong>{Number(problem.affectedPopulation || 0).toLocaleString()}</strong></div><div><span>Reported severity</span><strong>{problem.severity || problem.priority}</strong></div><div><span>Reported by</span><strong>{problem.reporter?.name || 'Community member'}</strong></div></div></section>
        <section className="challenge-panel"><div className="challenge-panel-heading"><h2><Sparkles size={17} />Understanding the problem</h2><span className="challenge-ai-label">{analysis.source === 'demo' || problem.sample ? 'Sample analysis' : 'AI-generated · review required'}</span></div><p>{problem.summary}</p>{analysis.observations?.length > 0 && <><h3>Evidence observations</h3>{analysis.observations.map((observation, index) => <p key={index} className="challenge-note">{observation}</p>)}</>}<h3>Expertise that could help</h3><div className="challenge-tags">{(analysis.suggestedExpertise || problem.suggestedExpertise || [problem.category]).map((expertise, index) => <span key={index}>{expertise}</span>)}</div>{analysis.missingInformation?.length > 0 && <><h3>Still to understand</h3><p>{analysis.missingInformation.join(' · ')}</p></>}<div className="challenge-notice"><Sparkles size={15} />{analysis.source === 'demo' || problem.sample ? 'Sample insights are provided for demonstration. Field conditions require independent validation.' : 'AI insights support the review process. Observations and estimates are not independently verified facts.'}</div></section>
        <section className="challenge-panel"><div className="challenge-panel-heading"><h2>Community evidence</h2><span>{(problem.evidence || []).length} files · Before intervention</span></div><EvidenceGallery evidence={problem.evidence} /></section>
        <section className="challenge-panel"><h2><MapPin size={17} />Where change is needed</h2>{problem.location && <div className="challenge-location-map"><MapCanvas value={problem.location} readOnly /></div>}<div className="challenge-location-description"><div><strong>{problem.location?.address || `${problem.district}, Jharkhand`}</strong><small>{problem.location?.approximate || !user ? 'Approximate location displayed for privacy' : 'Location as recorded with the report'}</small></div>{problem.location?.accuracy != null && <small className="challenge-note">Device accuracy: approximately {Math.round(problem.location.accuracy)} meters</small>}</div></section></>}
      {tab === 'workspace' && <ProjectWorkspace key={problem.id} problem={problem} canWork={canWork} isUniversity={isUniversity} isPartner={isPartner} user={user} mutate={mutate} busy={busy} />}
      {tab === 'discussion' && <Discussion problem={problem} user={user} mutate={mutate} busy={busy} />}
      {tab === 'evidence' && <ResolutionPanel problem={problem} canWork={canWork} canResolve={isAuthority} isAdmin={role === 'admin'} mutate={mutate} busy={busy} />}
    </main><aside className="challenge-detail-aside">
      <section className="challenge-panel"><div className="challenge-aside-title"><h2>From challenge to change</h2><Clock3 size={16} color="#94a587" /></div><div className="challenge-progress-value"><span>Overall progress</span><strong>{problem.progress || 0}%</strong></div><div className="challenge-progress-track"><span style={{ width: `${problem.progress || 0}%` }} /></div><div className="challenge-timeline">{timeline.map((event, index) => <div className="challenge-timeline-item" key={event.id || index}><strong>{event.title || event.status || event.action}</strong>{event.description && <p>{event.description}</p>}<small>{dateLabel(event.date || event.createdAt)}</small></div>)}</div></section>
      {problem.assignedTo && <section className="challenge-panel"><h2>Leading the way</h2><div className="challenge-assignment"><span className="challenge-org-avatar"><GraduationCap size={19} /></span><div><strong>{problem.assignedTo}</strong><small>{problem.department || 'Project institution'}</small></div></div><p className="challenge-note">{(problem.team || []).length} team members · {(problem.collaborators || []).length} collaborating partners</p><button className="challenge-text-button" onClick={() => setTab('workspace')}>Meet the team <Users size={13} /></button></section>}
      {isAuthority && !['Resolved', 'Rejected', 'Closed'].includes(problem.status) && <AuthorityActions problem={problem} mutate={mutate} busy={busy} onEvidence={() => setTab('evidence')} />}
      {!user && <section className="challenge-panel"><h2>Your voice belongs here</h2><p>Sign in to join the discussion, follow progress, or contribute your expertise.</p><Link className="btn btn-primary" href={`/login?next=/challenges/${id}`}>Join the conversation</Link></section>}
      {isPartner && !['Resolved', 'Rejected', 'Submitted', 'Under review', 'Needs information'].includes(problem.status) && <section className="challenge-panel"><h2>Bring your expertise</h2><p>Help the team with mentorship, technology, funding, or implementation.</p><button className="btn btn-primary" onClick={() => setTab('workspace')}>Explore collaboration</button></section>}
      {canWork && !isAuthority && !['Resolved', 'Rejected', 'Closed'].includes(problem.status) && <section className="challenge-panel"><h2>Make progress visible</h2><p>Share milestones and field evidence with the community.</p><div className="challenge-role-actions"><button className="btn btn-secondary" onClick={() => setTab('workspace')}>Update workspace</button><button className="btn btn-primary" onClick={() => setTab('evidence')}>Submit resolution evidence</button></div></section>}
    </aside></div>
  </motion.div>;
}

function Discussion({ problem, user, mutate, busy }) {
  const [text, setText] = useState('');
  return <section className="challenge-panel"><div className="challenge-panel-heading"><h2><MessageSquare size={17} />A shared conversation</h2><span>{(problem.comments || []).length} updates</span></div><p>Ask questions, share field observations, and keep the community involved.</p><div className="challenge-comments">{(problem.comments || []).map((comment, index) => { const name = typeof comment.author === 'string' ? comment.author : comment.author?.name || comment.user?.name || 'Community member'; return <div className="challenge-comment" key={comment.id || index}><span className="challenge-avatar">{name.split(' ').map(n => n[0]).slice(0, 2).join('')}</span><div className="challenge-comment-content"><div className="challenge-comment-by"><strong>{name}</strong><small>{comment.role ? `${comment.role} · ` : ''}{dateLabel(comment.date || comment.createdAt)}</small></div><p>{comment.text}</p></div></div>; })}</div>{user ? <form className="challenge-comment-form" onSubmit={async e => { e.preventDefault(); if (await mutate('comment', { text })) setText(''); }}><label className="challenge-field">Add to the conversation<textarea required minLength={2} maxLength={5000} value={text} onChange={e => setText(e.target.value)} placeholder="Share an update, ask a question, or offer an idea…" rows={4} /></label><button className="btn btn-primary" disabled={busy || !text.trim()}><Send size={14} />{busy ? 'Posting…' : 'Post comment'}</button></form> : <div className="challenge-notice info"><MessageSquare size={16} /><Link href={`/login?next=/challenges/${problem.id}`}>Sign in to join this conversation.</Link></div>}</section>;
}

function AuthorityActions({ problem, mutate, busy, onEvidence }) {
  const [reason, setReason] = useState('');
  const [action, setAction] = useState(null);
  const [universityId, setUniversityId] = useState(universities[0]?.id || '');
  const [department, setDepartment] = useState(problem.department || '');
  const [priority, setPriority] = useState(problem.priority || 'Medium');
  const needsReview = ['Submitted', 'Under review', 'Needs information'].includes(problem.status);
  const university = universities.find(u => u.id === universityId);
  return <section className="challenge-panel"><h2><ShieldCheck size={16} />Authority workspace</h2><div className="challenge-role-actions">{problem.status === 'Submitted' && <button className="btn btn-secondary" disabled={busy} onClick={() => mutate('review', {})}>Begin review</button>}{needsReview && <><label className="challenge-field">Priority<select value={priority} onChange={e => setPriority(e.target.value)}>{['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p}>{p}</option>)}</select></label><button className="btn btn-primary" disabled={busy} onClick={() => mutate('validate', { priority })}><CheckCircle2 size={15} />Validate challenge</button><button className="btn btn-secondary" onClick={() => setAction(action === 'clarification' ? null : 'clarification')}><HelpCircle size={14} />Request clarification</button><button className="challenge-text-button" style={{ justifyContent: 'center' }} onClick={() => setAction(action === 'reject' ? null : 'reject')}>Reject submission</button></>}{problem.status === 'Validated' && <form onSubmit={async e => { e.preventDefault(); await mutate('assign', { universityId, department }); }}><label className="challenge-field">Assign a university<select value={universityId} onChange={e => { setUniversityId(e.target.value); setDepartment(''); }}>{universities.map(u => <option value={u.id} key={u.id}>{u.shortName || u.name}</option>)}</select></label><label className="challenge-field">Department<select required value={department} onChange={e => setDepartment(e.target.value)}><option value="">Select department</option>{university?.departments?.map(d => <option key={d}>{d}</option>)}{department && !university?.departments?.includes(department) && <option>{department}</option>}</select></label><button className="btn btn-primary" disabled={busy}><GraduationCap size={15} />Assign challenge</button></form>}{['Assigned', 'Solution proposed', 'In progress', 'Pilot testing', 'Implementation', 'Awaiting verification'].includes(problem.status) && <button className="btn btn-primary" onClick={onEvidence}><ShieldCheck size={15} />Review resolution</button>}{action && <form onSubmit={async e => { e.preventDefault(); if (await mutate(action, { reason })) { setReason(''); setAction(null); } }}><label className="challenge-field">{action === 'reject' ? 'Reason for rejection' : 'What needs clarification?'}<textarea required minLength={5} value={reason} onChange={e => setReason(e.target.value)} /></label><button className="btn btn-secondary" disabled={busy}>Send {action === 'reject' ? 'decision' : 'request'}</button></form>}</div></section>;
}
