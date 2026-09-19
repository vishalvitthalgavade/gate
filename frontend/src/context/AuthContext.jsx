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
SESSION SETTINGS
====================================================
*/

// Refresh the session every 10 minutes while the app
// is open. Your access token currently lasts 15 minutes.
const SESSION_REFRESH_INTERVAL = 10 * 60 * 1000;

// If the user returns to the app after being away for
// this amount of time, immediately refresh the session.
const IDLE_REFRESH_THRESHOLD = 5 * 60 * 1000;

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
*/

function getStoredUser() {
  try {
    const user = localStorage.getItem(USER_KEY);

    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.warn(
      "Unable to read stored user:",
      error
    );

    return null;
  }
}

function getStoredToken() {
  try {
    return localStorage.getItem(
      ACCESS_TOKEN_KEY
    );
  } catch (error) {
    console.warn(
      "Unable to read stored token:",
      error
    );

    return null;
  }
}

/*
====================================================
AUTH PROVIDER
====================================================
*/

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    return getStoredUser();
  });

  const [accessToken, setAccessToken] = useState(
    () => {
      return getStoredToken();
    }
  );

  const [isLoading, setIsLoading] = useState(() => {
    return (
      !getStoredUser() &&
      !getStoredToken()
    );
  });

  /*
  Prevent multiple refresh requests from running
  simultaneously.
  */
  const refreshPromiseRef = useRef(null);

  /*
  Used for initial authentication setup.
  */
  const initializedRef = useRef(false);

  /*
  Track when the app was last active.
  */
  const lastActivityRef = useRef(Date.now());

  /*
  Track refresh interval.
  */
  const refreshIntervalRef = useRef(null);

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
*/

  function clearAuth() {
    setUser(null);
    setAccessToken(null);

    try {
      localStorage.removeItem(
        ACCESS_TOKEN_KEY
      );

      localStorage.removeItem(
        USER_KEY
      );
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
*/

  async function refreshSession({
    clearOnInvalid = true,
  } = {}) {
    /*
    If another refresh is already running,
    wait for that same request.
    */
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current =
      (async () => {
        try {
          /*
          No refresh request when browser is offline.
          */
          if (!navigator.onLine) {
            return Boolean(
              getStoredUser() ||
              getStoredToken()
            );
          }

          const response = await fetch(
            buildApiUrl(
              "/auth/refresh"
            ),
            {
              method: "POST",

              /*
              IMPORTANT:
              Send refresh cookie.
              */
              credentials: "include",

              headers: {
                Accept:
                  "application/json",
              },
            }
          );

          /*
          Refresh session is genuinely invalid.

          Only clear local login when the server
          explicitly says the refresh session is
          unauthorized/forbidden.
          */
          if (
            response.status === 401 ||
            response.status === 403
          ) {
            console.warn(
              "Refresh session is invalid or expired."
            );

            if (clearOnInvalid) {
              clearAuth();
            }

            return false;
          }

          /*
          Temporary server error.

          Do NOT log the user out.
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
          Backend returned JSON but did not
          confirm success.
          */
          if (!data?.success) {
            console.warn(
              "Refresh response was unsuccessful."
            );

            /*
            Do not clear cached authentication
            for a non-explicit failure.
            */
            return Boolean(
              getStoredUser() ||
              getStoredToken()
            );
          }

          /*
          Save the newly rotated access token
          and updated user.
          */
          saveAuth(data);

          /*
          Reset activity timestamp.
          */
          lastActivityRef.current =
            Date.now();

          return true;
        } catch (error) {
          /*
          Network failure should NOT log the
          user out.

          The cached login remains available
          until the server explicitly rejects
          the refresh session.
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
          refreshPromiseRef.current =
            null;
        }
      })();

    return refreshPromiseRef.current;
  }

/*
====================================================
INITIAL AUTH CHECK
====================================================
*/

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    let mounted = true;

    async function initializeAuth() {
      const storedUser =
        getStoredUser();

      const storedToken =
        getStoredToken();

      /*
      If cached login exists, immediately
      restore it.

      This makes the PWA reopen quickly.
      */
      if (
        storedUser ||
        storedToken
      ) {
        if (mounted) {
          setUser(storedUser);
          setAccessToken(storedToken);
          setIsLoading(false);
        }

        /*
        Validate/refresh in background.
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
      No cached authentication.

      Try the refresh cookie.
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
      buildApiUrl(
        "/auth/signup"
      ),
      {
        method: "POST",

        credentials: "include",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",
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

    saveAuth(data);

    lastActivityRef.current =
      Date.now();

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
      buildApiUrl(
        "/auth/login"
      ),
      {
        method: "POST",

        credentials: "include",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",
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

    saveAuth(data);

    lastActivityRef.current =
      Date.now();

    return data;
  }

/*
====================================================
UPDATE PROFILE
====================================================
*/

  async function updateProfile(name) {
    const response =
      await authFetch(
        "/auth/profile",
        {
          method: "PUT",

          body: JSON.stringify({
            name,
          }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.message ||
          "Could not update profile."
      );
    }

    if (data?.user) {
      saveAuth({
        user: data.user,
      });
    }

    return data;
  }

/*
====================================================
CHANGE PASSWORD
====================================================
*/

  async function changePassword(
    currentPassword,
    newPassword
  ) {
    const response =
      await authFetch(
        "/auth/change-password",
        {
          method: "PUT",

          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.message ||
          "Could not change password."
      );
    }

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
        buildApiUrl(
          "/auth/logout"
        ),
        {
          method: "POST",

          credentials: "include",

          headers: {
            Accept:
              "application/json",
          },
        }
      );
    } catch (error) {
      console.warn(
        "Logout request unavailable:",
        error?.message
      );
    }

    /*
    Explicit logout always clears
    local authentication.
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

    const fullUrl =
      buildApiUrl(url);

    async function makeRequest(
      currentToken
    ) {
      const headers =
        new Headers(
          options.headers || {}
        );

      if (currentToken) {
        headers.set(
          "Authorization",
          `Bearer ${currentToken}`
        );
      }

      if (
        options.body &&
        !headers.has(
          "Content-Type"
        )
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
          Required for refresh cookie
          and authenticated API requests.
          */
          credentials: "include",
        }
      );
    }

    /*
    First request using current access token.
    */
    let response =
      await makeRequest(token);

    /*
    Access token expired.

    Try refresh instead of immediately
    logging the user out.
    */
    if (
      response.status === 401
    ) {
      const refreshed =
        await refreshSession({
          clearOnInvalid: true,
        });

      if (refreshed) {
        token =
          getStoredToken();

        /*
        Retry original request
        with the new access token.
        */
        response =
          await makeRequest(
            token
          );
      }
    }

    /*
    Record activity whenever an
    authenticated request is made.
    */
    lastActivityRef.current =
      Date.now();

    return response;
  }

/*
====================================================
PROACTIVE SESSION REFRESH
====================================================

The access token expires after 15 minutes.

Instead of waiting for an API request to fail,
refresh it every 10 minutes.

This prevents the user from being logged out
after simply sitting on the dashboard.
====================================================
*/

  useEffect(() => {
    async function proactiveRefresh() {
      const hasCachedAuth =
        Boolean(
          getStoredUser() ||
          getStoredToken()
        );

      if (!hasCachedAuth) {
        return;
      }

      if (!navigator.onLine) {
        return;
      }

      /*
      Do not refresh if the tab is hidden.

      The visibility handler will refresh
      immediately when the user returns.
      */
      if (
        document.visibilityState !==
        "visible"
      ) {
        return;
      }

      await refreshSession({
        clearOnInvalid: true,
      });
    }

    /*
    Run every 10 minutes.
    */
    refreshIntervalRef.current =
      window.setInterval(
        proactiveRefresh,
        SESSION_REFRESH_INTERVAL
      );

    return () => {
      if (
        refreshIntervalRef.current
      ) {
        window.clearInterval(
          refreshIntervalRef.current
        );

        refreshIntervalRef.current =
          null;
      }
    };
  }, []);

/*
====================================================
VISIBILITY / TAB RETURN HANDLER
====================================================

When the user leaves the app for a while and
comes back, refresh the session immediately.

This is especially important for:

- PWA
- Mobile
- Browser tab switching
- Laptop sleep/wake
====================================================
*/

  useEffect(() => {
    async function handleVisibilityChange() {
      if (
        document.visibilityState !==
        "visible"
      ) {
        return;
      }

      const now =
        Date.now();

      const timeAway =
        now -
        lastActivityRef.current;

      /*
      If user was away for more than
      5 minutes, refresh immediately.
      */
      if (
        timeAway >=
        IDLE_REFRESH_THRESHOLD
      ) {
        const hasCachedAuth =
          Boolean(
            getStoredUser() ||
            getStoredToken()
          );

        if (
          hasCachedAuth &&
          navigator.onLine
        ) {
          await refreshSession({
            clearOnInvalid: true,
          });
        }
      }

      lastActivityRef.current =
        now;
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

/*
====================================================
WINDOW FOCUS HANDLER
====================================================

Useful when the PWA/browser regains focus
without triggering visibilitychange.
====================================================
*/

  useEffect(() => {
    async function handleFocus() {
      const now =
        Date.now();

      const timeAway =
        now -
        lastActivityRef.current;

      if (
        timeAway >=
        IDLE_REFRESH_THRESHOLD
      ) {
        const hasCachedAuth =
          Boolean(
            getStoredUser() ||
            getStoredToken()
          );

        if (
          hasCachedAuth &&
          navigator.onLine
        ) {
          await refreshSession({
            clearOnInvalid: true,
          });
        }
      }

      lastActivityRef.current =
        now;
    }

    window.addEventListener(
      "focus",
      handleFocus
    );

    return () => {
      window.removeEventListener(
        "focus",
        handleFocus
      );
    };
  }, []);

/*
====================================================
ONLINE EVENT
====================================================

When internet connection comes back,
refresh the session.
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
        clearOnInvalid: true,
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

    updateProfile,

    changePassword,
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