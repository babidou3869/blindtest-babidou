import {
  FaSpotify,
  FaPlay,
  FaUsers,
  FaCog,
  FaList,
} from "react-icons/fa";

import { useNavigate } from "react-router-dom";

import {
  isSpotifyConnected,
  loginSpotify,
  logoutSpotify,
} from "../services/spotify";

export default function Home() {
  const navigate = useNavigate();
  const connected = isSpotifyConnected();

  function disconnectSpotify() {
    logoutSpotify();
    window.location.reload();
  }

  return (
    <main className="app">
      <section className="hero">
        <div className="logo">🎵</div>

        <p className="eyebrow">BLIND TEST MUSICAL</p>

        <h1>Babidou</h1>

        <p className="subtitle">
          Connecte Spotify, choisis une playlist et défie tes amis.
        </p>

        <div className="actions">
          {!connected ? (
            <button
              className="btn spotify"
              onClick={loginSpotify}
            >
              <FaSpotify />
              Se connecter à Spotify
            </button>
          ) : (
            <>
              <button
                className="btn spotify"
                onClick={() => navigate("/playlists")}
              >
                <FaList />
                Voir mes playlists
              </button>

              <button
                className="btn primary"
                onClick={disconnectSpotify}
              >
                Se déconnecter
              </button>
            </>
          )}

          <button
            className="btn primary"
            onClick={() =>
              navigate(connected ? "/playlists" : "/lobby")
            }
          >
            <FaPlay />
            Commencer une partie
          </button>
        </div>

        <div className="modes">
          <article className="mode-card">
            <FaUsers />
            <strong>Multijoueur</strong>
            <span>Bientôt disponible</span>
          </article>

          <article
            className="mode-card"
            onClick={() => navigate("/settings")}
            style={{ cursor: "pointer" }}
          >
            <FaCog />
            <strong>Paramètres</strong>
            <span>Durée et difficulté</span>
          </article>
        </div>
      </section>
    </main>
  );
}