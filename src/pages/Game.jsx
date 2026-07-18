import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import { spotifyApi } from "../services/spotify";

import {
  disconnectSpotifyPlayer,
  getSpotifyPlayer,
  initializeSpotifyPlayer,
  pauseSpotifyPlayer,
} from "../services/spotifyPlayer";

function shuffle(array) {
  const copy = [...array];

  for (
    let index = copy.length - 1;
    index > 0;
    index -= 1
  ) {
    const randomIndex = Math.floor(
      Math.random() * (index + 1)
    );

    [copy[index], copy[randomIndex]] = [
      copy[randomIndex],
      copy[index],
    ];
  }

  return copy;
}

function createAnswers(
  correctTrack,
  allTracks
) {
  const wrongAnswers = shuffle(
    allTracks.filter(
      (track) =>
        track.id !== correctTrack.id
    )
  ).slice(0, 3);

  return shuffle([
    correctTrack,
    ...wrongAnswers,
  ]);
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(
      resolve,
      milliseconds
    );
  });
}

function getErrorMessage(error) {
  return String(
    error?.message ||
      error?.body?.error?.message ||
      error ||
      ""
  );
}

function isDeviceError(error) {
  const message =
    getErrorMessage(error).toLowerCase();

  return (
    message.includes("404") ||
    message.includes("device not found") ||
    message.includes("no active device") ||
    message.includes("device is not ready")
  );
}

function readStoredJson(
  key,
  fallbackValue
) {
  try {
    const storedValue =
      localStorage.getItem(key);

    if (!storedValue) {
      return fallbackValue;
    }

    return JSON.parse(storedValue);
  } catch {
    return fallbackValue;
  }
}

