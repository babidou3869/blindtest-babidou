import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { exchangeCodeForToken } from "../services/spotify";

export default function Callback() {
  const navigate = useNavigate();

  const alreadyExecuted = useRef(false);

  const [message, setMessage] = useState(
    "Connexion à Spotify en cours..."
  );

  useEffect(() => {
    if (alreadyExecuted.current) {
      return;
    }

    alreadyExecuted.current = true;

    async function finishSpotifyLogin() {
      const params = new URLSearchParams(window.location.search);

      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      if (error) {
        setMessage(`Connexion annulée : ${error}`);
        return;
      }

      if (!code) {
        setMessage("Aucun code Spotify reçu.");
        return;
      }

      try {
        await exchangeCodeForToken(code, state);

        window.history.replaceState(
          {},
          document.title,
          "/callback"
        );

        navigate("/playlists", {
          replace: true,
        });
      } catch (error) {
        console.error(error);
        setMessage(error.message);
      }
    }

    finishSpotifyLogin();
  }, [navigate]);

  return (
    <main className="app">
      <section className="hero">
        <div className="logo">🎵</div>

        <p className="eyebrow">
          SPOTIFY
        </p>

        <h1>Connexion</h1>

        <p className="subtitle">
          {message}
        </p>

        <button
          className="btn primary"
          onClick={() => navigate("/")}
        >
          Retour à l’accueil
        </button>
      </section>
    </main>
  );
}