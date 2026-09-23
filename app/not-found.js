import Link from 'next/link';
export default function NotFound() { return <div className="empty-state card"><span className="eyebrow">404 · PAGE NOT FOUND</span><h1>Let’s get you back on track.</h1><p>This page may have moved or the challenge doesn’t exist.</p><Link className="btn btn-primary" href="/">Back to overview</Link></div>; }