export default function Game() {
  const navigate = useNavigate();

  const intervalRef = useRef(null);
  const deviceIdRef = useRef(null);
  const gameTracksRef = useRef([]);
  const playbackRequestRef = useRef(0);
  const mountedRef = useRef(true);

  const tracks = readStoredJson(
    "babidou_playlist_tracks",
    []
  );

  const settings = readStoredJson(
    "babidou_game_settings",
    {
      gameName: "Ma partie",
      rounds: 10,
      duration: 10,
      questionMode: "title",
    }
  );

  const roundDuration =
    Math.max(
      5,
      Number(settings.duration) || 10
    );

  const [gameTracks, setGameTracks] =
    useState([]);

  const [
    currentIndex,
    setCurrentIndex,
  ] = useState(0);

  const [answers, setAnswers] =
    useState([]);

  const [timeLeft, setTimeLeft] =
    useState(roundDuration);

  const [score, setScore] =
    useState(0);

  const [combo, setCombo] =
    useState(0);

  const [bestCombo, setBestCombo] =
    useState(0);

  const [
    selectedId,
    setSelectedId,
  ] = useState(null);

  const [status, setStatus] =
    useState("waiting");

  const [feedback, setFeedback] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    loadingMessage,
    setLoadingMessage,
  ] = useState(
    "Préparation du lecteur Spotify..."
  );

  const currentTrack =
    gameTracks[currentIndex];

  const progressPercent =
    roundDuration > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (timeLeft /
              roundDuration) *
              100
          )
        )
      : 0;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      playbackRequestRef.current += 1;

      stopTimer();

      pauseSpotifyPlayer().catch(
        () => {}
      );

      disconnectSpotifyPlayer();
    };
  }, []);

  function stopTimer() {
    if (intervalRef.current) {
      window.clearInterval(
        intervalRef.current
      );

      intervalRef.current = null;
    }
  }

  function startTimer() {
    stopTimer();

    setTimeLeft(roundDuration);

    intervalRef.current =
      window.setInterval(() => {
        setTimeLeft(
          (previousTime) => {
            if (previousTime <= 1) {
              stopTimer();

              pauseSpotifyPlayer().catch(
                () => {}
              );

              setFeedback(
                "⏰ Temps écoulé !"
              );

              setCombo(0);
              setStatus("reveal");

              return 0;
            }

            return previousTime - 1;
          }
        );
      }, 1000);
  }

  async function waitForBabidouDevice(
    deviceId,
    maximumWait = 10000
  ) {
    const startedAt = Date.now();

    while (
      Date.now() - startedAt <
      maximumWait
    ) {
      const response = await spotifyApi(
        "/me/player/devices"
      );

      const device =
        response?.devices?.find(
          (item) =>
            item.id === deviceId
        );

      if (
        device &&
        device.is_restricted !== true
      ) {
        return device;
      }

      await wait(400);
    }

    throw new Error(
      "Le lecteur Babidou n’est pas encore disponible dans Spotify."
    );
  }

  async function activateBabidouDevice(
    deviceId
  ) {
    await waitForBabidouDevice(
      deviceId
    );

    await spotifyApi("/me/player", {
      method: "PUT",

      body: JSON.stringify({
        device_ids: [deviceId],
        play: false,
      }),
    });

    await wait(900);
  }

  async function sendPlayCommand(
    track,
    deviceId
  ) {
    await spotifyApi(
      `/me/player/play?device_id=${encodeURIComponent(
        deviceId
      )}`,
      {
        method: "PUT",

        body: JSON.stringify({
          uris: [track.uri],
          position_ms: 0,
        }),
      }
    );
  }

  async function resetPlayback(
    deviceId
  ) {
    const player =
      getSpotifyPlayer();

    try {
      if (player) {
        await player.pause();
      }
    } catch {
      // Le lecteur peut déjà être arrêté.
    }

    await wait(250);

    await activateBabidouDevice(
      deviceId
    );
  }

  async function waitForMovingPlayback(
    expectedTrack,
    requestId,
    maximumWait = 9000
  ) {
    const player =
      getSpotifyPlayer();

    if (!player) {
      throw new Error(
        "Le lecteur Spotify Babidou est introuvable."
      );
    }

    const startedAt = Date.now();

    let previousPosition = null;
    let movingChecks = 0;

    while (
      Date.now() - startedAt <
      maximumWait
    ) {
      if (
        requestId !==
        playbackRequestRef.current
      ) {
        throw new Error(
          "Lecture annulée."
        );
      }

      try {
        const state =
          await player.getCurrentState();

        const spotifyTrack =
          state?.track_window
            ?.current_track;

        const currentUri =
          spotifyTrack?.uri;

        const currentPosition =
          Number(state?.position);

        const correctTrack =
          currentUri ===
          expectedTrack.uri;

        const declaredAsPlaying =
          state &&
          state.paused === false;

        const validPosition =
          Number.isFinite(
            currentPosition
          );

        if (
          correctTrack &&
          declaredAsPlaying &&
          validPosition
        ) {
          if (
            previousPosition !== null &&
            currentPosition >
              previousPosition + 80
          ) {
            movingChecks += 1;
          } else if (
            previousPosition !== null &&
            currentPosition <=
              previousPosition
          ) {
            movingChecks = 0;
          }

          previousPosition =
            currentPosition;

          /*
           * On exige plusieurs progressions
           * successives de la position.
           *
           * Le chrono ne commence donc pas
           * simplement parce que Spotify
           * annonce "paused: false".
           */
          if (
            currentPosition >= 300 &&
            movingChecks >= 2
          ) {
            return true;
          }
        } else {
          previousPosition = null;
          movingChecks = 0;
        }
      } catch (error) {
        console.warn(
          "Contrôle de la progression Spotify :",
          error
        );
      }

      await wait(250);
    }

    return false;
  }

  async function playTrackAndWait(
    track,
    deviceId,
    requestId
  ) {
    const maximumAttempts = 4;

    for (
      let attempt = 1;
      attempt <= maximumAttempts;
      attempt += 1
    ) {
      if (
        requestId !==
        playbackRequestRef.current
      ) {
        throw new Error(
          "Lecture annulée."
        );
      }

      setLoadingMessage(
        attempt === 1
          ? "Lancement du morceau..."
          : `Spotify n’a pas démarré. Nouvelle tentative ${attempt}/${maximumAttempts}...`
      );

      try {
        if (attempt > 1) {
          await resetPlayback(
            deviceId
          );
        }

        await sendPlayCommand(
          track,
          deviceId
        );

        const playbackIsMoving =
          await waitForMovingPlayback(
            track,
            requestId,
            8500
          );

        if (playbackIsMoving) {
          /*
           * Petite marge pour éviter que
           * l’animation du jeu ne commence
           * pendant la sortie du buffering.
           */
          await wait(300);

          return;
        }

        if (
          attempt ===
          maximumAttempts
        ) {
          throw new Error(
            "Spotify reçoit la commande, mais le son ne démarre pas."
          );
        }
      } catch (error) {
        if (
          requestId !==
          playbackRequestRef.current
        ) {
          throw new Error(
            "Lecture annulée."
          );
        }

        const canRetry =
          attempt < maximumAttempts;

        if (!canRetry) {
          throw error;
        }

        console.warn(
          `Tentative Spotify ${attempt}/${maximumAttempts} échouée :`,
          error
        );

        if (!isDeviceError(error)) {
          await wait(500);
        }
      }
    }
  }

  async function preparePlayer() {
    stopTimer();

    playbackRequestRef.current += 1;

    const requestId =
      playbackRequestRef.current;

    setErrorMessage("");
    setFeedback("");
    setLoadingMessage(
      "Préparation du lecteur Spotify..."
    );
    setStatus("loading");

    if (tracks.length < 4) {
      setErrorMessage(
        "La playlist doit contenir au moins 4 morceaux."
      );

      setStatus("error");

      return;
    }

    try {
      const { deviceId } =
        await initializeSpotifyPlayer();

      if (
        requestId !==
        playbackRequestRef.current
      ) {
        return;
      }

      deviceIdRef.current =
        deviceId;

      const player =
        getSpotifyPlayer();

      /*
       * Autorise explicitement la lecture
       * audio depuis le clic de l’utilisateur,
       * lorsque le navigateur l’exige.
       */
      if (
        player &&
        typeof player.activateElement ===
          "function"
      ) {
        try {
          await player.activateElement();
        } catch (error) {
          console.warn(
            "Activation audio du navigateur :",
            error
          );
        }
      }

      setLoadingMessage(
        "Activation du lecteur Babidou..."
      );

      await activateBabidouDevice(
        deviceId
      );

      const playableTracks =
        tracks.filter(
          (track) =>
            track?.id &&
            track?.uri &&
            track.uri.startsWith(
              "spotify:track:"
            )
        );

      const selectedTracks =
        shuffle(playableTracks).slice(
          0,
          Math.min(
            Number(settings.rounds) ||
              10,
            playableTracks.length
          )
        );

      if (
        selectedTracks.length < 4
      ) {
        throw new Error(
          "Cette playlist ne contient pas assez de morceaux lisibles."
        );
      }

      gameTracksRef.current =
        selectedTracks;

      setGameTracks(
        selectedTracks
      );

      setCurrentIndex(0);
      setScore(0);
      setCombo(0);
      setBestCombo(0);

      await beginRound(
        selectedTracks,
        0,
        deviceId
      );
    } catch (error) {
      console.error(error);

      if (
        requestId !==
        playbackRequestRef.current
      ) {
        return;
      }

      setErrorMessage(
        getErrorMessage(error) ||
          "Impossible de démarrer Spotify."
      );

      setStatus("error");
    }
  }

  async function beginRound(
    selectedTracks,
    index,
    deviceId =
      deviceIdRef.current
  ) {
    stopTimer();

    playbackRequestRef.current += 1;

    const requestId =
      playbackRequestRef.current;

    const track =
      selectedTracks[index];

    if (!track || !deviceId) {
      setErrorMessage(
        "Le morceau ou le lecteur Spotify est introuvable."
      );

      setStatus("error");

      return;
    }

    setCurrentIndex(index);
    setSelectedId(null);
    setFeedback("");

    setAnswers(
      createAnswers(
        track,
        tracks
      )
    );

    setTimeLeft(roundDuration);

    setLoadingMessage(
      "Lancement du morceau..."
    );

    setStatus("loading");
    setErrorMessage("");

    try {
      await playTrackAndWait(
        track,
        deviceId,
        requestId
      );

      if (
        !mountedRef.current ||
        requestId !==
          playbackRequestRef.current
      ) {
        return;
      }

      setStatus("playing");
      startTimer();
    } catch (error) {
      console.error(error);

      if (
        requestId !==
        playbackRequestRef.current
      ) {
        return;
      }

      setErrorMessage(
        getErrorMessage(error) ||
          "Impossible de lire ce morceau."
      );

      setStatus("error");
    }
  }

  async function retryCurrentRound() {
    const selectedTracks =
      gameTracksRef.current;

    if (
      selectedTracks.length === 0
    ) {
      await preparePlayer();
      return;
    }

    await beginRound(
      selectedTracks,
      currentIndex
    );
  }

  async function chooseAnswer(
    answer
  ) {
    if (
      status !== "playing" ||
      selectedId !== null
    ) {
      return;
    }

    stopTimer();
    playbackRequestRef.current += 1;

    setSelectedId(answer.id);
    setStatus("reveal");

    await pauseSpotifyPlayer().catch(
      () => {}
    );

    const isCorrect =
      answer.id ===
      currentTrack.id;

    if (isCorrect) {
      const newCombo =
        combo + 1;

      const comboMultiplier =
        Math.min(newCombo, 5);

      const timeBonus =
        timeLeft * 10;

      const roundPoints =
        100 +
        timeBonus +
        comboMultiplier * 25;

      setCombo(newCombo);

      setBestCombo(
        (previousBest) =>
          Math.max(
            previousBest,
            newCombo
          )
      );

      setScore(
        (previousScore) =>
          previousScore +
          roundPoints
      );

      setFeedback(
        `✅ Bonne réponse ! +${roundPoints} points`
      );
    } else {
      setCombo(0);

      setFeedback(
        "❌ Mauvaise réponse !"
      );
    }
  }

  async function nextRound() {
    const nextIndex =
      currentIndex + 1;

    if (
      nextIndex >=
      gameTracksRef.current.length
    ) {
      stopTimer();

      await pauseSpotifyPlayer().catch(
        () => {}
      );

      setStatus("finished");

      return;
    }

    await beginRound(
      gameTracksRef.current,
      nextIndex
    );
  }

  function getAnswerClass(
    answer
  ) {
    if (status !== "reveal") {
      return "answer-card";
    }

    if (
      answer.id ===
      currentTrack.id
    ) {
      return "answer-card answer-correct";
    }

    if (
      answer.id === selectedId
    ) {
      return "answer-card answer-wrong";
    }

    return "answer-card answer-disabled";
  }

  if (status === "finished") {
    return (
      <main className="app">
        <section className="hero game-shell">
          <p className="eyebrow">
            PARTIE TERMINÉE
          </p>

          <div className="finish-icon">
            🏆
          </div>

          <h1>Bravo !</h1>

          <p className="subtitle">
            Ton blind test est terminé.
          </p>

          <div className="final-score-card">
            <span>Score final</span>

            <strong>{score}</strong>

            <small>points</small>
          </div>

          <div className="game-stats">
            <article>
              <strong>
                {gameTracks.length}
              </strong>

              <span>manches</span>
            </article>

            <article>
              <strong>
                ×{bestCombo}
              </strong>

              <span>
                meilleur combo
              </span>
            </article>
          </div>

          <div className="actions">
            <button
              className="btn spotify"
              type="button"
              onClick={preparePlayer}
            >
              🔁 Rejouer
            </button>

            <button
              className="btn primary"
              type="button"
              onClick={() =>
                navigate(
                  "/playlists"
                )
              }
            >
              🎵 Changer de playlist
            </button>

            <button
              className="btn secondary"
              type="button"
              onClick={() =>
                navigate("/")
              }
            >
              Accueil
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <section className="hero game-shell">
        <p className="eyebrow">
          {settings.gameName}
        </p>

        <h1>Blind Test</h1>

        {status === "waiting" && (
          <div className="start-game-card">
            <div className="start-game-icon">
              🎧
            </div>

            <p>
              Active le lecteur Spotify
              pour commencer la partie.
            </p>

            <button
              className="btn spotify"
              type="button"
              onClick={preparePlayer}
            >
              ▶ Activer Spotify et commencer
            </button>
          </div>
        )}

        {status === "loading" && (
          <div className="loading-card">
            <div className="loader" />

            <p>{loadingMessage}</p>

            <small
              style={{
                color: "#a99caf",
              }}
            >
              Le chrono reste arrêté tant que
              le son n’a pas réellement démarré.
            </small>
          </div>
        )}

        {status === "error" &&
          errorMessage && (
            <article className="error-card">
              <strong>
                Problème de lecture Spotify
              </strong>

              <span>
                {errorMessage}
              </span>

              <button
                className="btn spotify"
                type="button"
                onClick={retryCurrentRound}
              >
                Relancer cette manche
              </button>

              <button
                className="btn primary"
                type="button"
                onClick={() =>
                  navigate(
                    "/playlists"
                  )
                }
              >
                Retour aux playlists
              </button>
            </article>
          )}

        {currentTrack &&
          (status === "playing" ||
            status === "reveal") && (
            <>
              <div className="game-topbar">
                <div>
                  <span>Manche</span>

                  <strong>
                    {currentIndex + 1}/
                    {gameTracks.length}
                  </strong>
                </div>

                <div>
                  <span>Score</span>

                  <strong>
                    {score}
                  </strong>
                </div>

                <div>
                  <span>Combo</span>

                  <strong>
                    ×{combo}
                  </strong>
                </div>
              </div>

              <div className="timer-card">
                <div className="timer-header">
                  <strong>
                    ⏱️ {timeLeft}s
                  </strong>

                  <span>
                    {status ===
                    "playing"
                      ? "La musique joue..."
                      : "Réponse"}
                  </span>
                </div>

                <div className="timer-track">
                  <div
                    className="timer-progress"
                    style={{
                      width: `${progressPercent}%`,
                    }}
                  />
                </div>
              </div>

              <h2 className="question-title">
                Quel est le titre du morceau ?
              </h2>

              <div className="answers-grid">
                {answers.map(
                  (answer, index) => (
                    <button
                      key={`${answer.id}-${index}`}
                      type="button"
                      className={getAnswerClass(
                        answer
                      )}
                      onClick={() =>
                        chooseAnswer(
                          answer
                        )
                      }
                      disabled={
                        status !==
                        "playing"
                      }
                    >
                      <span className="answer-letter">
                        {String.fromCharCode(
                          65 + index
                        )}
                      </span>

                      <span className="answer-content">
                        <strong>
                          {answer.name}
                        </strong>

                        {status ===
                          "reveal" && (
                          <small>
                            {
                              answer.artists
                            }
                          </small>
                        )}
                      </span>
                    </button>
                  )
                )}
              </div>

              {status === "reveal" && (
                <div className="reveal-card">
                  <div
                    className={
                      selectedId ===
                      currentTrack.id
                        ? "feedback feedback-good"
                        : "feedback feedback-bad"
                    }
                  >
                    {feedback}
                  </div>

                  <div className="track-reveal">
                    {currentTrack.image && (
                      <img
                        src={
                          currentTrack.image
                        }
                        alt={
                          currentTrack.album ||
                          currentTrack.name
                        }
                      />
                    )}

                    <div>
                      <span>
                        La bonne réponse était
                      </span>

                      <h2>
                        {currentTrack.name}
                      </h2>

                      <p>
                        {currentTrack.artists}
                      </p>
                    </div>
                  </div>

                  <button
                    className="btn spotify"
                    type="button"
                    onClick={nextRound}
                  >
                    {currentIndex + 1 >=
                    gameTracks.length
                      ? "Voir mon score"
                      : "Manche suivante →"}
                  </button>
                </div>
              )}
            </>
          )}
      </section>
    </main>
  );
}