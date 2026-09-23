'use client';
import { AlertCircle } from 'lucide-react';
export default function ErrorPage({ reset }) { return <div className="empty-state card"><AlertCircle size={40} /><h2>This page needs another try</h2><p>We couldn’t load this view. Your saved work is still here.</p><button className="btn btn-primary" onClick={reset}>Try again</button></div>; }
