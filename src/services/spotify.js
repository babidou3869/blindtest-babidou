const CLIENT_ID =
  "4bf36b39663c4261bfa910891bc80ea9";

const PRODUCTION_REDIRECT_URI =
  "https://babidou.vercel.app/callback";

const LOCAL_REDIRECT_URI =
  "http://127.0.0.1:5173/callback";

function getRedirectUri() {
  const isProduction =
    window.location.hostname ===
    "babidou.vercel.app";

  return isProduction
    ? PRODUCTION_REDIRECT_URI
    : LOCAL_REDIRECT_URI;
}

const SCOPES = [
  "user-read-private",
  "user-read-email",
  "playlist-read-private",
  "playlist-read-collaborative",
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
];

const TOKEN_KEY =
  "babidou_spotify_token";

const VERIFIER_KEY =
  "babidou_code_verifier";

const STATE_KEY =
  "babidou_oauth_state";

function generateRandomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  const values =
    crypto.getRandomValues(
      new Uint8Array(length)
    );

  return values.reduce(
    (result, value) =>
      result +
      characters[
        value % characters.length
      ],
    ""
  );
}

async function sha256(value) {
  const encoder =
    new TextEncoder();

  const data =
    encoder.encode(value);

  return crypto.subtle.digest(
    "SHA-256",
    data
  );
}

function base64UrlEncode(buffer) {
  return btoa(
    String.fromCharCode(
      ...new Uint8Array(buffer)
    )
  )
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function loginSpotify() {
  const redirectUri =
    getRedirectUri();

  const codeVerifier =
    generateRandomString(64);

  const hashedVerifier =
    await sha256(codeVerifier);

  const codeChallenge =
    base64UrlEncode(
      hashedVerifier
    );

  const state =
    generateRandomString(32);

  localStorage.removeItem(
    VERIFIER_KEY
  );

  localStorage.removeItem(
    STATE_KEY
  );

  localStorage.setItem(
    VERIFIER_KEY,
    codeVerifier
  );

  localStorage.setItem(
    STATE_KEY,
    state
  );

  const authorizationUrl =
    new URL(
      "https://accounts.spotify.com/authorize"
    );

  authorizationUrl.search =
    new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: SCOPES.join(" "),
      code_challenge_method:
        "S256",
      code_challenge:
        codeChallenge,
      state,
      show_dialog: "true",
    }).toString();

  window.location.assign(
    authorizationUrl.toString()
  );
}

export async function exchangeCodeForToken(
  code,
  returnedState
) {
  const redirectUri =
    getRedirectUri();

  const codeVerifier =
    localStorage.getItem(
      VERIFIER_KEY
    );

  const expectedState =
    localStorage.getItem(
      STATE_KEY
    );

  if (!codeVerifier) {
    throw new Error(
      "Code de sécurité Spotify introuvable. Recommence la connexion depuis l’accueil."
    );
  }

  if (!returnedState) {
    throw new Error(
      "Spotify n’a pas renvoyé le code de vérification."
    );
  }

  if (
    returnedState !== expectedState
  ) {
    localStorage.removeItem(
      VERIFIER_KEY
    );

    localStorage.removeItem(
      STATE_KEY
    );

    throw new Error(
      "La connexion Spotify a expiré. Retourne à l’accueil et reconnecte-toi une seule fois."
    );
  }

  const response =
    await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type:
              "authorization_code",
            code,
            redirect_uri:
              redirectUri,
            code_verifier:
              codeVerifier,
          }),
      }
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Spotify a refusé la connexion : ${errorText}`
    );
  }

  const tokenData =
    await response.json();

  saveToken(tokenData);

  localStorage.removeItem(
    VERIFIER_KEY
  );

  localStorage.removeItem(
    STATE_KEY
  );

  return tokenData;
}

function saveToken(tokenData) {
  const currentToken =
    getStoredToken() || {};

  const completeToken = {
    ...currentToken,
    ...tokenData,

    expires_at:
      Date.now() +
      tokenData.expires_in *
        1000,
  };

  localStorage.setItem(
    TOKEN_KEY,
    JSON.stringify(
      completeToken
    )
  );
}

export function getStoredToken() {
  const storedToken =
    localStorage.getItem(
      TOKEN_KEY
    );

  if (!storedToken) {
    return null;
  }

  try {
    return JSON.parse(
      storedToken
    );
  } catch {
    localStorage.removeItem(
      TOKEN_KEY
    );

    return null;
  }
}

async function refreshAccessToken() {
  const currentToken =
    getStoredToken();

  if (
    !currentToken?.refresh_token
  ) {
    logoutSpotify();

    throw new Error(
      "La session Spotify a expiré."
    );
  }

  const response =
    await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type:
              "refresh_token",
            refresh_token:
              currentToken.refresh_token,
          }),
      }
    );

  if (!response.ok) {
    logoutSpotify();

    throw new Error(
      "Impossible de renouveler la session Spotify."
    );
  }

  const refreshedToken =
    await response.json();

  saveToken({
    ...refreshedToken,

    refresh_token:
      refreshedToken.refresh_token ||
      currentToken.refresh_token,
  });

  return getStoredToken()
    .access_token;
}

export async function getAccessToken() {
  const token =
    getStoredToken();

  if (!token?.access_token) {
    return null;
  }

  const expiresSoon =
    Date.now() >=
    token.expires_at -
      60_000;

  if (expiresSoon) {
    return refreshAccessToken();
  }

  return token.access_token;
}

export function isSpotifyConnected() {
  return Boolean(
    getStoredToken()
      ?.access_token
  );
}

export function logoutSpotify() {
  localStorage.removeItem(
    TOKEN_KEY
  );

  localStorage.removeItem(
    VERIFIER_KEY
  );

  localStorage.removeItem(
    STATE_KEY
  );
}

export async function spotifyApi(
  endpoint,
  options = {}
) {
  const accessToken =
    await getAccessToken();

  if (!accessToken) {
    throw new Error(
      "Tu dois d’abord te connecter à Spotify."
    );
  }

  const response =
    await fetch(
      `https://api.spotify.com/v1${endpoint}`,
      {
        ...options,

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",

          ...options.headers,
        },
      }
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Erreur Spotify ${response.status} : ${errorText}`
    );
  }

  if (
    response.status === 204
  ) {
    return null;
  }

  return response.json();
}