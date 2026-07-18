import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { spotifyApi } from "../services/spotify";

export default function Tracks() {
  const navigate = useNavigate();
  const { playlistId } = useParams();

  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadTracks() {
      try {
        const storedPlaylist = localStorage.getItem(
          "babidou_selected_playlist"
        );

        if (storedPlaylist) {
          setPlaylist(JSON.parse(storedPlaylist));
        }

        const loadedTracks = [];
        let offset = 0;
        const limit = 50;
        let hasMore = true;

        while (hasMore) {
          const data = await spotifyApi(
            `/playlists/${playlistId}/items?limit=${limit}&offset=${offset}`
          );

          const pageItems = data.items || [];

          for (const item of pageItems) {
            const track =
              item.item ||
              item.track ||
              null;

            if (
              track &&
              track.type === "track" &&
              track.id &&
              track.name
            ) {
              loadedTracks.push({
                id: track.id,
                uri: track.uri,
                name: track.name,
                artists:
                  track.artists
                    ?.map((artist) => artist.name)
                    .join(", ") || "Artiste inconnu",
                album: track.album?.name || "",
                image:
                  track.album?.images?.[0]?.url || "",
                spotifyUrl:
                  track.external_urls?.spotify || "",
              });
            }
          }

          offset += pageItems.length;

          hasMore =
            Boolean(data.next) &&
            pageItems.length > 0;
        }

        setTracks(loadedTracks);

        localStorage.setItem(
          "babidou_playlist_tracks",
          JSON.stringify(loadedTracks)
        );
      } catch (error) {
        console.error(error);
        setErrorMessage(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadTracks();
  }, [playlistId]);

  function continueToLobby() {
    if (tracks.length < 4) {
      setErrorMessage(
        "Cette playlist doit contenir au moins 4 morceaux pour créer les réponses du blind test."
      );

      return;
    }

    navigate("/lobby");
  }

  return (
    <main className="app">
      <section className="hero">
        <p className="eyebrow">PLAYLIST SÉLECTIONNÉE</p>

        <h1>
          {playlist?.name || "Chargement..."}
        </h1>

        {playlist?.image && (
          <img
            src={playlist.image}
            alt={playlist.name}
            style={{
              width: "180px",
              height: "180px",
              objectFit: "cover",
              borderRadius: "18px",
              marginBottom: "20px",
            }}
          />
        )}

        {loading && (
          <p className="subtitle">
            Chargement des morceaux Spotify...
          </p>
        )}

        {errorMessage && (
          <article className="mode-card">
            <strong>Impossible de charger la playlist</strong>
            <span>{errorMessage}</span>
          </article>
        )}

        {!loading && !errorMessage && (
          <>
            <p className="subtitle">
              {tracks.length} morceaux disponibles
            </p>

            <div className="modes">
              {tracks.slice(0, 20).map((track, index) => (
                <article
                  key={`${track.id}-${index}`}
                  className="mode-card"
                >
                  {track.image && (
                    <img
                      src={track.image}
                      alt={track.album}
                      style={{
                        width: "80px",
                        height: "80px",
                        objectFit: "cover",
                        borderRadius: "10px",
                        marginBottom: "10px",
                      }}
                    />
                  )}

                  <strong>
                    {index + 1}. {track.name}
                  </strong>

                  <span>{track.artists}</span>
                </article>
              ))}
            </div>

            {tracks.length > 20 && (
              <p className="subtitle">
                Et {tracks.length - 20} autres morceaux…
              </p>
            )}
          </>
        )}

        <div
          className="actions"
          style={{ marginTop: "30px" }}
        >
          <button
            className="btn primary"
            onClick={() => navigate("/playlists")}
          >
            Retour aux playlists
          </button>

          {!loading && tracks.length > 0 && (
            <button
              className="btn spotify"
              onClick={continueToLobby}
            >
              Utiliser cette playlist
            </button>
          )}
        </div>
      </section>
    </main>
  );
}