import { getAccessToken } from "./spotify";

let spotifyPlayer = null;
let playerDeviceId = null;
let sdkPromise = null;
let initializationPromise = null;

function loadSpotifySdk() {
  if (window.Spotify) {
    return Promise.resolve();
  }

  if (sdkPromise) {
    return sdkPromise;
  }

  sdkPromise = new Promise((resolve, reject) => {
    const previousCallback =
      window.onSpotifyWebPlaybackSDKReady;

    window.onSpotifyWebPlaybackSDKReady = () => {
      if (typeof previousCallback === "function") {
        previousCallback();
      }

      resolve();
    };

    const existingScript = document.querySelector(
      'script[src="https://sdk.scdn.co/spotify-player.js"]'
    );

    if (existingScript) {
      const checkSdk = window.setInterval(() => {
        if (window.Spotify) {
          window.clearInterval(checkSdk);
          resolve();
        }
      }, 100);

      window.setTimeout(() => {
        window.clearInterval(checkSdk);

        if (!window.Spotify) {
          reject(
            new Error(
              "Le lecteur Spotify n’a pas pu être chargé."
            )
          );
        }
      }, 10000);

      return;
    }

    const script = document.createElement("script");

    script.src =
      "https://sdk.scdn.co/spotify-player.js";
    script.async = true;

    script.onerror = () => {
      reject(
        new Error(
          "Impossible de charger le lecteur Spotify."
        )
      );
    };

    document.body.appendChild(script);
  });

  return sdkPromise;
}

async function createSpotifyPlayer() {
  await loadSpotifySdk();

  if (!window.Spotify?.Player) {
    throw new Error(
      "Le lecteur Spotify est indisponible."
    );
  }

  return new Promise((resolve, reject) => {
    let completed = false;

    const fail = (message) => {
      if (completed) {
        return;
      }

      completed = true;
      initializationPromise = null;

      reject(new Error(message));
    };

    spotifyPlayer = new window.Spotify.Player({
      name: "Babidou",
      volume: 0.8,

      getOAuthToken: async (callback) => {
        try {
          const token = await getAccessToken();

          if (!token) {
            fail(
              "La connexion Spotify est introuvable."
            );
            return;
          }

          callback(token);
        } catch (error) {
          fail(
            error.message ||
              "Impossible de récupérer le jeton Spotify."
          );
        }
      },
    });

    spotifyPlayer.addListener(
      "initialization_error",
      ({ message }) => {
        fail(`Initialisation Spotify : ${message}`);
      }
    );

    spotifyPlayer.addListener(
      "authentication_error",
      ({ message }) => {
        fail(`Authentification Spotify : ${message}`);
      }
    );

    spotifyPlayer.addListener(
      "account_error",
      ({ message }) => {
        fail(
          `Spotify Premium est nécessaire : ${message}`
        );
      }
    );

    spotifyPlayer.addListener(
      "playback_error",
      ({ message }) => {
        console.error(
          "Erreur de lecture Spotify :",
          message
        );
      }
    );

    spotifyPlayer.addListener(
      "ready",
      async ({ device_id }) => {
        if (completed) {
          return;
        }

        playerDeviceId = device_id;

        try {
          await spotifyPlayer.activateElement();
        } catch (error) {
          console.warn(
            "Activation du lecteur Spotify :",
            error
          );
        }

        completed = true;

        resolve({
          player: spotifyPlayer,
          deviceId: playerDeviceId,
        });
      }
    );

    spotifyPlayer.addListener(
      "not_ready",
      ({ device_id }) => {
        console.warn(
          "Lecteur Spotify indisponible :",
          device_id
        );

        if (device_id === playerDeviceId) {
          playerDeviceId = null;
        }
      }
    );

    spotifyPlayer
      .connect()
      .then((connected) => {
        if (!connected) {
          fail(
            "Le lecteur Spotify ne s’est pas connecté."
          );
        }
      })
      .catch((error) => {
        fail(
          error.message ||
            "Erreur de connexion au lecteur Spotify."
        );
      });
  });
}

export async function initializeSpotifyPlayer() {
  if (spotifyPlayer && playerDeviceId) {
    try {
      await spotifyPlayer.activateElement();
    } catch (error) {
      console.warn(
        "Réactivation du lecteur Spotify :",
        error
      );
    }

    return {
      player: spotifyPlayer,
      deviceId: playerDeviceId,
    };
  }

  if (!initializationPromise) {
    initializationPromise = createSpotifyPlayer();
  }

  try {
    return await initializationPromise;
  } catch (error) {
    initializationPromise = null;
    throw error;
  }
}

export function getSpotifyPlayer() {
  return spotifyPlayer;
}

export async function pauseSpotifyPlayer() {
  if (!spotifyPlayer) {
    return;
  }

  try {
    await spotifyPlayer.pause();
  } catch (error) {
    console.warn(
      "Impossible de mettre Spotify en pause :",
      error
    );
  }
}

export function disconnectSpotifyPlayer() {
  if (spotifyPlayer) {
    try {
      spotifyPlayer.disconnect();
    } catch (error) {
      console.warn(
        "Déconnexion du lecteur Spotify :",
        error
      );
    }
  }

  spotifyPlayer = null;
  playerDeviceId = null;
  initializationPromise = null;
}