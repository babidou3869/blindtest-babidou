import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  logoutSpotify,
  spotifyApi,
} from "../services/spotify";

export default function Playlists() {
  const navigate = useNavigate();

  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadPlaylists() {
      try {
        const data = await spotifyApi("/me/playlists?limit=50");

        setPlaylists(data.items || []);
      } catch (error) {
        console.error(error);
        setErrorMessage(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadPlaylists();
  }, []);

  function selectPlaylist(playlist) {
    localStorage.setItem(
      "babidou_selected_playlist",
      JSON.stringify({
        id: playlist.id,
        name: playlist.name,
        image: playlist.images?.[0]?.url || "",
        spotifyUrl: playlist.external_urls?.spotify || "",
      })
    );

    navigate(`/tracks/${playlist.id}`);
  }

  function disconnect() {
    logoutSpotify();
    navigate("/");
  }

  return (
    <main className="app">
      <section className="hero">
        <p className="eyebrow">BIBLIOTHÈQUE SPOTIFY</p>

        <h1>Mes playlists</h1>

        <p className="subtitle">
          Choisis la playlist qui servira pour ton blind test.
        </p>

        {loading && (
          <p className="subtitle">
            Chargement de tes playlists...
          </p>
        )}

        {errorMessage && (
          <article className="mode-card">
            <strong>Erreur Spotify</strong>
            <span>{errorMessage}</span>
          </article>
        )}

        {!loading &&
          !errorMessage &&
          playlists.length === 0 && (
            <article className="mode-card">
              <strong>Aucune playlist trouvée</strong>
              <span>
                Ajoute une playlist dans Spotify puis recharge
                cette page.
              </span>
            </article>
          )}

        <div className="modes">
          {playlists.map((playlist) => {
            const itemCount =
              playlist.items?.total ??
              playlist.tracks?.total ??
              null;

            return (
              <article
                key={playlist.id}
                className="mode-card"
                onClick={() => selectPlaylist(playlist)}
                style={{ cursor: "pointer" }}
              >
                {playlist.images?.[0]?.url && (
                  <img
                    src={playlist.images[0].url}
                    alt={playlist.name}
                    style={{
                      width: "100%",
                      maxWidth: "180px",
                      aspectRatio: "1 / 1",
                      objectFit: "cover",
                      borderRadius: "12px",
                      marginBottom: "12px",
                    }}
                  />
                )}

                <strong>{playlist.name}</strong>

                <span>
                  {itemCount === null
                    ? "Clique pour charger les morceaux"
                    : `${itemCount} morceaux`}
                </span>
              </article>
            );
          })}
        </div>

        <div
          className="actions"
          style={{ marginTop: "30px" }}
        >
          <button
            className="btn primary"
            onClick={() => navigate("/")}
          >
            Retour à l’accueil
          </button>

          <button
            className="btn spotify"
            onClick={disconnect}
          >
            Se déconnecter
          </button>
        </div>
      </section>
    </main>
  );
}