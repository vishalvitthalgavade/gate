import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const AuthContext = createContext(null);

/*
====================================================
API BASE URL
====================================================
*/

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

const ACCESS_TOKEN_KEY = "gate-access-token";
const USER_KEY = "gate-user";

/*
====================================================
BUILD API URL
====================================================
*/

function buildApiUrl(path) {
  if (
    path.startsWith("http://") ||
    path.startsWith("https://")
  ) {
    return path;
  }

  const cleanPath = path.startsWith("/")
    ? path
    : `/${path}`;

  return `${API_BASE_URL}${cleanPath}`;
}

/*
====================================================
SAFE STORAGE HELPERS
====================================================

Using helper functions prevents the application
from crashing if localStorage is temporarily
unavailable.
====================================================
*/

function getStoredUser() {
  try {
    const user = localStorage.getItem(USER_KEY);

    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.warn("Unable to read stored user:", error);
    return null;
  }
}

function getStoredToken() {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.warn("Unable to read stored token:", error);
    return null;
  }
}

/*
====================================================
AUTH PROVIDER
====================================================
*/

export function AuthProvider({ children }) {
  /*
  IMPORTANT:

  Restore authentication directly from localStorage
  when the PWA starts.

  This means closing and reopening the installed
  application does NOT automatically log the user out.
  */

  const [user, setUser] = useState(() => {
    return getStoredUser();
  });

  const [accessToken, setAccessToken] = useState(() => {
    return getStoredToken();
  });

  /*
  If user/token already exist locally, the application
  can immediately continue using the cached session.

  This prevents the login screen from appearing briefly
  every time the PWA is reopened.
  */

  const [isLoading, setIsLoading] = useState(() => {
    return !getStoredUser() && !getStoredToken();
  });

  /*
  Prevent multiple simultaneous refresh requests.
  */

  const refreshPromiseRef = useRef(null);

  /*
  Prevent the initial authentication initialization
  from running multiple times.
  */

  const initializedRef = useRef(false);

  /*
====================================================
SAVE AUTH DATA
====================================================
*/

  function saveAuth(data) {
    if (data?.accessToken) {
      setAccessToken(data.accessToken);

      try {
        localStorage.setItem(
          ACCESS_TOKEN_KEY,
          data.accessToken
        );
      } catch (error) {
        console.warn(
          "Unable to save access token:",
          error
        );
      }
    }

    if (data?.user) {
      setUser(data.user);

      try {
        localStorage.setItem(
          USER_KEY,
          JSON.stringify(data.user)
        );
      } catch (error) {
        console.warn(
          "Unable to save user:",
          error
        );
      }
    }
  }

  /*
====================================================
CLEAR AUTH
====================================================

Only call this when authentication is genuinely
invalid or the user explicitly logs out.

Do NOT call this merely because the application
cannot reach the server temporarily.
====================================================
*/

  function clearAuth() {
    setUser(null);
    setAccessToken(null);

    try {
      localStorage.removeItem(
        ACCESS_TOKEN_KEY
      );

      localStorage.removeItem(USER_KEY);
    } catch (error) {
      console.warn(
        "Unable to clear local authentication:",
        error
      );
    }
  }

  /*
====================================================
REFRESH SESSION
====================================================

The refresh token is stored inside an HttpOnly
cookie by the backend.

JavaScript cannot read that cookie.

The browser sends it through:

credentials: "include"
====================================================
*/

  async function refreshSession({
    clearOnInvalid = true,
  } = {}) {
    /*
    Reuse an existing refresh request instead of
    creating multiple refresh requests.
    */

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current =
      (async () => {
        try {
          const response = await fetch(
            buildApiUrl("/auth/refresh"),
            {
              method: "POST",

              /*
              Sends the HttpOnly refresh cookie.
              */

              credentials: "include",

              headers: {
                Accept: "application/json",
              },
            }
          );

          /*
          A 401/403 means the refresh session is
          genuinely invalid.

          During normal API usage we clear authentication.

          During startup we can preserve cached login
          so a temporary cookie/network problem does
          not throw the user back to Login.
          */

          if (
            response.status === 401 ||
            response.status === 403
          ) {
            if (clearOnInvalid) {
              clearAuth();
            }

            return false;
          }

          /*
          Server error.

          IMPORTANT:
          Do NOT delete the locally cached login.
          */

          if (!response.ok) {
            console.warn(
              "Refresh request failed:",
              response.status
            );

            return Boolean(
              getStoredUser() ||
              getStoredToken()
            );
          }

          const data =
            await response.json();

          /*
          If backend says refresh failed,
          preserve cached authentication during
          startup instead of immediately logging out.
          */

          if (!data?.success) {
            if (clearOnInvalid) {
              return false;
            }

            return Boolean(
              getStoredUser() ||
              getStoredToken()
            );
          }

          /*
          Refresh succeeded.
          Save the new access token and user.
          */

          saveAuth(data);

          return true;
        } catch (error) {
          /*
          Network unavailable.

          IMPORTANT:

          Do NOT destroy the cached authentication.

          This is especially important for an installed
          PWA because the application may start before
          the network connection is available.
          */

          console.warn(
            "Refresh unavailable:",
            error?.message
          );

          return Boolean(
            getStoredUser() ||
            getStoredToken()
          );
        } finally {
          refreshPromiseRef.current = null;
        }
      })();

    return refreshPromiseRef.current;
  }

  /*
====================================================
INITIAL AUTH CHECK
====================================================

This is the most important change.

We restore local authentication first.

We DO NOT immediately delete the local session if
the refresh cookie is unavailable.

If an access token exists, the user can continue
using the application.

If the token later expires, authFetch() will perform
a refresh automatically.
====================================================
*/

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    let mounted = true;

    async function initializeAuth() {
      const storedUser = getStoredUser();
      const storedToken = getStoredToken();

      /*
      ------------------------------------------------
      CASE 1:
      Cached authentication exists.

      Restore it immediately.

      Do NOT force a refresh just because the PWA
      was reopened.
      ------------------------------------------------
      */

      if (storedUser || storedToken) {
        if (mounted) {
          setUser(storedUser);
          setAccessToken(storedToken);
          setIsLoading(false);
        }

        /*
        -----------------------------------------------
        OPTIONAL BACKGROUND REFRESH

        Try refreshing silently.

        But NEVER clear the cached authentication
        simply because this background refresh fails.

        This is important for installed PWA behavior.
        -----------------------------------------------
        */

        if (navigator.onLine) {
          refreshSession({
            clearOnInvalid: false,
          }).catch((error) => {
            console.warn(
              "Background session refresh failed:",
              error
            );
          });
        }

        return;
      }

      /*
      ------------------------------------------------
      CASE 2:
      No cached login exists.

      Try to recover a session from the backend
      refresh cookie.
      ------------------------------------------------
      */

      if (navigator.onLine) {
        await refreshSession({
          clearOnInvalid: true,
        });
      }

      if (mounted) {
        setIsLoading(false);
      }
    }

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  /*
====================================================
SIGNUP
====================================================
*/

  async function signup(
    name,
    email,
    password
  ) {
    const response = await fetch(
      buildApiUrl("/auth/signup"),
      {
        method: "POST",

        credentials: "include",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        body: JSON.stringify({
          name,
          email,
          password,
        }),
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.message ||
          "Signup failed."
      );
    }

    /*
    Save login locally after successful signup.
    */

    saveAuth(data);

    return data;
  }

  /*
====================================================
LOGIN
====================================================
*/

  async function login(
    email,
    password
  ) {
    const response = await fetch(
      buildApiUrl("/auth/login"),
      {
        method: "POST",

        credentials: "include",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        body: JSON.stringify({
          email,
          password,
        }),
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.message ||
          "Login failed."
      );
    }

    /*
    IMPORTANT:

    Save the access token and user immediately.

    They survive closing/reopening the PWA.
    */

    saveAuth(data);

    return data;
  }

  /*
====================================================
LOGOUT
====================================================
*/

  async function logout() {
    try {
      await fetch(
        buildApiUrl("/auth/logout"),
        {
          method: "POST",

          /*
          Sends refresh cookie so backend can revoke
          the authentication session.
          */

          credentials: "include",

          headers: {
            Accept: "application/json",
          },
        }
      );
    } catch (error) {
      /*
      Local logout must still happen if the device
      is offline.
      */

      console.warn(
        "Logout request unavailable:",
        error?.message
      );
    }

    /*
    Explicit logout is the ONLY normal action that
    should definitely remove the local login.
    */

    clearAuth();
  }

  /*
====================================================
AUTHENTICATED FETCH
====================================================
*/

  async function authFetch(
    url,
    options = {}
  ) {
    let token =
      accessToken ||
      getStoredToken();

    /*
    Build complete API URL.
    */

    const fullUrl =
      buildApiUrl(url);

    /*
    ------------------------------------------------
    REQUEST FUNCTION
    ------------------------------------------------
    */

    async function makeRequest(
      currentToken
    ) {
      const headers =
        new Headers(
          options.headers || {}
        );

      /*
      Add access token.
      */

      if (currentToken) {
        headers.set(
          "Authorization",
          `Bearer ${currentToken}`
        );
      }

      /*
      Automatically add JSON content type when
      a request body exists.
      */

      if (
        options.body &&
        !headers.has("Content-Type")
      ) {
        headers.set(
          "Content-Type",
          "application/json"
        );
      }

      headers.set(
        "Accept",
        "application/json"
      );

      return fetch(
        fullUrl,
        {
          ...options,
          headers,

          /*
          Required for HttpOnly refresh cookie.
          */

          credentials: "include",
        }
      );
    }

    /*
    ------------------------------------------------
    FIRST REQUEST
    ------------------------------------------------
    */

    let response =
      await makeRequest(token);

    /*
    ------------------------------------------------
    ACCESS TOKEN EXPIRED
    ------------------------------------------------

    If backend returns 401, attempt to refresh the
    access token.

    ------------------------------------------------
    */

    if (response.status === 401) {
      const refreshed =
        await refreshSession({
          clearOnInvalid: true,
        });

      if (refreshed) {
        token =
          getStoredToken();

        response =
          await makeRequest(token);
      }
    }

    return response;
  }

  /*
====================================================
ONLINE EVENT
====================================================

When internet connection returns, silently refresh
the access token.

Do not log the user out just because refresh fails.
====================================================
*/

  useEffect(() => {
    async function handleOnline() {
      const hasCachedAuth =
        Boolean(
          getStoredUser() ||
          getStoredToken()
        );

      if (!hasCachedAuth) {
        return;
      }

      await refreshSession({
        clearOnInvalid: false,
      });
    }

    window.addEventListener(
      "online",
      handleOnline
    );

    return () => {
      window.removeEventListener(
        "online",
        handleOnline
      );
    };
  }, []);

  /*
====================================================
CONTEXT VALUE
====================================================
*/

  const value = {
    user,

    accessToken,

    isLoading,

    isAuthenticated:
      Boolean(user),

    signup,

    login,

    logout,

    refreshSession,

    authFetch,
  };

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

/*
====================================================
USE AUTH
====================================================
*/

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}