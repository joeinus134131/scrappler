'use client';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';

// Fix Leaflet's default icon path issues in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Hack to fix 'Map container is already initialized' during Next.js Fast Refresh
if (typeof window !== 'undefined') {
  const _originalInit = (L.Map.prototype as any)._initContainer;
  (L.Map.prototype as any)._initContainer = function (id: any) {
    const container = typeof id === 'string' ? document.getElementById(id) : id;
    if (container && container._leaflet_id) {
      container._leaflet_id = null;
    }
    _originalInit.call(this, id);
  };
}

// Component to handle auto-zooming and panning
function MapUpdater({ locations }: { locations: any[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length > 0) {
      // Get the latest location
      const latest = locations[locations.length - 1];
      map.flyTo([latest.lat, latest.lng], 13, {
        animate: true,
        duration: 2 // seconds
      });
    }
  }, [locations, map]);

  return null;
}

export default function MapComponent({ results }: { results: any[] }) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Get user's actual location on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.warn("Geolocation denied or failed:", error.message);
        }
      );
    }
  }, []);

  // Extract coordinate data from results
  const locations: { lat: number; lng: number; title: string; type: string }[] = [];
  
  results.forEach(r => {
    const data = r.normalizedData;
    if (data?.pointsOfInterest) {
      data.pointsOfInterest.forEach((poi: any) => {
        if (poi.coordinates) {
          locations.push({
            lat: poi.coordinates.lat,
            lng: poi.coordinates.lng,
            title: poi.name || data.location,
            type: poi.type || 'Location'
          });
        }
      });
    } else if (data?.location) {
      // Map generic cities to approximate coords for demo
      let lat = -6.200000 + (Math.random() * 0.1 - 0.05);
      let lng = 106.816666 + (Math.random() * 0.1 - 0.05);
      const locStr = data.location.toLowerCase();
      
      if (locStr.includes('bali')) { lat = -8.409518; lng = 115.188919; } 
      else if (locStr.includes('bandung')) { lat = -6.917464; lng = 107.619123; }
      else if (locStr.includes('surabaya')) { lat = -7.250445; lng = 112.768845; }
      else if (locStr.includes('new york')) { lat = 40.7128; lng = -74.0060; }

      locations.push({ lat, lng, title: data.location, type: 'Check-in' });
    }
  });

  // Default center: Latest scraped data > User Location > Jakarta
  let initialCenter: [number, number] = [-6.200000, 106.816666];
  if (locations.length > 0) {
    initialCenter = [locations[locations.length - 1].lat, locations[locations.length - 1].lng];
  } else if (userLocation) {
    initialCenter = userLocation;
  }

  return (
    <div style={{ height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
      <MapContainer center={initialCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Street Map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite View">
            <TileLayer
              attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        
        {/* Plot Scraped Data */}
        {locations.map((loc, idx) => (
          loc.type === 'Cafe' || loc.type === 'Location' ? (
            <Marker key={idx} position={[loc.lat, loc.lng]}>
              <Popup>
                <div style={{ fontFamily: 'var(--font-sans)', padding: 4 }}>
                  <strong style={{ display: 'block', fontSize: 14 }}>{loc.title}</strong>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{loc.type}</span>
                </div>
              </Popup>
            </Marker>
          ) : (
            <CircleMarker key={idx} center={[loc.lat, loc.lng]} pathOptions={{ color: 'var(--neon-rose)', fillColor: 'var(--neon-rose)', fillOpacity: 0.5 }} radius={15}>
              <Popup>{loc.title} - Social Check-in</Popup>
            </CircleMarker>
          )
        ))}

        {/* Plot User Location (Blue Dot) if available and no data yet */}
        {userLocation && locations.length === 0 && (
          <CircleMarker center={userLocation} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.8 }} radius={8}>
            <Popup>Your Current Location</Popup>
          </CircleMarker>
        )}

        {/* Dynamic Auto-Pan Logic */}
        {locations.length > 0 && <MapUpdater locations={locations} />}
        {userLocation && locations.length === 0 && <MapUpdater locations={[{lat: userLocation[0], lng: userLocation[1]}]} />}
      </MapContainer>
    </div>
  );
}
