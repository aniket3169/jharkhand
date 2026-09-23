'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, MapPin, ShieldCheck, AlertTriangle, ImageIcon, ArrowLeftRight, Upload, LoaderCircle, Sparkles } from 'lucide-react';
import MediaUploader, { MediaPreview } from '@/components/media/media-uploader';
import { getLocalMediaUrl } from '@/components/media/media-store';
import LocationPicker from '@/components/maps/location-picker';

function useMediaUrl(media) {
  const [url, setUrl] = useState(media?.url || null);
  useEffect(() => {
    let active = true, allocated;
    setUrl(media?.url || null);
    if (media?.localId && !media.url) getLocalMediaUrl(media.localId).then(value => { if (active) { allocated = value; setUrl(value); } else if (value) URL.revokeObjectURL(value); }).catch(() => {});
    return () => { active = false; if (allocated) URL.revokeObjectURL(allocated); };
  }, [media?.id, media?.url, media?.localId]);
  return url;
}

export function BeforeAfter({ before, after }) {
  const [position, setPosition] = useState(50);
  const beforeUrl = useMediaUrl(before), afterUrl = useMediaUrl(after);
  if (!beforeUrl || !afterUrl) return <div className="challenge-photo-placeholder"><ImageIcon size={28} /><span>Image comparison becomes available when both images can be loaded.</span></div>;
  return <><div className="challenge-comparison"><img src={afterUrl} alt={`After: ${after.name || 'Resolution evidence'}`} /><img className="before-image" src={beforeUrl} alt={`Before: ${before.name || 'Reported evidence'}`} style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }} /><span className="challenge-comparison-label before">BEFORE</span><span className="challenge-comparison-label after">AFTER</span><span className="challenge-comparison-divider" style={{ left: `${position}%` }}><span><ArrowLeftRight size={18} /></span></span><input type="range" min="0" max="100" value={position} onChange={e => setPosition(Number(e.target.value))} aria-label="Before and after comparison" aria-valuetext={`${position}% before image visible`} /></div><p className="challenge-comparison-caption">Drag the slider to compare. Use the arrow keys when focused.</p>{(before.sample || after.sample) && <div className="challenge-notice"><ImageIcon size={15} />Illustrative sample photographs. These images do not document a verified intervention.</div>}</>;
}

export function EvidenceGallery({ evidence = [], empty = 'No evidence has been uploaded yet.' }) {
  if (!evidence.length) return <div className="challenge-photo-placeholder"><ImageIcon size={24} />{empty}</div>;
  return <div className="challenge-evidence-grid">{evidence.map((media, index) => <div key={media.id || index}>{media.private ? <div className="challenge-photo-placeholder"><ShieldCheck size={25} />Evidence is available to the reporter and authorized project team.</div> : <MediaPreview media={media} />}<small>{media.name || 'Evidence'}{media.sample ? ' · Illustrative sample' : ''}</small>{media.location && <small><MapPin size={10} style={{ display: 'inline' }} /> {media.location.approximate ? 'Approximate public location' : media.location.source === 'device' ? 'Device-reported location' : media.location.source === 'exif' ? 'Media GPS metadata' : 'User-confirmed location'}{media.location.accuracy != null ? ` · ±${Math.round(media.location.accuracy)} m` : ''}</small>}</div>)}</div>;
}

