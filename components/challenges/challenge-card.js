'use client';

import Link from 'next/link';
import { ArrowUpRight, Droplets, Sprout, GraduationCap, HeartPulse, MapPin, Users, Zap, Route, Leaf, CircleDashed, Recycle } from 'lucide-react';

export const categoryIcons = { 'Water Management': Droplets, 'Water Resources': Droplets, Water: Droplets, Agriculture: Sprout, Education: GraduationCap, Healthcare: HeartPulse, Energy: Zap, Transportation: Route, Environment: Leaf, 'Waste Management': Recycle };
export const categoryColors = { 'Water Management': 'blue', 'Water Resources': 'blue', Water: 'blue', Agriculture: 'green', Education: 'purple', Healthcare: 'rose', Energy: 'amber', Environment: 'green', 'Waste Management': 'amber' };
export function StatusBadge({ status = 'Submitted' }) { return <span className={`challenge-status status-${status.toLowerCase().replaceAll(' ', '-')}`}><span />{status}</span>; }
export function CategoryIcon({ category, size = 20 }) { const Icon = categoryIcons[category] || CircleDashed; return <span className={`challenge-category-icon tone-${categoryColors[category] || 'teal'}`}><Icon size={size} /></span>; }
export function ChallengeCard({ problem, list = false }) {
  const progress = Number(problem.progress || 0);
  return <Link href={`/challenges/${problem.id}`} className={`challenge-card ${list ? 'challenge-card-list' : ''}`}>
    <div className="challenge-card-top"><CategoryIcon category={problem.category} /><span className={`challenge-priority priority-${(problem.priority || 'Medium').toLowerCase()}`}><span />{problem.priority || 'Medium'} priority</span><ArrowUpRight size={18} className="challenge-card-arrow" /></div>
    <div className="challenge-card-main"><div className="challenge-card-category">{problem.category}<span>·</span>{problem.id}</div><h3>{problem.title}</h3><p>{problem.summary || problem.description}</p></div>
    <div className="challenge-card-meta"><span><MapPin size={13} />{problem.district}</span><span><Users size={13} />{Number(problem.affectedPopulation || 0).toLocaleString()} people</span></div>
    <div className="challenge-card-bottom"><StatusBadge status={problem.status} />{problem.assignedTo ? <span className="challenge-institution" title={problem.assignedTo}>{problem.assignedTo}</span> : <span className="challenge-open">Open for impact</span>}</div>
    {progress > 0 && <div className="challenge-card-progress" aria-label={`${progress}% complete`}><span style={{ width: `${progress}%` }} /></div>}
  </Link>;
}
