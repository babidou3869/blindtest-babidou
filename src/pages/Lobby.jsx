import { useState } from "react";
import { useNavigate } from "react-router-dom";

function readLocalStorage(key, fallbackValue) {
  try {
    const storedValue = localStorage.getItem(key);

    if (!storedValue) {
      return fallbackValue;
    }

    return JSON.parse(storedValue);
  } catch {
    return fallbackValue;
  }
}

export default function Lobby() {
  const navigate = useNavigate();

  const storedPlaylist = readLocalStorage(
    "babidou_selected_playlist",
    null
  );

  const storedTracks = readLocalStorage(
    "babidou_playlist_tracks",
    []
  );

  const previousSettings = readLocalStorage(
    "babidou_game_settings",
    {
      gameName: "Ma partie",
      rounds: 10,
      duration: 10,
      questionMode: "title",
    }
  );

  const maximumRounds = Math.min(
    storedTracks.length,
    20
  );

  const availableRoundChoices = [5, 10, 15, 20].filter(
    (value) => value <= maximumRounds
  );

  if (
    maximumRounds > 0 &&
    !availableRoundChoices.includes(maximumRounds)
  ) {
    availableRoundChoices.push(maximumRounds);
  }

  availableRoundChoices.sort(
    (firstValue, secondValue) =>
      firstValue - secondValue
  );

  const defaultRounds = Math.min(
    Number(previousSettings.rounds) || 10,
    maximumRounds || 10
  );

  const [gameName, setGameName] = useState(
    previousSettings.gameName || "Ma partie"
  );

  const [rounds, setRounds] = useState(
    defaultRounds
  );

  const [duration, setDuration] = useState(
    Number(previousSettings.duration) || 10
  );

  const [questionMode, setQuestionMode] =
    useState(
      previousSettings.questionMode || "title"
    );

  function startGame() {
    if (storedTracks.length < 4) {
      alert(
        "Choisis d’abord une playlist contenant au moins 4 morceaux."
      );

      navigate("/playlists");

      return;
    }

    const selectedRounds = Math.min(
      Number(rounds),
      storedTracks.length
    );

    const settings = {
      gameName:
        gameName.trim() || "Ma partie",
      rounds: selectedRounds,
      duration: Number(duration),
      questionMode,
    };

    localStorage.setItem(
      "babidou_game_settings",
      JSON.stringify(settings)
    );

    navigate("/game");
  }

  function getModeClass(mode) {
    if (questionMode === mode) {
      return "question-mode-card question-mode-selected";
    }

    return "question-mode-card";
  }

  return (
    <main className="app">
      <section className="hero">
        <p className="eyebrow">
          CONFIGURATION DU BLIND TEST
        </p>

        <h1>Nouvelle partie</h1>

        <p className="subtitle">
          Prépare ta partie, choisis ton mode de jeu
          et lance le blind test.
        </p>

        {storedPlaylist && (
          <article className="selected-playlist-card">
            {storedPlaylist.image && (
              <img
                src={storedPlaylist.image}
                alt={storedPlaylist.name}
              />
            )}

            <div>
              <span>Playlist sélectionnée</span>

              <strong>
                {storedPlaylist.name}
              </strong>

              <small>
                {storedTracks.length} morceaux chargés
              </small>
            </div>
          </article>
        )}

        <div className="settings-grid">
          <article className="setting-card">
            <label htmlFor="game-name">
              Nom de la partie
            </label>

            <input
              id="game-name"
              type="text"
              value={gameName}
              maxLength={40}
              onChange={(event) =>
                setGameName(event.target.value)
              }
            />
          </article>

          <article className="setting-card">
            <label htmlFor="rounds">
              Nombre de manches
            </label>

            <select
              id="rounds"
              value={rounds}
              onChange={(event) =>
                setRounds(
                  Number(event.target.value)
                )
              }
              disabled={
                availableRoundChoices.length === 0
              }
            >
              {availableRoundChoices.map(
                (value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value} manches
                  </option>
                )
              )}
            </select>
          </article>

          <article className="setting-card">
            <label htmlFor="duration">
              Durée de l’extrait
            </label>

            <select
              id="duration"
              value={duration}
              onChange={(event) =>
                setDuration(
                  Number(event.target.value)
                )
              }
            >
              <option value={5}>
                5 secondes
              </option>

              <option value={10}>
                10 secondes
              </option>

              <option value={15}>
                15 secondes
              </option>

              <option value={20}>
                20 secondes
              </option>

              <option value={30}>
                30 secondes
              </option>
            </select>
          </article>
        </div>

        <section className="question-mode-section">
          <p className="eyebrow">
            MODE DE JEU
          </p>

          <h2>Que faut-il deviner ?</h2>

          <div className="question-mode-grid">
            <button
              type="button"
              className={getModeClass("title")}
              onClick={() =>
                setQuestionMode("title")
              }
            >
              <span className="question-mode-icon">
                🎵
              </span>

              <strong>
                Trouver le titre
              </strong>

              <small>
                Les quatre réponses proposées sont
                des titres de chansons.
              </small>
            </button>

            <button
              type="button"
              className={getModeClass("artist")}
              onClick={() =>
                setQuestionMode("artist")
              }
            >
              <span className="question-mode-icon">
                🎤
              </span>

              <strong>
                Trouver l’artiste
              </strong>

              <small>
                Les quatre réponses proposées sont
                des artistes.
              </small>
            </button>

            <button
              type="button"
              className={getModeClass("mixed")}
              onClick={() =>
                setQuestionMode("mixed")
              }
            >
              <span className="question-mode-icon">
                🔀
              </span>

              <strong>
                Mode mixte
              </strong>

              <small>
                Babidou choisit aléatoirement entre
                le titre et l’artiste.
              </small>
            </button>
          </div>
        </section>

        <div className="actions">
          <button
            className="btn primary"
            type="button"
            onClick={() =>
              navigate("/playlists")
            }
          >
            🎵 Changer de playlist
          </button>

          <button
            className="btn spotify"
            type="button"
            onClick={startGame}
          >
            ▶ Lancer la partie
          </button>
        </div>
      </section>
    </main>
  );
}