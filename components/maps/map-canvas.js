'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const pin = L.divIcon({ className: 'portal-map-pin', html: '<span></span>', iconSize: [28, 36], iconAnchor: [14, 34] });

function MapInteraction({ value, onChange, readOnly }) {
  const map = useMap();
  useEffect(() => {
    if (value && Number.isFinite(Number(value.latitude)) && Number.isFinite(Number(value.longitude))) {
      map.setView([Number(value.latitude), Number(value.longitude)], Math.max(map.getZoom(), 12));
    }
  }, [value?.latitude, value?.longitude, map]);
  useMapEvents({ click(event) {
    if (!readOnly) onChange?.({ ...value, latitude: event.latlng.lat, longitude: event.latlng.lng, accuracy: null, source: 'map', confirmed: false, capturedAt: new Date().toISOString() });
  } });
  return null;
}

export default function MapCanvas({ value, onChange, markers = [], readOnly = false }) {
  const hasPoint = value?.latitude != null && value?.longitude != null && Number.isFinite(Number(value.latitude)) && Number.isFinite(Number(value.longitude));
  const center = hasPoint ? [Number(value.latitude), Number(value.longitude)] : [23.62, 85.3];
  return <MapContainer center={center} zoom={hasPoint ? 13 : 7} scrollWheelZoom={false} style={{ width: '100%', height: '100%', minHeight: 300 }}>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <MapInteraction value={value} onChange={onChange} readOnly={readOnly} />
    {hasPoint && <Marker position={center} icon={pin} draggable={!readOnly} eventHandlers={{ dragend(event) { const next = event.target.getLatLng(); onChange?.({ ...value, latitude: next.lat, longitude: next.lng, accuracy: null, source: 'map', confirmed: false, capturedAt: new Date().toISOString() }); } }}><Popup>{value.address || 'Selected problem location'}</Popup></Marker>}
    {markers.filter(item => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))).map((item, index) => <Marker key={item.id || index} position={[Number(item.latitude), Number(item.longitude)]} icon={pin}><Popup>{item.id ? <a href={`/challenges/${item.id}`}>{item.title || 'View challenge'}</a> : item.title}</Popup></Marker>)}
  </MapContainer>;
}
