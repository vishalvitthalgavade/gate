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
  const [user, setUser] = useState(() => {
    return getStoredUser();
  });

  const [accessToken, setAccessToken] = useState(() => {
    return getStoredToken();
  });

  const [isLoading, setIsLoading] = useState(() => {
    return !getStoredUser() && !getStoredToken();
  });

  const refreshPromiseRef = useRef(null);

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
*/

  async function refreshSession({
    clearOnInvalid = true,
  } = {}) {
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
              credentials: "include",

              headers: {
                Accept: "application/json",
              },
            }
          );

          if (
            response.status === 401 ||
            response.status === 403
          ) {
            if (clearOnInvalid) {
              clearAuth();
            }

            return false;
          }

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

          if (!data?.success) {
            if (clearOnInvalid) {
              return false;
            }

            return Boolean(
              getStoredUser() ||
              getStoredToken()
            );
          }

          saveAuth(data);

          return true;
        } catch (error) {
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

      if (storedUser || storedToken) {
        if (mounted) {
          setUser(storedUser);
          setAccessToken(storedToken);
          setIsLoading(false);
        }

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

    saveAuth(data);

    return data;
  }

/*
====================================================
UPDATE PROFILE
====================================================

Updates the user's NAME only.

The email address is intentionally not sent,
so the email remains read-only.
====================================================
*/

  async function updateProfile(name) {
    const response = await authFetch(
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

    /*
    Backend returns the updated user.

    Save it locally so:
    - Settings page updates
    - Sidebar updates immediately
    - PWA retains the new name
    */

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

Requires:
- Current password
- New password

The backend verifies the current password.
====================================================
*/

  async function changePassword(
    currentPassword,
    newPassword
  ) {
    const response = await authFetch(
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
        buildApiUrl("/auth/logout"),
        {
          method: "POST",
          credentials: "include",

          headers: {
            Accept: "application/json",
          },
        }
      );
    } catch (error) {
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
          credentials: "include",
        }
      );
    }

    let response =
      await makeRequest(token);

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

    /*
    Profile / Security
    */
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