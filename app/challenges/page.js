import { Suspense } from 'react';
import ExploreChallenges from '@/components/challenges/explore';

export const metadata = { title: 'Explore challenges · Jharkhand Innovation' };
export default function ChallengesPage() { return <Suspense fallback={<div className="card">Loading challenges…</div>}><ExploreChallenges /></Suspense>; }
