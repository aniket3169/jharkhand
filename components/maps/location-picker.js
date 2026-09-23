'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Check, LocateFixed, MapPin, Search, LoaderCircle, Info, ShieldCheck } from 'lucide-react';
import './maps.css';

const MapCanvas = dynamic(() => import('./map-canvas'), { ssr: false, loading: () => <div className="location-map-loading"><LoaderCircle className="spin" size={23} /> Loading map…</div> });

export function captureDeviceLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Your browser does not support location capture. Select a point on the map or enter coordinates.'));
    navigator.geolocation.getCurrentPosition(position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, source: 'device', confirmed: false, capturedAt: new Date(position.timestamp).toISOString() }), error => reject(new Error(error.code === 1 ? 'Location access was denied. You can try again, select a point on the map, or enter coordinates.' : 'Your device could not determine its location. Select a point on the map or enter coordinates.')), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}

export default function LocationPicker({ value, onChange, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [latitude, setLatitude] = useState(value?.latitude ?? '');
  const [longitude, setLongitude] = useState(value?.longitude ?? '');
  const valid = value?.latitude != null && value?.longitude != null && Number.isFinite(Number(value.latitude)) && Number.isFinite(Number(value.longitude));
  useEffect(() => { setLatitude(value?.latitude ?? ''); setLongitude(value?.longitude ?? ''); }, [value?.latitude, value?.longitude]);
  async function locate() {
    setBusy(true); setError('');
    try { onChange({ ...value, ...await captureDeviceLocation() }); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function search(event) {
    event.preventDefault(); if (!query.trim()) return;
    setSearching(true); setError('');
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=4`);
      if (!response.ok) throw new Error('Address search is unavailable. You can still select a point on the map.');
      const data = await response.json(); setResults(data);
      if (!data.length) setError('No matching places found. Try a nearby village or select a point on the map.');
    } catch (err) { setError(err.message || 'Address search failed. Try the map or manual coordinates.'); } finally { setSearching(false); }
  }
  function applyCoordinates() {
    const lat = Number(latitude), lng = Number(longitude);
    if (latitude === '' || longitude === '' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) { setError('Enter a valid latitude (−90 to 90) and longitude (−180 to 180).'); return; }
    setError(''); onChange({ ...value, latitude: lat, longitude: lng, source: 'manual', accuracy: null, confirmed: false, capturedAt: new Date().toISOString() });
  }
  return <div className="location-picker">
    <div className="location-top"><button type="button" className="location-device" onClick={locate} disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <LocateFixed size={17} />}{busy ? 'Finding your location…' : 'Use my current location'}</button><span>or find the place below</span></div>
    <form onSubmit={search} className="location-search"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a village, town, or address" aria-label="Search location" /><button disabled={searching || !query.trim()} type="submit">{searching ? <LoaderCircle size={17} className="spin" /> : 'Search'}</button></form>
    {results.length > 0 && <div className="location-results">{results.map(item => <button type="button" key={item.place_id} onClick={() => { onChange({ ...value, latitude: Number(item.lat), longitude: Number(item.lon), address: item.display_name, source: 'search', accuracy: null, confirmed: false, capturedAt: new Date().toISOString() }); setResults([]); }}><MapPin size={17} /><span>{item.display_name}</span></button>)}</div>}
    <div className="location-map"><MapCanvas value={value} onChange={onChange} /><div className="location-map-hint"><MapPin size={13} />{valid ? 'Drag the pin to adjust' : 'Click the map to place a pin'}</div></div>
    <p className="location-privacy"><ShieldCheck size={15} /> Your exact location is shared with authorized teams. Public maps use approximate locations.</p>
    <div className="location-coordinates"><label>Latitude<input type="number" step="any" placeholder="e.g. 23.3441" value={latitude} onChange={event => setLatitude(event.target.value)} /></label><label>Longitude<input type="number" step="any" placeholder="e.g. 85.3096" value={longitude} onChange={event => setLongitude(event.target.value)} /></label><button type="button" onClick={applyCoordinates}>Set coordinates</button></div>
    <label className="location-address">Village / locality / landmark<input value={value?.address || ''} onChange={event => onChange({ ...value, address: event.target.value, confirmed: false })} placeholder="Help the team find the exact place" /></label>
    {valid && <div className="location-detail"><MapPin size={18} /><div><strong>{Number(value.latitude).toFixed(6)}, {Number(value.longitude).toFixed(6)}</strong><span>{value.accuracy != null ? `Device location accuracy: approximately ${Math.round(value.accuracy)} meters` : `Location selected ${value.source === 'map' ? 'on the map' : value.source === 'exif' ? 'from media metadata' : 'manually'}`}</span></div><button type="button" className={value.confirmed ? 'is-confirmed' : ''} onClick={() => { const next = { ...value, confirmed: true }; onChange(next); onConfirm?.(next); }}><Check size={16} />{value.confirmed ? 'Confirmed' : 'Confirm location'}</button></div>}
    {error && <p className="location-error" role="alert"><Info size={16} />{error}</p>}
  </div>;
}
