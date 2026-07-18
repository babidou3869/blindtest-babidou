import "./App.css";
import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Lobby from "./pages/Lobby";
import Settings from "./pages/Settings";
import Game from "./pages/Game";
import Callback from "./pages/Callback";
import Playlists from "./pages/Playlists";
import Tracks from "./pages/Tracks";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/callback" element={<Callback />} />
      <Route path="/playlists" element={<Playlists />} />
      <Route
        path="/tracks/:playlistId"
        element={<Tracks />}
      />
      <Route path="/lobby" element={<Lobby />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/game" element={<Game />} />
    </Routes>
  );
}