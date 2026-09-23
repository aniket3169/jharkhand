'use client';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
export default function DashboardMap({ problems = [] }) {
  return <MapContainer center={[23.62, 85.5]} zoom={7} scrollWheelZoom={false} className="dashboard-leaflet" attributionControl={true}><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />{problems.filter(p => p.location?.latitude != null).map(p => <CircleMarker key={p.id} center={[p.location.latitude, p.location.longitude]} radius={p.priority === 'High' ? 8 : 6} pathOptions={{ color: '#fff', weight: 2, fillColor: p.status === 'Resolved' ? '#0e8c74' : p.priority === 'High' || p.priority === 'Critical' ? '#e8a14a' : '#558eae', fillOpacity: 0.9 }}><Tooltip><strong>{p.title}</strong><br />{p.district} · {p.status}<br /><a href={`/challenges/${p.id}`}>View challenge →</a></Tooltip></CircleMarker>)}</MapContainer>;
}
