import { Suspense } from 'react';
import Projects from '@/components/challenges/projects';
export const metadata = { title: 'Project workspace · Jharkhand Innovation' };
export default function ProjectsPage() { return <Suspense fallback={<div className="card">Loading projects…</div>}><Projects /></Suspense>; }
