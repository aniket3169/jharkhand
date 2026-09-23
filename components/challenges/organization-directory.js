'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, GraduationCap, Handshake, MapPin, ArrowUpRight, X, ArrowRight, Users, Layers3 } from 'lucide-react';
import { universities, partners } from '@/data/seed';
import { usePortal } from '@/components/providers/portal-provider';
import './challenges.css';

export default function OrganizationDirectory({ type = 'universities' }) {
  const isUniversity = type === 'universities';
  const items = isUniversity ? universities : partners;
  const { problems = [] } = usePortal();
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('All expertise');
  const [city, setCity] = useState('All locations');
  const [selected, setSelected] = useState(null);
  const filtered = items.filter(item => [item.name, item.city, item.type, ...(item.expertise || [])].join(' ').toLowerCase().includes(search.toLowerCase()) && (specialty === 'All expertise' || item.expertise?.includes(specialty)) && (city === 'All locations' || item.city === city));
  const getProjects = org => problems.filter(p => isUniversity ? (p.assignedUniversityId === org.id || p.assignedTo === org.shortName || p.assignedTo === org.name) : p.collaborators?.some(c => c.id === org.id || c.name === org.name));
  return <motion.div className="challenge-page" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><div className="challenge-page-title"><div><div className="challenge-eyebrow">{isUniversity ? 'KNOWLEDGE MEETS COMMUNITY' : 'BETTER, TOGETHER'}</div><h1>{isUniversity ? 'Expertise with a purpose.' : 'Partners in possibility.'}</h1><p>{isUniversity ? 'Meet the institutions bringing research, fresh thinking, and people to local challenges.' : 'Discover the organizations supporting community innovation across Jharkhand.'}</p></div><span className="challenge-category-icon" style={{ width: 52, height: 52 }}>{isUniversity ? <GraduationCap size={25} /> : <Handshake size={25} />}</span></div>
    <div className="challenge-explore-banner"><div><span className="challenge-banner-label"><span />{isUniversity ? 'A NETWORK OF KNOWLEDGE' : 'THE POWER OF COLLABORATION'}</span><h2>{isUniversity ? <>Real-world challenges.<br />Extraordinary minds.</> : <>The right support.<br />A world of difference.</>}</h2><p>{isUniversity ? 'From field research to working solutions, our institutions help ideas take root.' : 'Industry, startups, NGOs, and CSR partners making progress possible.'}</p><a href="#directory-results">{isUniversity ? 'Find an institution' : 'Meet the partners'} <ArrowRight size={15} /></a></div><div className="challenge-banner-art" aria-hidden="true"><div className="challenge-orbit orbit-one" /><div className="challenge-orbit orbit-two" />{isUniversity ? <GraduationCap size={62} strokeWidth={1.25} /> : <Handshake size={62} strokeWidth={1.25} />}<span className="challenge-art-dot dot-one" /><span className="challenge-art-dot dot-two" /></div></div>
    <div className="challenge-search-panel" id="directory-results"><div className="challenge-search-line"><label className="challenge-search"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={isUniversity ? 'Search institutions, disciplines, or locations…' : 'Search partners, support, or locations…'} aria-label={isUniversity ? 'Search institutions' : 'Search partners'} /></label></div><div className="challenge-filter-line"><select aria-label="Filter by expertise" value={specialty} onChange={e => setSpecialty(e.target.value)}><option>All expertise</option>{[...new Set(items.flatMap(item => item.expertise || []))].sort().map(value => <option key={value}>{value}</option>)}</select><select aria-label="Filter by location" value={city} onChange={e => setCity(e.target.value)}><option>All locations</option>{[...new Set(items.map(item => item.city))].sort().map(value => <option key={value}>{value}</option>)}</select>{(specialty !== 'All expertise' || city !== 'All locations' || search) && <button className="challenge-text-button" onClick={() => { setSearch(''); setSpecialty('All expertise'); setCity('All locations'); }}>Clear filters <X size={12} /></button>}</div></div>
    <div className="challenge-results-heading"><p><strong>{filtered.length}</strong> {isUniversity ? 'institutions' : 'partners'} <span>connected by a shared purpose</span></p></div>
    {filtered.length ? <div className="challenge-grid">{filtered.map(item => { const linked = getProjects(item); return <article className="challenge-org-card" key={item.id}><div className="challenge-org-card-top"><span className="challenge-org-avatar" style={{ color: item.color, background: `${item.color}10`, borderColor: `${item.color}20` }}>{isUniversity ? <GraduationCap size={24} /> : <Handshake size={24} />}</span><div><h3>{item.shortName || item.name}</h3><small><MapPin size={10} style={{ display: 'inline', marginRight: 3 }} />{item.city} · {item.type}</small></div></div><p>{item.description}</p><div className="challenge-tags">{item.expertise?.slice(0, 3).map(expertise => <span key={expertise}>{expertise}</span>)}{item.expertise?.length > 3 && <span>+{item.expertise.length - 3}</span>}</div><div className="challenge-org-metrics"><div><strong>{linked.length}</strong><small>Portal projects</small></div><div><strong>{isUniversity ? item.departments?.length || 0 : item.expertise?.length || 0}</strong><small>{isUniversity ? 'Departments' : 'Focus areas'}</small></div>{isUniversity && <div><strong>{linked.reduce((sum, p) => sum + (p.team?.filter(m => /student/i.test(m.role)).length || 0), 0)}</strong><small>Student members</small></div>}</div><button className="btn btn-secondary" onClick={() => setSelected(item)}>View {isUniversity ? 'institution' : 'partner'} <ArrowUpRight size={14} /></button></article>; })}</div> : <div className="challenge-empty"><Search size={28} /><h3>No matches found</h3><p>Try a different expertise or location.</p></div>}
    <p className="challenge-map-privacy">Demonstration directory. Listed organizations are illustrative; participation is not an endorsement.</p>
    <AnimatePresence>{selected && <OrganizationModal item={selected} projects={getProjects(selected)} allProblems={problems} isUniversity={isUniversity} onClose={() => setSelected(null)} />}</AnimatePresence>
  </motion.div>;
}

