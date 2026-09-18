import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const AuthContext = createContext(null);

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const ACCESS_TOKEN_KEY = "gate-access-token";
const USER_KEY = "gate-user";

/*
====================================================
LOCAL USER
====================================================
*/

function getStoredUser() {
  try {
    const user = localStorage.getItem(USER_KEY);

    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

/*
====================================================
AUTH PROVIDER
====================================================
*/

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);

  const [accessToken, setAccessToken] = useState(
    () =>
      localStorage.getItem(
        ACCESS_TOKEN_KEY
      )
  );

  const [isLoading, setIsLoading] =
    useState(true);

  /*
    Prevent multiple simultaneous refresh
    requests.
  */
  const refreshPromiseRef = useRef(null);

  /*
====================================================
SAVE AUTH DATA
====================================================
*/

  function saveAuth(data) {
    if (data?.accessToken) {
      setAccessToken(data.accessToken);

      localStorage.setItem(
        ACCESS_TOKEN_KEY,
        data.accessToken
      );
    }

    if (data?.user) {
      setUser(data.user);

      localStorage.setItem(
        USER_KEY,
        JSON.stringify(data.user)
      );
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

    localStorage.removeItem(
      ACCESS_TOKEN_KEY
    );

    localStorage.removeItem(USER_KEY);
  }

  /*
====================================================
REFRESH SESSION
====================================================

  The refresh token is stored in an
  HttpOnly cookie by the backend.

  JavaScript cannot read the cookie.
  The browser sends it automatically because
  credentials: "include" is used.
====================================================
*/

  async function refreshSession() {
    /*
      If another refresh request is already
      running, reuse it.
    */

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current =
      (async () => {
        try {
          const response =
            await fetch(
              `${API_BASE_URL}/auth/refresh`,
              {
                method: "POST",

                /*
                  VERY IMPORTANT:
                  sends the HttpOnly refresh cookie.
                */
                credentials: "include",

                headers: {
                  Accept:
                    "application/json",
                },
              }
            );

          /*
            401/403 means the refresh session
            is actually invalid or expired.

            In this case it is appropriate to
            log the user out.
          */
          if (
            response.status === 401 ||
            response.status === 403
          ) {
            clearAuth();

            return false;
          }

          /*
            Server error / temporary problem.

            Do NOT destroy the cached login.
          */
          if (!response.ok) {
            console.warn(
              "Refresh request failed:",
              response.status
            );

            return Boolean(
              localStorage.getItem(USER_KEY)
            );
          }

          const data =
            await response.json();

          if (!data?.success) {
            /*
              Don't immediately log out for a
              malformed/temporary response.
            */
            return Boolean(
              localStorage.getItem(USER_KEY)
            );
          }

          saveAuth(data);

          return true;
        } catch (error) {
          /*
            Network unavailable.

            Keep cached authentication so the
            offline-first tracker continues working.
          */

          console.warn(
            "Refresh unavailable:",
            error?.message
          );

          return Boolean(
            localStorage.getItem(USER_KEY)
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
    let mounted = true;

    async function initializeAuth() {
      /*
        If offline, use cached authentication.
      */

      if (!navigator.onLine) {
        if (mounted) {
          setIsLoading(false);
        }

        return;
      }

      /*
        Try the HttpOnly refresh cookie.
      */

      await refreshSession();

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
      `${API_BASE_URL}/auth/signup`,
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
      `${API_BASE_URL}/auth/login`,
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
        `${API_BASE_URL}/auth/logout`,
        {
          method: "POST",

          /*
            Sends refresh cookie so backend
            can revoke the AuthSession.
          */
          credentials: "include",

          headers: {
            Accept:
              "application/json",
          },
        }
      );
    } catch (error) {
      /*
        Local logout still happens if offline.
      */

      console.warn(
        "Logout request unavailable:",
        error?.message
      );
    }

    clearAuth();
  }

  /*
====================================================
AUTHENTICATED FETCH
====================================================
*/

 async function authFetch(url, options = {}) {
  let token =
    accessToken ||
    localStorage.getItem(
      ACCESS_TOKEN_KEY
    );

  /*
  ====================================================
  BUILD API URL
  ====================================================

  StudyContext uses:

      authFetch("/sessions")

  We convert that into:

      http://localhost:5000/api/sessions

  In production, VITE_API_URL will be used.
  */

  const fullUrl =
    url.startsWith("http://") ||
    url.startsWith("https://")
      ? url
      : `${API_BASE_URL}${
          url.startsWith("/")
            ? url
            : `/${url}`
        }`;

  async function makeRequest(
    currentToken
  ) {
    const headers = new Headers(
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

    return fetch(fullUrl, {
      ...options,
      headers,

      /*
        Sends the HttpOnly refresh cookie.
      */
      credentials: "include",
    });
  }

  /*
  ====================================================
  FIRST REQUEST
  ====================================================
  */

  let response =
    await makeRequest(token);

  /*
  ====================================================
  ACCESS TOKEN EXPIRED
  ====================================================
  */

  if (response.status === 401) {
    const refreshed =
      await refreshSession();

    if (refreshed) {
      token =
        localStorage.getItem(
          ACCESS_TOKEN_KEY
        );

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

  When internet returns, refresh the access
  token using the HttpOnly cookie.
====================================================
*/

  useEffect(() => {
    async function handleOnline() {
      await refreshSession();
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