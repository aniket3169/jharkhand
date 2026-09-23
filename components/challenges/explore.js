'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, LayoutGrid, List, Map, ArrowUpRight, X, MapPin, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePortal } from '@/components/providers/portal-provider';
import { ChallengeCard } from './challenge-card';
import '@/components/maps/maps.css';
import './challenges.css';

const MapCanvas = dynamic(() => import('@/components/maps/map-canvas'), { ssr: false, loading: () => <div className="challenge-map-loading">Loading the challenge map…</div> });
export default function ExploreChallenges() {
  const { problems = [], loading } = usePortal();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState('All categories');
  const [district, setDistrict] = useState('All districts');
  const [status, setStatus] = useState(searchParams.get('status') || 'All statuses');
  const [priority, setPriority] = useState('All priorities');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('newest');
  const [moreFilters, setMoreFilters] = useState(false);
  const categories = [...new Set(problems.map(p => p.category))].sort();
  const districts = [...new Set(problems.map(p => p.district))].sort();
  const filtered = useMemo(() => problems.filter(p => {
    const text = [p.title, p.id, p.summary, p.category, p.district, p.assignedTo, p.status, p.department].filter(Boolean).join(' ').toLowerCase();
    return text.includes(search.toLowerCase()) && (category === 'All categories' || p.category === category) && (district === 'All districts' || p.district === district) && (status === 'All statuses' || p.status === status) && (priority === 'All priorities' || p.priority === priority);
  }).sort((a, b) => sort === 'impact' ? (b.affectedPopulation || 0) - (a.affectedPopulation || 0) : sort === 'priority' ? ['Critical', 'High', 'Medium', 'Low'].indexOf(a.priority) - ['Critical', 'High', 'Medium', 'Low'].indexOf(b.priority) : new Date(b.createdAt) - new Date(a.createdAt)), [problems, search, category, district, status, priority, sort]);
  const activeFilters = [category !== 'All categories', district !== 'All districts', status !== 'All statuses', priority !== 'All priorities'].filter(Boolean).length;
  function reset() { setSearch(''); setCategory('All categories'); setDistrict('All districts'); setStatus('All statuses'); setPriority('All priorities'); }
  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="challenge-page">
    <div className="challenge-page-title"><div><div className="challenge-eyebrow">SMALL ACTIONS. SHARED PROGRESS.</div><h1>Discover a challenge.<br className="challenge-mobile-break" /> Make a difference.</h1><p>Explore local challenges and find where your expertise can help.</p></div><Link className="btn btn-primary" href="/report">Report a problem <ArrowUpRight size={17} /></Link></div>
    <div className="challenge-explore-banner"><div><span className="challenge-banner-label"><span /> A BETTER JHARKHAND, TOGETHER</span><h2>Every challenge is a<br />possibility in the making.</h2><p>Connect community needs with the people who can solve them.</p><a href="#challenge-results">Find your next opportunity <ArrowRight size={16} /></a></div><div className="challenge-banner-art" aria-hidden="true"><div className="challenge-orbit orbit-one" /><div className="challenge-orbit orbit-two" /><MapPin size={60} strokeWidth={1.2} /><span className="challenge-art-dot dot-one" /><span className="challenge-art-dot dot-two" /><span className="challenge-art-label">24 districts. One shared purpose.</span></div></div>
    <section className="challenge-search-panel" aria-label="Filter challenges" id="challenge-results"><div className="challenge-search-line"><label className="challenge-search"><Search size={18} /><input aria-label="Search challenges" placeholder="Search by challenge, location, or expertise…" value={search} onChange={e => setSearch(e.target.value)} />{search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={16} /></button>}</label><button className={`btn btn-secondary ${moreFilters ? 'is-selected' : ''}`} onClick={() => setMoreFilters(!moreFilters)} aria-expanded={moreFilters}><SlidersHorizontal size={16} />Filters{activeFilters > 0 && <span className="challenge-filter-count">{activeFilters}</span>}</button></div><div className="challenge-filter-line"><label><span className="sr-only">Category</span><select value={category} onChange={e => setCategory(e.target.value)}><option>All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label><span className="sr-only">District</span><select value={district} onChange={e => setDistrict(e.target.value)}><option>All districts</option>{districts.map(d => <option key={d}>{d}</option>)}</select></label><label><span className="sr-only">Status</span><select value={status} onChange={e => setStatus(e.target.value)}><option>All statuses</option>{['Submitted', 'Under review', 'Validated', 'Assigned', 'In progress', 'Pilot testing', 'Resolved', 'Rejected'].map(s => <option key={s}>{s}</option>)}</select></label>{moreFilters && <label><span className="sr-only">Priority</span><select value={priority} onChange={e => setPriority(e.target.value)}><option>All priorities</option>{['Critical', 'High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}</select></label>}{activeFilters > 0 && <button className="challenge-text-button" onClick={reset}>Clear filters <X size={13} /></button>}<span className="challenge-filter-spacer" /><div className="challenge-view-toggle" aria-label="Display mode">{[[LayoutGrid, 'grid', 'Grid view'], [List, 'list', 'List view'], [Map, 'map', 'Map view']].map(([Icon, mode, label]) => <button key={mode} className={view === mode ? 'active' : ''} aria-pressed={view === mode} aria-label={label} title={label} onClick={() => setView(mode)}><Icon size={17} /></button>)}</div></div></section>
    <div className="challenge-results-heading"><p><strong>{filtered.length}</strong> challenges <span>worth coming together for</span></p><label>Sort by <select aria-label="Sort challenges" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Most recent</option><option value="impact">People affected</option><option value="priority">Highest priority</option></select></label></div>
    {loading && !problems.length ? <div className="challenge-grid">{[1, 2, 3, 4, 5, 6].map(n => <div className="challenge-card challenge-skeleton" key={n} />)}</div> : filtered.length === 0 ? <div className="challenge-empty"><Search size={32} /><h3>No challenges found</h3><p>Try another keyword or broaden your filters.</p><button className="btn btn-secondary" onClick={reset}>Reset filters</button></div> : view === 'map' ? <div className="challenge-map-layout"><div className="challenge-explore-map"><MapCanvas readOnly markers={filtered.filter(p => p.location).map(p => ({ ...p.location, id: p.id, title: p.title, href: `/challenges/${p.id}` }))} /></div><div className="challenge-map-results">{filtered.map(p => <ChallengeCard key={p.id} problem={p} />)}</div></div> : <div className={view === 'grid' ? 'challenge-grid' : 'challenge-list'}>{filtered.map(p => <ChallengeCard key={p.id} problem={p} list={view === 'list'} />)}</div>}
    <p className="challenge-map-privacy"><MapPin size={13} />Public map locations are approximate to protect community privacy.</p>
  </motion.div>;
}
