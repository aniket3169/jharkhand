'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Video, UploadCloud, FileText, X, Check, MapPin, RotateCw, LoaderCircle, AlertCircle, FolderOpen } from 'lucide-react';
import { captureDeviceLocation } from '../maps/location-picker';
import { saveLocalMedia, getLocalMediaUrl } from './media-store';
import './media.css';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
const FILE_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov,.pdf,.docx,.txt';
const prettySize = size => size > 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`;

export function MediaPreview({ media, className = '', controls = true }) {
  const [localUrl, setLocalUrl] = useState(null);
  useEffect(() => {
    let active = true, allocated;
    if (media.localId && !media.url) getLocalMediaUrl(media.localId).then(url => { if (active) { allocated = url; setLocalUrl(url); } else if (url) URL.revokeObjectURL(url); }).catch(() => {});
    return () => { active = false; if (allocated) URL.revokeObjectURL(allocated); };
  }, [media.localId, media.url]);
  const url = media.url || media.previewUrl || localUrl;
  const type = media.type || media.mimeType || '';
  if (url && (type.startsWith('image/') || type === 'image')) return <img className={className} src={url} alt={media.name || 'Challenge evidence'} />;
  if (url && (type.startsWith('video/') || type === 'video')) return <video className={className} src={url} controls={controls} preload="metadata" playsInline />;
  return <div className={`media-document ${className}`}><FileText size={23} />{url && controls && <a href={url} target="_blank" rel="noreferrer">Open document</a>}</div>;
}

async function requestJson(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The upload could not be completed. Please retry.');
  return data;
}

function uploadToCloud(url, file, headers, progress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    Object.entries(headers || { 'Content-Type': file.type }).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = event => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 90)); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Cloud upload failed. Check your connection and retry.'));
    xhr.onerror = () => reject(new Error('The upload was interrupted. Check your connection and retry.'));
    xhr.timeout = 120000; xhr.ontimeout = () => reject(new Error('The upload timed out. Try again or choose a smaller file.'));
    xhr.send(file);
  });
}

export function MediaUploader({ value = [], onChange, phase = 'before', problemId, location, onLocationChange }) {
  const [uploads, setUploads] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(null);
  const picker = useRef(null), photo = useRef(null), video = useRef(null), captureLocation = useRef(null), latest = useRef(value), objectUrls = useRef([]);
  latest.current = value;
  useEffect(() => () => objectUrls.current.forEach(url => URL.revokeObjectURL(url)), []);
  const update = (id, change) => setUploads(items => items.map(item => item.key === id ? { ...item, ...change } : item));

  async function upload(item) {
    update(item.key, { status: 'uploading', progress: 2, error: '' });
    try {
      let mediaLocation = item.captureLocation;
      let exifAvailable = false;
      if (!mediaLocation && item.file.type.startsWith('image/')) {
        try {
          const exifr = await import('exifr');
          const coordinates = await exifr.gps(item.file);
          if (coordinates?.latitude != null && coordinates?.longitude != null) { mediaLocation = { ...coordinates, accuracy: null, source: 'exif', confirmed: false }; exifAvailable = true; }
        } catch { /* Most media does not contain GPS metadata. */ }
      }
      const ticket = await requestJson('/api/upload/url', { fileName: item.file.name, contentType: item.file.type, size: item.file.size, phase: item.file.type.startsWith('image/') || item.file.type.startsWith('video/') ? phase : 'supporting', problemId });
      if (ticket.uploadUrl) {
        await uploadToCloud(ticket.uploadUrl, item.file, ticket.headers, progress => update(item.key, { progress }));
      } else if (ticket.mode === 'demo') {
        update(item.key, { progress: 90 });
      } else {
        throw new Error('Storage is unavailable. Please try again.');
      }
      try { await saveLocalMedia(ticket.id, item.file); } catch { /* Local browser store optional */ }
      const { media } = await requestJson('/api/upload/complete', { id: ticket.id, location: mediaLocation, localId: ticket.mode === 'demo' ? ticket.id : undefined });
      const complete = { ...media, id: media.id || ticket.id, name: media.name || item.file.name, type: media.type || item.file.type, size: media.size || item.file.size, phase, source: item.captureLocation ? 'capture' : 'upload', exifAvailable, location: media.location || mediaLocation, localId: ticket.mode === 'demo' ? ticket.id : media.localId, previewUrl: item.previewUrl, uploadStatus: 'complete' };
      onChange([...latest.current, complete]);
      setUploads(items => items.filter(entry => entry.key !== item.key));
      if (mediaLocation && !location?.confirmed) onLocationChange?.(mediaLocation);
    } catch (err) { update(item.key, { status: 'error', error: err.message }); }
  }
  async function selectFiles(fileList, sourceLocation = null) {
    const files = Array.from(fileList || []); setError('');
    for (const file of files) {
      if (latest.current.length + uploads.length >= 10) { setError('You can attach up to 10 pieces of evidence.'); break; }
      if (!ACCEPTED.includes(file.type)) { setError(`${file.name}: unsupported file type. Choose an image, video, PDF, DOCX, or text document.`); continue; }
      const maximum = file.type.startsWith('video/') ? 100 : file.type.startsWith('image/') ? 10 : 20;
      if (file.size > maximum * 1024 * 1024) { setError(`${file.name} is too large. The limit is ${maximum} MB for this file type.`); continue; }
      const previewUrl = URL.createObjectURL(file); objectUrls.current.push(previewUrl);
      const item = { key: crypto.randomUUID(), file, name: file.name, type: file.type, size: file.size, previewUrl, captureLocation: sourceLocation ? { ...sourceLocation, confirmed: false } : null, status: 'uploading', progress: 0 };
      setUploads(items => [...items, item]); await upload(item);
    }
  }
  async function capture(kind) {
    setError(''); setCapturing(kind);
    try {
      captureLocation.current = await captureDeviceLocation();
      if (!location?.confirmed) onLocationChange?.(captureLocation.current);
      (kind === 'photo' ? photo : video).current?.click();
    } catch (err) { setError(`${err.message} You can also upload an existing file and confirm its location.`); } finally { setCapturing(null); }
  }
  function confirmMedia(item, fromProblem = false) {
    const selected = fromProblem ? location : item.location;
    if (!selected || selected.latitude == null || selected.longitude == null) return;
    onChange(latest.current.map(entry => entry.id === item.id ? { ...entry, location: { ...selected, confirmed: true } } : entry));
  }
  return <div className="media-uploader">
    <input ref={picker} className="media-hidden" type="file" accept={FILE_ACCEPT} multiple onChange={event => { selectFiles(event.target.files); event.target.value = ''; }} />
    <input ref={photo} className="media-hidden" type="file" accept="image/*" capture="environment" onChange={event => { selectFiles(event.target.files, captureLocation.current); event.target.value = ''; }} />
    <input ref={video} className="media-hidden" type="file" accept="video/*" capture="environment" onChange={event => { selectFiles(event.target.files, captureLocation.current); event.target.value = ''; }} />
    <div className={`media-dropzone ${dragging ? 'is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); selectFiles(event.dataTransfer.files); }}>
      <div className="media-upload-icon"><UploadCloud size={27} strokeWidth={1.6} /></div><strong>Give your community a voice. Show us the problem.</strong><p>Drag and drop your evidence here, or <button type="button" onClick={() => picker.current?.click()}>browse files</button></p><span>Images up to 10 MB · Videos up to 100 MB · Documents up to 20 MB</span>
    </div>
    <div className="media-actions"><button type="button" onClick={() => capture('photo')} disabled={!!capturing}>{capturing === 'photo' ? <LoaderCircle className="spin" size={17} /> : <Camera size={17} />}Take photo</button><button type="button" onClick={() => capture('video')} disabled={!!capturing}>{capturing === 'video' ? <LoaderCircle className="spin" size={17} /> : <Video size={17} />}Record video</button><button type="button" onClick={() => picker.current?.click()}><FolderOpen size={17} />Upload files</button></div>
    <p className="media-capture-note"><MapPin size={13} />Camera capture asks for device location first. Mobile devices can use their rear camera.</p>
    {error && <div className="media-error" role="alert"><AlertCircle size={16} />{error}</div>}
    {(value.length > 0 || uploads.length > 0) && <div className="media-list"><div className="media-list-heading">Your evidence <span>{value.length} attached</span></div>
      {value.map(item => <div className="media-item" key={item.id}><div className="media-thumbnail"><MediaPreview media={item} controls={false} /></div><div className="media-item-body"><div className="media-item-name">{item.name}<span className="media-phase">{phase}</span></div><div className="media-item-meta">{prettySize(item.size || 0)} <span>·</span> {item.storage === 'gcs' ? 'Cloud storage' : 'Saved in this browser'} <Check size={12} /></div>{phase === 'supporting' ? <span className="media-location-confirmed"><FileText size={11} />Supporting document</span> : item.location?.confirmed ? <span className="media-location-confirmed"><MapPin size={11} />Capture location confirmed</span> : <div className="media-location-prompt"><span>{item.location ? `${item.location.source === 'exif' ? 'GPS found in media' : 'Device GPS captured'}: ${Number(item.location.latitude).toFixed(4)}, ${Number(item.location.longitude).toFixed(4)}` : 'Where was this evidence captured?'}</span>{item.location && <button type="button" onClick={() => confirmMedia(item)}>Confirm GPS</button>}{location?.confirmed && <button type="button" onClick={() => confirmMedia(item, true)}>Use selected location</button>}{!item.location && !location?.confirmed && <small>Confirm its capture location in the next step.</small>}</div>}</div><button type="button" className="media-remove" aria-label={`Remove ${item.name}`} onClick={() => onChange(latest.current.filter(entry => entry.id !== item.id))}><X size={15} /></button></div>)}
      {uploads.map(item => <div className="media-item" key={item.key}><div className="media-thumbnail"><MediaPreview media={item} controls={false} /></div><div className="media-item-body"><div className="media-item-name">{item.name}</div>{item.status === 'error' ? <p className="media-upload-error">{item.error}</p> : <><span className="media-item-meta">Uploading… {item.progress}%</span><div className="media-progress"><span style={{ width: `${item.progress}%` }} /></div></>}</div>{item.status === 'error' && <button type="button" className="media-retry" onClick={() => upload(item)} aria-label={`Retry ${item.name}`}><RotateCw size={16} /></button>}</div>)}
    </div>}
  </div>;
}
export default MediaUploader;

