import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  TextField,
  Divider,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  ThemeProvider,
  createTheme,
  IconButton,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import L from "leaflet";

/* ------------ Dark Material UI Theme ------------ */
const darkTheme = createTheme({
  palette: {
    mode: "dark",
    background: { default: "#0d0d0d", paper: "#1a1a1a" },
  },
  typography: { fontFamily: "Inter, Arial, sans-serif" },
});

/* ------------ Fix Leaflet Default Icons ------------ */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

/* ------------ Map Center ------------ */
const TAMIL_NADU_CENTER = [10.9094, 78.3665];

export default function App() {
  const mapRef = useRef(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sourceQuery, setSourceQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");

  const [sourceResults, setSourceResults] = useState([]);
  const [destResults, setDestResults] = useState([]);
  const [source, setSource] = useState(null);
  const [destination, setDestination] = useState(null);

  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(null);
  const [bounds, setBounds] = useState(null);

  /* ------------ Search API (Nominatim) ------------ */
  const searchAddress = async (query, setter) => {
    if (!query) return setter([]);
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${query}, Tamil Nadu, India`;
    const res = await axios.get(url);
    setter(res.data);
  };

  useEffect(() => {
    const t = setTimeout(() => searchAddress(sourceQuery, setSourceResults), 350);
    return () => clearTimeout(t);
  }, [sourceQuery]);

  useEffect(() => {
    const t = setTimeout(() => searchAddress(destQuery, setDestResults), 350);
    return () => clearTimeout(t);
  }, [destQuery]);

  const onSelectSource = (data) => { setSource(data); setSourceResults([]); };
  const onSelectDestination = (data) => { setDestination(data); setDestResults([]); };

  /* ------------ Fetch OSRM Route + Weighted ETA Logic ------------ */
  useEffect(() => {
    const fetchRoutes = async () => {
      if (!source || !destination) return;

      const url = `https://router.project-osrm.org/route/v1/driving/${source.lon},${source.lat};${destination.lon},${destination.lat}?alternatives=true&geometries=geojson&overview=full`;
      const res = await axios.get(url);

      const fetched = res.data.routes.map((r, index) => {
        // dynamic metrics
        const trafficLevel = Math.floor(Math.random() * 60 + 20); // 20 – 80 %
        const roadQuality = Math.floor(Math.random() * 50 + 50); // 50 – 100 %

        // weighted impact model
        const trafficImpact = (trafficLevel / 100) * 0.45; // 45% effect on ETA
        const roadImpact = ((50 - roadQuality) / 50) * 0.25; // 25% effect if roads are bad

        const adjustedDuration = r.duration * (1 + trafficImpact + roadImpact);

        return {
          distance: r.distance,
          duration: r.duration,
          adjustedDuration,
          latlngs: r.geometry.coordinates.map((c) => [c[1], c[0]]),
          bbox: r.bounds,
          trafficLevel,
          roadQuality,
          priority: index + 1,
        };
      });

      setRoutes(fetched);
    };
    fetchRoutes();
  }, [source, destination]);

  const getRouteColor = (i) => ["#4fc3f7", "#ffb74d", "#81c784", "#ce93d8"][i % 4];

  const formatDistance = (d) => `${(d / 1000).toFixed(1)} km`;

  const formatDuration = (seconds) => {
    const mins = Math.round(seconds / 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  };

  function MapFlyTo({ bounds }) {
    const map = mapRef.current;
    useEffect(() => {
      if (map && bounds) map.flyToBounds(bounds, { duration: 1.2 });
    }, [bounds]);
    return null;
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ display: "flex", height: "100vh", width: "100vw" }}>

        {/* Toggle Sidebar Button */}
        {!sidebarOpen && (
          <IconButton
            onClick={() => setSidebarOpen(true)}
            sx={{
              position: "absolute",
              top: 18,
              left: 18,
              zIndex: 9999,
              bgcolor: "#000000cc",
              "&:hover": { bgcolor: "#111111" },
            }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Sidebar */}
        {sidebarOpen && (
          <Paper
            elevation={6}
            sx={{
              width: { xs: "88%", sm: 360 },
              p: 2,
              backdropFilter: "blur(8px)",
              bgcolor: "rgba(20,20,20,0.85)",
              overflowY: "auto",
              borderRight: "1px solid #444",
              position: { xs: "absolute", sm: "relative" },
              height: "100vh",
              zIndex: 999,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="h5" fontWeight={700}>Route Optimizer</Typography>
              <IconButton onClick={() => setSidebarOpen(false)}>
                <CloseIcon sx={{ color: "white" }} />
              </IconButton>
            </Box>

            <TextField
              label="Source"
              fullWidth
              size="small"
              value={sourceQuery}
              onChange={(e) => setSourceQuery(e.target.value)}
              sx={{ mt: 2 }}
            />
            {sourceResults.length > 0 && (
              <List sx={{ maxHeight: 130, overflowY: "auto", bgcolor: "#252525" }}>
                {sourceResults.map((r, i) => (
                  <ListItemButton key={i} onClick={() => onSelectSource(r)}>
                    <ListItemText primary={r.display_name} />
                  </ListItemButton>
                ))}
              </List>
            )}

            <TextField
              label="Destination"
              fullWidth
              size="small"
              value={destQuery}
              onChange={(e) => setDestQuery(e.target.value)}
              sx={{ mt: 2 }}
            />
            {destResults.length > 0 && (
              <List sx={{ maxHeight: 130, overflowY: "auto", bgcolor: "#252525" }}>
                {destResults.map((r, i) => (
                  <ListItemButton key={i} onClick={() => onSelectDestination(r)}>
                    <ListItemText primary={r.display_name} />
                  </ListItemButton>
                ))}
              </List>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" sx={{ mb: 1 }}>Available Routes</Typography>

            {routes.length === 0 && (
              <Typography sx={{ color: "gray" }}>Select source & destination…</Typography>
            )}

            {routes.map((r, i) => (
              <Paper
                key={i}
                sx={{
                  p: 1.5,
                  mb: 1,
                  cursor: "pointer",
                  bgcolor: selectedRouteIndex === i ? "#2a3642" : "#1f1f1f",
                  borderLeft: `6px solid ${getRouteColor(i)}`,
                }}
                onClick={() => {
                  setSelectedRouteIndex(i);
                  setBounds(r.bbox);
                }}
              >
                <Typography fontWeight={600}>Route {i + 1}</Typography>
                <Typography fontSize={13}>Distance: {formatDistance(r.distance)}</Typography>
                <Typography fontSize={13}>ETA: {formatDuration(r.adjustedDuration)}</Typography>
                <Typography fontSize={13}>Traffic Level: {r.trafficLevel}%</Typography>
                <Typography fontSize={13}>Road Condition: {r.roadQuality}%</Typography>
              </Paper>
            ))}
          </Paper>
        )}

        {/* ---------- MAP ---------- */}
        <Box sx={{ flex: 1 }}>
          <MapContainer
            center={TAMIL_NADU_CENTER}
            zoom={7}
            style={{ height: "100%", width: "100%" }}
            whenCreated={(map) => (mapRef.current = map)}
          >
            <TileLayer
              url="https://cartodb-basemaps-b.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
            />

            {source && (
              <Marker position={[source.lat, source.lon]}>
                <Popup><strong>Source</strong><br />{source.display_name}</Popup>
              </Marker>
            )}

            {destination && (
              <Marker position={[destination.lat, destination.lon]}>
                <Popup><strong>Destination</strong><br />{destination.display_name}</Popup>
              </Marker>
            )}

            {routes.map((r, i) => (
              <Polyline
                key={i}
                positions={r.latlngs}
                pathOptions={{
                  color: getRouteColor(i),
                  weight: selectedRouteIndex === i ? 7 : 4,
                  opacity: selectedRouteIndex === i ? 1 : 0.7,
                }}
                eventHandlers={{
                  click: () => {
                    setSelectedRouteIndex(i);
                    setBounds(r.bbox);
                  },
                }}
              >
                <Tooltip sticky>
                  <b>Route {i + 1}</b><br />
                  Distance: {formatDistance(r.distance)}<br />
                  ETA: {formatDuration(r.adjustedDuration)}<br />
                  Traffic Level: {r.trafficLevel}%<br />
                  Road Condition: {r.roadQuality}%
                </Tooltip>
              </Polyline>
            ))}

            {bounds && <MapFlyTo bounds={bounds} />}
          </MapContainer>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
