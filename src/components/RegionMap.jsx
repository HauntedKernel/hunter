import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Service-region map: one soft marker per catalogued ZIP across Dallas County, colored by
// availability. Deliberately ZIP-level (coverage), never individual parcels. Ivory-editorial:
// light CARTO basemap, muted markers, elegant legend.
const STATUS = {
  open:    { fill: '#5f8a6a', label: 'Fully open' },       // sage — everything available
  partial: { fill: '#b7822c', label: 'Partly claimed' },   // gold — a list or shared seat taken
  claimed: { fill: '#3a352e', label: 'Exclusively held' }, // charcoal — whole ZIP owned
}

function zipStatus(z) {
  if (z.zipExclusive?.status === 'sold') return 'claimed'
  const anySold = (z.categories || []).some(c => c.exclusive.status === 'sold')
  if (anySold || z.shared?.status !== 'available') return 'partial'
  return 'open'
}

export default function RegionMap({ zips = [], onSelectZip }) {
  const pts = zips.filter(z => z.lat && z.lng)
  const maxLeads = Math.max(1, ...pts.map(z => z.leadCount))

  return (
    <div className="region-map">
      <MapContainer center={[32.79, -96.80]} zoom={10} scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }} attributionControl={false}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd" />
        {pts.map(z => {
          const st = zipStatus(z)
          const r = 7 + 15 * Math.sqrt(z.leadCount / maxLeads)   // area ∝ leads
          return (
            <CircleMarker key={z.zip} center={[z.lat, z.lng]} radius={r}
              pathOptions={{ color: STATUS[st].fill, weight: 1, fillColor: STATUS[st].fill, fillOpacity: 0.7 }}
              eventHandlers={{ click: () => onSelectZip && onSelectZip(z.zip) }}>
              <Tooltip direction="top" offset={[0, -4]}>
                <b>{z.zip}</b> · {z.leadCount.toLocaleString()} sellers<br />
                <span style={{ color: STATUS[st].fill }}>{STATUS[st].label}</span>
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>

      <div className="region-legend">
        <div className="region-legend-title">Dallas County</div>
        {Object.entries(STATUS).map(([k, v]) => (
          <div className="region-legend-row" key={k}>
            <span className="region-dot" style={{ background: v.fill }} />{v.label}
          </div>
        ))}
        <div className="region-legend-note">Marker size ∝ live sellers</div>
      </div>
    </div>
  )
}