export default function ResolutionPanel({ problem, canWork, canResolve, isAdmin, mutate, busy }) {
  const [uploading, setUploading] = useState(false);
  const [media, setMedia] = useState([]);
  const [location, setLocation] = useState(null);
  const [summary, setSummary] = useState(problem.resolution?.summary || '');
  const [impact, setImpact] = useState(problem.resolution?.impact || '');
  const [people, setPeople] = useState(problem.resolution?.peopleImpacted || '');
  const [overrideReason, setOverrideReason] = useState('');
  const before = problem.evidence?.find(m => (m.type || m.mimeType || '').startsWith('image'));
  const after = problem.afterEvidence?.find(m => (m.type || m.mimeType || '').startsWith('image'));
  const verification = problem.verification;
  const closed = ['Resolved', 'Closed', 'Rejected'].includes(problem.status);
  const canDocument = canWork && ['In progress', 'Pilot testing', 'Implementation', 'Awaiting verification'].includes(problem.status);
  async function saveEvidence() {
    const result = await mutate('after-evidence', { evidence: media.map(m => ({ id: m.id, location: m.location })) });
    if (result) { setMedia([]); setLocation(null); setUploading(false); }
  }
  return <>
    <section className="challenge-panel"><div className="challenge-panel-heading"><h2><ArrowLeftRight size={17} />A visible difference</h2>{verification?.verified && <span className="challenge-status status-resolved"><span />{verification.sample ? 'Sample verification' : 'Location matched'}</span>}</div>{before && after ? <BeforeAfter before={before} after={after} /> : <div className="challenge-resolve-grid"><div><div className="challenge-mini-label">Before the intervention</div><EvidenceGallery evidence={(problem.evidence || []).slice(0, 1)} /></div><div><div className="challenge-mini-label">After the intervention</div><EvidenceGallery evidence={(problem.afterEvidence || []).slice(0, 1)} empty="The next chapter is still being written. Resolution evidence will appear here." /></div></div>}</section>
    {verification && <section className="challenge-panel"><h2>{verification.verified ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}Location comparison</h2><div className={`challenge-notice ${verification.verified ? 'success' : 'error'}`}><MapPin size={17} />{verification.verified ? 'The recorded after-evidence location is within the permitted distance of the original report.' : verification.message || verification.reason || 'The recorded location does not meet the verification criteria. Capture fresh evidence at the problem location, confirm its location, and upload again.'}</div><div className="challenge-verification-facts"><div><small>Distance from report</small><strong>{Number.isFinite(verification.distanceMeters) ? `${Math.round(verification.distanceMeters)} m` : 'Unavailable'}</strong></div><div><small>Allowed distance</small><strong>{verification.thresholdMeters || 50} m</strong></div><div><small>Reported GPS accuracy</small><strong>{verification.accuracyMeters != null ? `±${Math.round(verification.accuracyMeters)} m` : 'Not provided'}</strong></div></div><p className="challenge-note" style={{ marginTop: 14 }}>{verification.sample ? 'This is an illustrative sample comparison. ' : ''}Coordinates are compared on the server using the Haversine formula. A nearby reported location alone does not verify the content, capture authenticity, or successful resolution.</p></section>}
    {(problem.afterEvidence || []).length > 0 && <section className="challenge-panel"><div className="challenge-panel-heading"><h2>Resolution evidence</h2><span>{problem.afterEvidence.length} file{problem.afterEvidence.length !== 1 ? 's' : ''}</span></div><EvidenceGallery evidence={problem.afterEvidence} />{canWork && !closed && <button className="btn btn-secondary" disabled={busy} onClick={() => mutate('verify-location', {})} style={{ marginTop: 17 }}><ShieldCheck size={15} />{busy ? 'Checking…' : 'Verify evidence location'}</button>}</section>}
    {canDocument && !closed && <section className="challenge-panel"><div className="challenge-panel-heading"><h2><Upload size={17} />Document the outcome</h2></div><p>Return to the resolved location and record the change. Confirm the location for each image or video before submitting.</p>{!uploading ? <button className="btn btn-secondary" onClick={() => setUploading(true)}><Upload size={15} />Upload resolution evidence</button> : <><LocationPicker value={location} onChange={setLocation} /><div style={{ marginTop: 20 }}><MediaUploader value={media} onChange={setMedia} phase="after" problemId={problem.id} location={location} onLocationChange={setLocation} /></div><div className="challenge-action-row" style={{ marginTop: 18 }}><button className="btn btn-primary" disabled={busy || !media.length || media.some(m => !m.location?.confirmed)} onClick={saveEvidence}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}Save after evidence</button><button className="btn btn-secondary" disabled={busy} onClick={() => setUploading(false)}>Cancel</button></div></>}
      <div className="challenge-division" /><h3>Resolution summary</h3><form onSubmit={async e => { e.preventDefault(); await mutate('resolution', { summary, impact, peopleImpacted: Number(people) }); }}><label className="challenge-field">What was implemented?<textarea required minLength={20} value={summary} onChange={e => setSummary(e.target.value)} placeholder="Describe the intervention and how it addresses the original problem…" /></label><label className="challenge-field">Community impact<textarea required minLength={10} value={impact} onChange={e => setImpact(e.target.value)} placeholder="Describe observed changes and how they were measured…" /></label><label className="challenge-field">People benefited<input type="number" min="0" max="100000000" required value={people} onChange={e => setPeople(e.target.value)} /></label><button className="btn btn-secondary" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save resolution summary'}</button></form>
    </section>}
    {problem.resolution && <section className="challenge-panel"><h2><Sparkles size={17} />Community outcome</h2><p>{problem.resolution.summary || problem.resolution.description}</p><h3>Impact</h3><p>{problem.resolution.impact}</p>{problem.resolution.peopleImpacted > 0 && <div className="challenge-notice success"><UsersIcon />{Number(problem.resolution.peopleImpacted).toLocaleString()} people reported to benefit from this intervention.</div>}</section>}
    {canResolve && !closed && <section className="challenge-panel"><h2><CheckCircle2 size={17} />Final authority review</h2><p>Review the implementation, community impact, and evidence before closing this challenge.</p>{isAdmin && !verification?.verified && <label className="challenge-field">Administrative override reason<textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="Explain the exceptional circumstances and the alternative evidence reviewed. This reason is recorded in the audit log." minLength={20} /><small>A reason of at least 20 characters is required to override a location mismatch.</small></label>}<button className="btn btn-primary" disabled={busy || !problem.resolution || !problem.afterEvidence?.length || (!verification?.verified && !(isAdmin && overrideReason.trim().length >= 20))} onClick={() => mutate('resolve', overrideReason ? { overrideReason } : {})}><CheckCircle2 size={16} />{busy ? 'Completing review…' : 'Approve & mark resolved'}</button><p className="challenge-disabled-note">Requires a resolution summary, after evidence, and a passing location comparison or documented admin override.</p></section>}
  </>;
}
function UsersIcon() { return <CheckCircle2 size={16} />; }
