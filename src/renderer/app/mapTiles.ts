// Map tile servers, shared by the designer (Leaflet) and the race minimap (SVG).
export const ESRI_SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const ESRI_ATTRIBUTION = "Esri, Maxar, Earthstar Geographics";
export const ESRI_MAX_NATIVE_ZOOM = 19;
export const OSM_STREETS = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export function tileUrl(template: string, z: number, x: number, y: number): string {
  return template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}
