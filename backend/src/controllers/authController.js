const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const prisma = require("../config/prisma");

const REFRESH_COOKIE_NAME = "gate_refresh_token";

const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_DAYS = 30;

/*
====================================================
HELPERS
====================================================
*/

function createAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    }
  );
}

function createRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

function hashRefreshToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function getRefreshExpiry() {
  const expiry = new Date();

  expiry.setDate(
    expiry.getDate() + REFRESH_TOKEN_DAYS
  );

  return expiry;
}

function setRefreshCookie(res, refreshToken) {
  res.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    {
      httpOnly: true,

      /*
        Local development:
        http://localhost:5173
        →
        http://localhost:5000
      */

      sameSite: "lax",

      secure:
        process.env.NODE_ENV ===
        "production",

      maxAge:
        REFRESH_TOKEN_DAYS *
        24 *
        60 *
        60 *
        1000,

      path: "/api/auth",
    }
  );
}

function clearRefreshCookie(res) {
  res.clearCookie(
    REFRESH_COOKIE_NAME,
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: "/api/auth",
    }
  );
}

/*
====================================================
SIGNUP
====================================================
*/

async function signup(req, res) {
  try {
    const {
      name,
      email,
      password,
    } = req.body;

    if (
      !name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email and password are required.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const existingUser =
      await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists.",
      });
    }

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    const user =
      await prisma.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,

          pomodoroSettings: {
            create: {
              study: 25,
              shortBreak: 5,
              longBreak: 15,
              sessionsBeforeLongBreak: 4,
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      });

    /*
      Create ONE refresh session for
      this login/device.
    */

    const refreshToken =
      createRefreshToken();

    const tokenHash =
      hashRefreshToken(
        refreshToken
      );

    await prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt:
          getRefreshExpiry(),
      },
    });

    setRefreshCookie(
      res,
      refreshToken
    );

    const accessToken =
      createAccessToken(user);

    return res.status(201).json({
      success: true,
      accessToken,
      user,
    });
  } catch (error) {
    console.error(
      "Signup error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong during signup.",
    });
  }
}

/*
====================================================
LOGIN
====================================================
*/

async function login(req, res) {
  try {
    const {
      email,
      password,
    } = req.body;

    if (
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const user =
      await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password.",
      });
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password.",
      });
    }

    /*
      Create a new refresh session for
      this login/device.

      Existing sessions remain valid.
      This allows multiple devices.
    */

    const refreshToken =
      createRefreshToken();

    const tokenHash =
      hashRefreshToken(
        refreshToken
      );

    await prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt:
          getRefreshExpiry(),
      },
    });

    setRefreshCookie(
      res,
      refreshToken
    );

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };

    const accessToken =
      createAccessToken(
        safeUser
      );

    return res.json({
      success: true,
      accessToken,
      user: safeUser,
    });
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong during login.",
    });
  }
}

/*
====================================================
REFRESH
====================================================

IMPORTANT:

We DO NOT create another AuthSession row.

Instead:

existing refresh session
        ↓
verify token hash
        ↓
generate new refresh token
        ↓
UPDATE same AuthSession
        ↓
send new cookie
        ↓
new access token
====================================================
*/

async function refresh(req, res) {
  try {
    const refreshToken =
      req.cookies?.[
        REFRESH_COOKIE_NAME
      ];

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message:
          "Refresh token missing.",
      });
    }

    const tokenHash =
      hashRefreshToken(
        refreshToken
      );

    const authSession =
      await prisma.authSession.findUnique(
        {
          where: {
            tokenHash,
          },

          include: {
            user: true,
          },
        }
      );

    if (!authSession) {
      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message:
          "Invalid refresh session.",
      });
    }

    /*
      Check whether session was revoked.
    */

    if (authSession.revokedAt) {
      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message:
          "Refresh session has been revoked.",
      });
    }

    /*
      Check expiration.
    */

    if (
      new Date() >
      authSession.expiresAt
    ) {
      await prisma.authSession.update({
        where: {
          id: authSession.id,
        },

        data: {
          revokedAt:
            new Date(),
        },
      });

      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message:
          "Refresh session expired.",
      });
    }

    const user =
      authSession.user;

    /*
      Generate a NEW refresh token.
    */

    const newRefreshToken =
      createRefreshToken();

    const newTokenHash =
      hashRefreshToken(
        newRefreshToken
      );

    /*
      UPDATE THE SAME DATABASE ROW.

      No new AuthSession entry.
    */

    await prisma.authSession.update({
      where: {
        id: authSession.id,
      },

      data: {
        tokenHash:
          newTokenHash,

        expiresAt:
          getRefreshExpiry(),

        revokedAt: null,
      },
    });

    /*
      Replace browser cookie.
    */

    setRefreshCookie(
      res,
      newRefreshToken
    );

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };

    const accessToken =
      createAccessToken(
        safeUser
      );

    return res.json({
      success: true,
      accessToken,
      user: safeUser,
    });
  } catch (error) {
    console.error(
      "Refresh error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Could not refresh authentication session.",
    });
  }
}

/*
====================================================
LOGOUT
====================================================
*/

async function logout(req, res) {
  try {
    const refreshToken =
      req.cookies?.[
        REFRESH_COOKIE_NAME
      ];

    if (refreshToken) {
      const tokenHash =
        hashRefreshToken(
          refreshToken
        );

      await prisma.authSession.updateMany(
        {
          where: {
            tokenHash,
          },

          data: {
            revokedAt:
              new Date(),
          },
        }
      );
    }

    clearRefreshCookie(res);

    return res.json({
      success: true,
      message:
        "Logged out successfully.",
    });
  } catch (error) {
    console.error(
      "Logout error:",
      error
    );

    clearRefreshCookie(res);

    return res.json({
      success: true,
      message:
        "Logged out locally.",
    });
  }
}

/*
====================================================
CURRENT USER
====================================================
*/

async function me(req, res) {
  try {
    const user =
      await prisma.user.findUnique({
        where: {
          id: req.user.userId,
        },

        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found.",
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(
      "Me error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Could not retrieve user.",
    });
  }
}

module.exports = {
  signup,
  login,
  refresh,
  logout,
  me,
};