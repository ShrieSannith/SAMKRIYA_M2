import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  TextField,
  Slider,
  Divider,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  ThemeProvider,
  createTheme,
} from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import L from "leaflet";

// --- Dark Material UI Theme ---
const darkTheme = createTheme({
  palette: {
    mode: "dark",
    background: { default: "#121212", paper: "#1e1e1e" },
  },
  typography: {
    fontFamily: "Inter, Arial, sans-serif",
  },
});

// --- Fix Leaflet Default Icons ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// --- Tamil Nadu Center ---
const TAMIL_NADU_CENTER = [10.9094, 78.3665];

export default function App() {
  const mapRef = useRef(null);

  const [sourceQuery, setSourceQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");

  const [sourceResults, setSourceResults] = useState([]);
  const [destResults, setDestResults] = useState([]);

  const [source, setSource] = useState(null);
  const [destination, setDestination] = useState(null);

  const [trafficSeverity, setTrafficSeverity] = useState(1.0);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(null);
  const [bounds, setBounds] = useState(null);

  // --------- Search API (Nominatim) ----------
  const searchAddress = async (query, setter) => {
    if (!query) return setter([]);
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${query}, Tamil Nadu, India`;
    const res = await axios.get(url);
    setter(res.data);
  };

  useEffect(() => {
    const t = setTimeout(() => searchAddress(sourceQuery, setSourceResults), 450);
    return () => clearTimeout(t);
  }, [sourceQuery]);

  useEffect(() => {
    const t = setTimeout(() => searchAddress(destQuery, setDestResults), 450);
    return () => clearTimeout(t);
  }, [destQuery]);

  // --------- Select Source/Destination ----------
  const onSelectSource = (data) => {
    setSource(data);
    setSourceResults([]);
  };
  const onSelectDestination = (data) => {
    setDestination(data);
    setDestResults([]);
  };

  // --------- OSRM Routing ----------
  useEffect(() => {
    const fetchRoutes = async () => {
      if (!source || !destination) return;
      const url = `https://router.project-osrm.org/route/v1/driving/${source.lon},${source.lat};${destination.lon},${destination.lat}?alternatives=true&geometries=geojson&overview=full`;
      const res = await axios.get(url);
      const fetched = res.data.routes.map((r) => {
        const roadConditions = ["Good", "Moderate", "Rough"];
        const rc = roadConditions[Math.floor(Math.random() * 3)];
        const trafficMult = trafficSeverity;
        return {
          distance: r.distance,
          duration: r.duration,
          adjustedDuration: r.duration * trafficMult,
          trafficMultiplier: trafficMult,
          roadCondition: rc,
          latlngs: r.geometry.coordinates.map((c) => [c[1], c[0]]),
          bbox: r.bounds,
        };
      });
      setRoutes(fetched);
    };
    fetchRoutes();
  }, [source, destination, trafficSeverity]);

  const getRouteColor = (i) => ["#4fc3f7", "#ffb74d", "#81c784", "#ce93d8"][i % 4];
  const formatDistance = (d) => `${(d / 1000).toFixed(1)} km`;
  const formatDuration = (d) => `${Math.round(d / 60)} min`;

  // Smooth fly animation
  function MapFlyTo({ bounds }) {
    const map = mapRef.current;
    useEffect(() => {
      if (map && bounds) map.flyToBounds(bounds, { duration: 1.4 });
    }, [bounds]);
    return null;
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ display: "flex", height: "100vh" }}>
        {/* ---------- Left Sidebar ---------- */}
        <Paper
          elevation={6}
          sx={{
            width: 360,
            p: 2,
            bgcolor: "background.paper",
            overflowY: "auto",
            borderRight: "1px solid #333",
          }}
        >
          <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
            Route Optimizer
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: "gray" }}>
            Team Marvels
          </Typography>

          {/* Source */}
          <TextField
            label="Source"
            fullWidth
            size="small"
            value={sourceQuery}
            onChange={(e) => setSourceQuery(e.target.value)}
            sx={{ mb: 1.5 }}
          />
          {sourceResults.length > 0 && (
            <List sx={{ maxHeight: 150, overflowY: "auto", bgcolor: "#252525" }}>
              {sourceResults.map((r, i) => (
                <ListItemButton key={i} onClick={() => onSelectSource(r)}>
                  <ListItemText primary={r.display_name} />
                </ListItemButton>
              ))}
            </List>
          )}

          {/* Destination */}
          <TextField
            label="Destination"
            fullWidth
            size="small"
            value={destQuery}
            onChange={(e) => setDestQuery(e.target.value)}
            sx={{ mt: 2, mb: 1.5 }}
          />
          {destResults.length > 0 && (
            <List sx={{ maxHeight: 150, overflowY: "auto", bgcolor: "#252525" }}>
              {destResults.map((r, i) => (
                <ListItemButton key={i} onClick={() => onSelectDestination(r)}>
                  <ListItemText primary={r.display_name} />
                </ListItemButton>
              ))}
            </List>
          )}

          {/* Traffic Slider */}
          {/* <Typography sx={{ mt: 2 }}>Traffic Simulation</Typography>
          <Slider
            min={0.5}
            max={2.0}
            step={0.05}
            value={trafficSeverity}
            onChange={(e) => setTrafficSeverity(e.target.value)}
          /> */}
          {/* <Typography variant="caption" sx={{ color: "gray" }}>
            {trafficSeverity.toFixed(2)}× congestion — affects ETA only
          </Typography> */}

          <Divider sx={{ my: 2 }} />

          {/* Routes */}
          <Typography variant="h6" sx={{ mb: 1 }}>
            Routes
          </Typography>

          {routes.length === 0 && (
            <Typography sx={{ color: "gray" }}>Select source & destination…</Typography>
          )}

          {routes.map((r, i) => (
            <Paper
              key={i}
              onMouseEnter={() => setSelectedRouteIndex(i)}
              onMouseLeave={() => setSelectedRouteIndex(null)}
              onClick={() => {
                setSelectedRouteIndex(i);
                setBounds(r.bbox);
              }}
              sx={{
                p: 1.5,
                mb: 1,
                cursor: "pointer",
                bgcolor: selectedRouteIndex === i ? "#2a3642" : "#1f1f1f",
                borderLeft: `6px solid ${getRouteColor(i)}`,
              }}
            >
              <Typography fontWeight={600}>Route {i + 1}</Typography>
              <Typography fontSize={13}>
                {formatDistance(r.distance)} • ETA: {formatDuration(r.adjustedDuration)}
              </Typography>
              <Typography fontSize={12} sx={{ color: "gray" }}>
                Traffic: {r.trafficMultiplier.toFixed(2)}× • Road: {r.roadCondition}
              </Typography>
            </Paper>
          ))}
        </Paper>

        {/* ---------- Map Section ---------- */}
        <Box sx={{ flex: 1 }}>
          <MapContainer
            center={TAMIL_NADU_CENTER}
            zoom={7}
            style={{ height: "100%", width: "100%" }}
            whenCreated={(map) => (mapRef.current = map)}
          >
            <TileLayer
  url="https://cartodb-basemaps-b.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
  attribution='© OpenStreetMap, © CARTO'
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
                  opacity: selectedRouteIndex === i ? 0.97 : 0.65,
                }}
                eventHandlers={{
                  mouseover: () => setSelectedRouteIndex(i),
                  mouseout: () => setSelectedRouteIndex(null),
                  click: () => {
                    setSelectedRouteIndex(i);
                    setBounds(r.bbox);
                  },
                }}
              >
                <Tooltip sticky>
                  <b>Route {i + 1}</b><br />
                  ETA: {formatDuration(r.adjustedDuration)} <br />
                  Dist: {formatDistance(r.distance)} <br />
                  Traffic: {r.trafficMultiplier.toFixed(2)}× <br />
                  Road: {r.roadCondition}
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