function OrganizationModal({ item, projects, allProblems, isUniversity, onClose }) {
  const ref = useRef(null);
  const previousFocus = useRef(null);
  useEffect(() => {
    previousFocus.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; ref.current?.focus();
    const handler = event => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = ref.current?.querySelectorAll('a[href],button:not(:disabled),[tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => { document.body.style.overflow = originalOverflow; document.removeEventListener('keydown', handler); previousFocus.current?.focus(); };
  }, [onClose]);
  const matching = allProblems.filter(p => item.expertise?.includes(p.category) && !['Resolved', 'Rejected', 'Closed'].includes(p.status)).slice(0, 3);
  return <motion.div className="challenge-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><motion.section className="challenge-modal" role="dialog" aria-modal="true" aria-labelledby="organization-title" ref={ref} tabIndex={-1} initial={{ y: 15, scale: .98 }} animate={{ y: 0, scale: 1 }}><button className="challenge-modal-close" onClick={onClose} aria-label="Close profile"><X size={17} /></button><div className="challenge-org-avatar" style={{ width: 54, height: 54, marginBottom: 19 }}>{isUniversity ? <GraduationCap size={27} /> : <Handshake size={27} />}</div><h2 id="organization-title">{item.name}</h2><p><MapPin size={12} style={{ display: 'inline' }} /> {item.city} · {item.type}</p><p>{item.description}</p><div className="challenge-tags">{item.expertise?.map(expertise => <span key={expertise}>{expertise}</span>)}</div>{item.departments && <><div className="challenge-division" /><div className="challenge-mini-label">Academic departments</div><p>{item.departments.join(' · ')}</p></>}{item.contributions && <><div className="challenge-division" /><div className="challenge-mini-label">Areas of support</div><p>{item.contributions}</p></>}<div className="challenge-division" /><div className="challenge-mini-label">{projects.length ? 'Projects in this portal' : 'Challenges that match this expertise'}</div>{(projects.length ? projects : matching).slice(0, 4).map(p => <Link className="challenge-proposal" key={p.id} href={`/challenges/${p.id}`} style={{ display: 'block', textDecoration: 'none' }}><h3 style={{ fontSize: 12, color: '#5e7950', margin: '0 0 7px' }}>{p.title}</h3><small>{p.district} · {p.status} <ArrowUpRight size={12} style={{ float: 'right' }} /></small></Link>)}{!projects.length && !matching.length && <p>New opportunities will appear as communities share their challenges.</p>}<Link className="btn btn-primary" style={{ marginTop: 16 }} href={isUniversity && projects.length ? `/projects?organization=${encodeURIComponent(item.shortName || item.name)}` : `/challenges?q=${encodeURIComponent(item.expertise?.[0] || '')}`}>{projects.length && isUniversity ? 'Explore institution projects' : 'Discover relevant challenges'} <ArrowRight size={14} /></Link><p className="challenge-note" style={{ marginTop: 17 }}>Demonstration profile. Join a challenge workspace to record a collaboration offer through your own organization.</p></motion.section></motion.div>;
}
