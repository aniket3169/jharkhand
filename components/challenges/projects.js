'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowUpRight, Search, MapPin, Users, Layers3, GraduationCap, Flag, CheckCircle2, ArrowRight } from 'lucide-react';
import { usePortal } from '@/components/providers/portal-provider';
import { CategoryIcon, StatusBadge } from './challenge-card';
import './challenges.css';

const activeStatuses = ['Assigned', 'Solution proposed', 'In progress', 'Pilot testing', 'Implementation', 'Awaiting verification'];
export default function Projects() {
  const { problems = [], user, loading } = usePortal();
  const params = useSearchParams();
  const [tab, setTab] = useState('All projects');
  const [search, setSearch] = useState(params.get('organization') || '');
  const [mine, setMine] = useState(false);
  const projects = problems.filter(p => p.assignedTo || p.status === 'Resolved');
  const active = projects.filter(p => activeStatuses.includes(p.status));
  const pilot = projects.filter(p => p.status === 'Pilot testing');
  const completed = projects.filter(p => ['Resolved', 'Closed'].includes(p.status));
  const projectPeople = new Set(projects.flatMap(p => (p.team || []).map(m => m.name))).size;
  const filtered = useMemo(() => projects.filter(p => {
    const term = [p.title, p.id, p.assignedTo, p.category, p.district].join(' ').toLowerCase();
    const matchesTab = tab === 'All projects' || (tab === 'In development' && ['Assigned', 'Solution proposed', 'In progress'].includes(p.status)) || (tab === 'Pilot projects' && ['Pilot testing', 'Implementation', 'Awaiting verification'].includes(p.status)) || (tab === 'Completed' && ['Resolved', 'Closed'].includes(p.status));
    const matchesMine = !mine || p.assignedUniversityId === user?.organizationId || p.reporter?.id === user?.id || p.collaborators?.some(c => c.id === user?.organizationId || c.userId === user?.id);
    return matchesTab && matchesMine && term.includes(search.toLowerCase());
  }), [projects, tab, search, mine, user]);
  return <motion.div className="challenge-page" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><div className="challenge-page-title"><div><div className="challenge-eyebrow">IDEAS IN ACTION</div><h1>Progress, made together.</h1><p>Follow the teams turning local challenges into lasting change.</p></div><Link className="btn btn-primary" href="/challenges">Discover challenges <ArrowUpRight size={16} /></Link></div>
    <div className="challenge-project-stats">{[[Layers3, 'Active projects', active.length, 'Moving from insight to implementation'], [Flag, 'Pilots in the field', pilot.length, 'Testing solutions with communities'], [CheckCircle2, 'Completed projects', completed.length, 'Outcomes shared with communities'], [Users, 'People collaborating', projectPeople, 'Distinct team members across projects']].map(([Icon, label, value, description]) => <div className="challenge-project-stat" key={label}><span><Icon size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />{label}</span><strong>{value}</strong><small>{description}</small></div>)}</div>
    <div className="challenge-search-panel"><div className="challenge-search-line" style={{ border: 0, paddingBottom: 0 }}><label className="challenge-search"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a project, institution, or district…" aria-label="Search projects" /></label>{user && <button className={`btn ${mine ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMine(!mine)} aria-pressed={mine}><Users size={15} />My projects</button>}</div></div>
    <div className="challenge-project-tabs">{['All projects', 'In development', 'Pilot projects', 'Completed'].map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)} aria-pressed={tab === item}>{item}{item === 'All projects' && <span>{projects.length}</span>}</button>)}</div>
    {loading && !problems.length ? <div className="challenge-grid">{[1, 2, 3].map(i => <div key={i} className="challenge-card challenge-skeleton" />)}</div> : !filtered.length ? <div className="challenge-empty"><Layers3 size={30} /><h3>No projects here yet</h3><p>{mine ? 'Projects assigned to or supported by your organization will appear here.' : 'Try another search or explore a different project stage.'}</p><button className="btn btn-secondary" onClick={() => { setSearch(''); setMine(false); setTab('All projects'); }}>See all projects</button></div> : <div className="challenge-grid">{filtered.map(p => <Link key={p.id} href={`/challenges/${p.id}`} className="challenge-card challenge-project-card"><div className="challenge-card-top"><CategoryIcon category={p.category} /><StatusBadge status={p.status} /><ArrowUpRight size={17} style={{ marginLeft: 'auto', color: '#a1af96' }} /></div><div className="challenge-card-main"><div className="challenge-card-category">{p.category} <span>·</span> {p.id}</div><h3>{p.title}</h3><p>{p.summary || p.description}</p></div><div className="challenge-card-meta"><span><MapPin size={13} />{p.district}</span><span><Users size={13} />{p.team?.length || 0} members</span></div><div className="challenge-assignment" style={{ margin: '0 0 7px' }}><span className="challenge-org-avatar"><GraduationCap size={17} /></span><div><strong>{p.assignedTo || 'Community team'}</strong><small>{p.department}</small></div></div><div className="challenge-project-progress"><div className="challenge-progress-value"><span>{p.milestones?.filter(m => m.completed).length || 0} of {p.milestones?.length || 0} milestones</span><strong>{p.progress || 0}%</strong></div><div className="challenge-progress-track"><span style={{ width: `${p.progress || 0}%` }} /></div></div><div className="challenge-card-bottom"><span className="challenge-open">{Number(p.affectedPopulation || 0).toLocaleString()} people at the heart of this project</span><ArrowRight size={14} color="#729562" /></div></Link>)}</div>}
  </motion.div>;
}
