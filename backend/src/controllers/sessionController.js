const prisma = require("../config/prisma");

/*
====================================================
HELPERS
====================================================
*/

function getUserId(req) {
  return req.user?.userId;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function normalizeSeconds(value) {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  return Math.round(seconds);
}


/*
====================================================
CREATE STUDY SESSION
====================================================
*/

async function createSession(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required.",
      });
    }

    const {
      clientId,
      subject,
      topic,
      duration,
      type,
      startedAt,
      completedAt,
    } = req.body;

    /*
    --------------------------------------------------
    VALIDATION
    --------------------------------------------------
    */

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "clientId is required.",
      });
    }

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "Subject is required.",
      });
    }

    if (!topic) {
      return res.status(400).json({
        success: false,
        message: "Topic is required.",
      });
    }

    const numericDuration = Number(duration);

    if (
      !Number.isFinite(numericDuration) ||
      numericDuration <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Duration must be a positive number.",
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Session type is required.",
      });
    }

    /*
    --------------------------------------------------
    IDEMPOTENCY / DUPLICATE CHECK
    --------------------------------------------------
    */

    const existing =
      await prisma.studySession.findUnique({
        where: {
          clientId,
        },
      });

    if (existing) {
      if (existing.userId !== userId) {
        return res.status(403).json({
          success: false,
          message:
            "This session belongs to another user.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Session already synchronized.",
        session: existing,
      });
    }

    /*
    --------------------------------------------------
    CREATE DATABASE RECORD
    --------------------------------------------------
    */

    const session =
      await prisma.studySession.create({
        data: {
          clientId,

          userId,

          subject: String(subject),
          topic: String(topic),

          duration: Math.round(
            numericDuration
          ),

          type: String(type),

          startedAt: parseDate(startedAt),

          completedAt: parseDate(completedAt),
        },
      });

    console.log(
      `Study session created: ${session.id} | user: ${userId}`
    );

    return res.status(201).json({
      success: true,
      message: "Study session saved successfully.",
      session,
    });
  } catch (error) {
    console.error(
      "CREATE SESSION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to save study session.",
      error:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.message,
    });
  }
}


/*
====================================================
GET USER SESSIONS
====================================================
*/

async function getSessions(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required.",
      });
    }

    const sessions =
      await prisma.studySession.findMany({
        where: {
          userId,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return res.json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error(
      "GET SESSIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to retrieve study sessions.",
    });
  }
}


/*
====================================================
START ACTIVE STUDY
====================================================

Creates a new active timer.

IMPORTANT:
Only ONE active timer is allowed per user.

If the same user is already running a timer on
another browser/device, this endpoint returns 409.

A paused timer also prevents creation of a new
separate timer. The user must resume or stop it.

This DOES NOT create a StudySession.

StudySession is created only when the timer is
actually saved/completed.
====================================================
*/

async function startActiveStudy(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required.",
      });
    }

    const {
      subject,
      topic,
      type,
      accumulatedSeconds,
    } = req.body;

    const seconds =
      normalizeSeconds(accumulatedSeconds);

    if (seconds === null) {
      return res.status(400).json({
        success: false,
        message:
          "accumulatedSeconds must be a valid non-negative number.",
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Study type is required.",
      });
    }

    /*
    --------------------------------------------------
    CHECK EXISTING ACTIVE TIMER
    --------------------------------------------------

    DO NOT use upsert here.

    An upsert would allow another browser/device
    to overwrite the user's existing timer.
    --------------------------------------------------
    */

    const existing =
      await prisma.activeStudySession.findUnique({
        where: {
          userId,
        },
      });

    /*
    --------------------------------------------------
    TIMER ALREADY RUNNING
    --------------------------------------------------
    */

    if (existing && existing.isRunning) {
      return res.status(409).json({
        success: false,

        code:
          "TIMER_ALREADY_RUNNING",

        message:
          "A timer is already running on another device or browser.",

        activeStudy: {
          subject: existing.subject,
          topic: existing.topic,
          type: existing.type,

          accumulatedSeconds:
            existing.accumulatedSeconds,

          startedAt:
            existing.startedAt,

          lastHeartbeatAt:
            existing.lastHeartbeatAt,
        },
      });
    }

    /*
    --------------------------------------------------
    TIMER EXISTS BUT IS PAUSED
    --------------------------------------------------
    */

    if (existing && !existing.isRunning) {
      return res.status(409).json({
        success: false,

        code:
          "TIMER_ALREADY_EXISTS",

        message:
          "You already have a paused timer. Resume it or stop it before starting a new timer.",

        activeStudy: {
          subject: existing.subject,
          topic: existing.topic,
          type: existing.type,

          accumulatedSeconds:
            existing.accumulatedSeconds,

          startedAt:
            existing.startedAt,

          pausedAt:
            existing.pausedAt,
        },
      });
    }

    /*
    --------------------------------------------------
    NO EXISTING TIMER
    --------------------------------------------------
    */

    const now = new Date();

    const activeStudy =
      await prisma.activeStudySession.create({
        data: {
          userId,

          subject:
            String(subject || "No subject"),

          topic:
            String(topic || "No topic"),

          type:
            String(type),

          startedAt:
            now,

          accumulatedSeconds:
            seconds,

          isRunning:
            true,

          lastHeartbeatAt:
            now,
        },
      });

    return res.json({
      success: true,

      message:
        "Active study started.",

      activeStudy,
    });
  } catch (error) {
    console.error(
      "START ACTIVE STUDY ERROR:",
      error
    );

    /*
    --------------------------------------------------
    UNIQUE CONSTRAINT PROTECTION
    --------------------------------------------------

    userId is @unique in ActiveStudySession.

    If two start requests arrive at almost exactly
    the same time, Prisma's unique constraint prevents
    two active rows from being created.
    --------------------------------------------------
    */

    if (error?.code === "P2002") {
      return res.status(409).json({
        success: false,

        code:
          "TIMER_ALREADY_RUNNING",

        message:
          "A timer is already running on another device or browser.",
      });
    }

    return res.status(500).json({
      success: false,

      message:
        "Failed to start active study.",

      error:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.message,
    });
  }
}


/*
====================================================
GET ACTIVE STUDY
====================================================

Returns the current user's active timer.

This is used when the Timer page opens on another
browser/device.

Example:

Device A:
    Timer running

Device B:
    GET /api/sessions/active

Device B receives the existing active timer.
====================================================
*/

async function getActiveStudy(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required.",
      });
    }

    const activeStudy =
      await prisma.activeStudySession.findUnique({
        where: {
          userId,
        },
      });

    return res.json({
      success: true,

      activeStudy:
        activeStudy || null,
    });
  } catch (error) {
    console.error(
      "GET ACTIVE STUDY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to retrieve active study.",

      error:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.message,
    });
  }
}


/*
====================================================
ACTIVE STUDY HEARTBEAT
====================================================

Called periodically while the timer is running.

The frontend sends the latest elapsed seconds.

This keeps the leaderboard updated and also lets
the backend know that the browser/device is still
actively running the timer.
====================================================
*/

async function heartbeatActiveStudy(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required.",
      });
    }

    const {
      subject,
      topic,
      type,
      accumulatedSeconds,
    } = req.body;

    const seconds =
      normalizeSeconds(accumulatedSeconds);

    if (seconds === null) {
      return res.status(400).json({
        success: false,
        message:
          "accumulatedSeconds must be a valid non-negative number.",
      });
    }

    const existing =
      await prisma.activeStudySession.findUnique({
        where: {
          userId,
        },
      });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message:
          "No active study session found.",
      });
    }

    const activeStudy =
      await prisma.activeStudySession.update({
        where: {
          userId,
        },

        data: {
          subject:
            String(
              subject ||
                existing.subject ||
                "No subject"
            ),

          topic:
            String(
              topic ||
                existing.topic ||
                "No topic"
            ),

          type:
            String(
              type ||
                existing.type
            ),

          accumulatedSeconds:
            seconds,

          isRunning:
            true,

          pausedAt:
            null,

          lastHeartbeatAt:
            new Date(),
        },
      });

    return res.json({
      success: true,
      activeStudy,
    });
  } catch (error) {
    console.error(
      "ACTIVE STUDY HEARTBEAT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update active study.",
    });
  }
}


/*
====================================================
PAUSE ACTIVE STUDY
====================================================

The active record remains in the database.

isRunning becomes false.

Paused time is NOT counted by the leaderboard.

The timer can later be resumed.
====================================================
*/

async function pauseActiveStudy(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required.",
      });
    }

    const {
      accumulatedSeconds,
    } = req.body;

    const seconds =
      normalizeSeconds(accumulatedSeconds);

    if (seconds === null) {
      return res.status(400).json({
        success: false,
        message:
          "accumulatedSeconds must be a valid non-negative number.",
      });
    }

    const existing =
      await prisma.activeStudySession.findUnique({
        where: {
          userId,
        },
      });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message:
          "No active study session found.",
      });
    }

    const activeStudy =
      await prisma.activeStudySession.update({
        where: {
          userId,
        },

        data: {
          accumulatedSeconds:
            seconds,

          isRunning:
            false,

          pausedAt:
            new Date(),

          lastHeartbeatAt:
            new Date(),
        },
      });

    return res.json({
      success: true,
      message:
        "Study paused.",
      activeStudy,
    });
  } catch (error) {
    console.error(
      "PAUSE ACTIVE STUDY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to pause active study.",
    });
  }
}


/*
====================================================
RESUME ACTIVE STUDY
====================================================

Resumes the user's existing paused timer.

It does NOT create another timer.
====================================================
*/

async function resumeActiveStudy(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required.",
      });
    }

    const existing =
      await prisma.activeStudySession.findUnique({
        where: {
          userId,
        },
      });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message:
          "No saved active study session found.",
      });
    }

    const activeStudy =
      await prisma.activeStudySession.update({
        where: {
          userId,
        },

        data: {
          isRunning:
            true,

          pausedAt:
            null,

          lastHeartbeatAt:
            new Date(),
        },
      });

    return res.json({
      success: true,
      message:
        "Study resumed.",
      activeStudy,
    });
  } catch (error) {
    console.error(
      "RESUME ACTIVE STUDY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to resume active study.",
    });
  }
}


/*
====================================================
STOP ACTIVE STUDY
====================================================

Removes the active timer completely.

The frontend should save the final StudySession
separately through:

POST /api/sessions

This endpoint is used when the user stops/resets
the timer or after the timer is saved.
====================================================
*/

async function stopActiveStudy(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required.",
      });
    }

    const deleted =
      await prisma.activeStudySession.deleteMany({
        where: {
          userId,
        },
      });

    return res.json({
      success: true,

      message:
        "Active study stopped.",

      deletedCount:
        deleted.count,
    });
  } catch (error) {
    console.error(
      "STOP ACTIVE STUDY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to stop active study.",
    });
  }
}


/*
====================================================
GET STUDY LEADERBOARD
====================================================

GET /api/sessions/leaderboard?date=today
GET /api/sessions/leaderboard?date=yesterday

Returns every registered user ranked by total
study time for the selected day.

Study time is returned in seconds.

TODAY:
    completed StudySession time
    +
    currently running ActiveStudySession time

YESTERDAY:
    completed StudySession time only

Active timers are counted only when their heartbeat
is recent.
====================================================
*/

async function getLeaderboard(req, res) {
  try {
    const currentUserId =
      getUserId(req);

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message:
          "User authentication required.",
      });
    }

    /*
    --------------------------------------------------
    SELECT DAY
    --------------------------------------------------
    */

    const selectedDate =
      req.query.date === "yesterday"
        ? "yesterday"
        : "today";

    /*
    --------------------------------------------------
    DATE RANGE
    --------------------------------------------------
    */

    const now = new Date();

    const startOfToday =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

    let startDate;

    if (
      selectedDate === "yesterday"
    ) {
      startDate =
        new Date(startOfToday);

      startDate.setDate(
        startDate.getDate() - 1
      );
    } else {
      startDate =
        new Date(startOfToday);
    }

    const endDate =
      new Date(startDate);

    endDate.setDate(
      endDate.getDate() + 1
    );

    /*
    --------------------------------------------------
    GET ALL USERS
    --------------------------------------------------
    */

    const users =
      await prisma.user.findMany({
        select: {
          id: true,
          name: true,
        },

        orderBy: {
          name: "asc",
        },
      });

    /*
    --------------------------------------------------
    GET COMPLETED STUDY SESSIONS
    --------------------------------------------------
    */

    const sessions =
      await prisma.studySession.findMany({
        where: {
          OR: [
            {
              completedAt: {
                gte: startDate,
                lt: endDate,
              },
            },

            /*
            ------------------------------------------
            Fallback for older records that don't
            have completedAt.
            ------------------------------------------
            */

            {
              completedAt: null,

              createdAt: {
                gte: startDate,
                lt: endDate,
              },
            },
          ],
        },

        select: {
          userId: true,
          duration: true,
        },
      });

    /*
    --------------------------------------------------
    TOTAL COMPLETED STUDY TIME PER USER
    --------------------------------------------------
    */

    const studyTimeByUser =
      new Map();

    for (
      const session of sessions
    ) {
      const previousTime =
        studyTimeByUser.get(
          session.userId
        ) || 0;

      studyTimeByUser.set(
        session.userId,
        previousTime +
          Number(
            session.duration || 0
          )
      );
    }

    /*
    --------------------------------------------------
    ACTIVE STUDY
    --------------------------------------------------

    Only TODAY can contain active study.

    A heartbeat is considered fresh for 45 seconds.

    This prevents an abandoned browser tab from
    remaining on the leaderboard forever.
    --------------------------------------------------
    */

    if (
      selectedDate === "today"
    ) {
      const heartbeatCutoff =
        new Date(
          now.getTime() -
            45 * 1000
        );

      const activeStudies =
        await prisma.activeStudySession.findMany({
          where: {
            isRunning: true,

            lastHeartbeatAt: {
              gte: heartbeatCutoff,
            },

            startedAt: {
              lt: endDate,
            },
          },

          select: {
            userId: true,
            accumulatedSeconds: true,
            startedAt: true,
          },
        });

      /*
      ----------------------------------------------
      ADD CURRENTLY RUNNING TIME
      ----------------------------------------------
      */

      for (
        const active of activeStudies
      ) {
        let activeSeconds =
          Number(
            active.accumulatedSeconds || 0
          );

        /*
        --------------------------------------------
        Timer started today.

        Its accumulated seconds are fully counted.
        --------------------------------------------
        */

        if (
          active.startedAt >=
          startDate
        ) {
          // Nothing else required.
        } else {
          /*
          ------------------------------------------
          Timer crossed midnight.

          Conservatively count only the amount
          that could have accumulated since today's
          beginning.
          ------------------------------------------
          */

          const secondsSinceStartOfToday =
            Math.max(
              0,

              Math.floor(
                (
                  now.getTime() -
                  startDate.getTime()
                ) / 1000
              )
            );

          activeSeconds =
            Math.min(
              activeSeconds,
              secondsSinceStartOfToday
            );
        }

        const previousTime =
          studyTimeByUser.get(
            active.userId
          ) || 0;

        studyTimeByUser.set(
          active.userId,

          previousTime +
            activeSeconds
        );
      }
    }

    /*
    --------------------------------------------------
    BUILD LEADERBOARD
    --------------------------------------------------
    */

    const leaderboard =
      users.map((user) => ({
        userId:
          user.id,

        name:
          user.name,

        studyTime:
          studyTimeByUser.get(
            user.id
          ) || 0,

        isCurrentUser:
          user.id === currentUserId,
      }));

    /*
    --------------------------------------------------
    SORT
    --------------------------------------------------

    Highest study time first.

    Equal study time:
    alphabetical order.
    --------------------------------------------------
    */

    leaderboard.sort(
      (a, b) => {
        if (
          b.studyTime !==
          a.studyTime
        ) {
          return (
            b.studyTime -
            a.studyTime
          );
        }

        return a.name.localeCompare(
          b.name
        );
      }
    );

    /*
    --------------------------------------------------
    ADD RANK
    --------------------------------------------------
    */

    const rankedLeaderboard =
      leaderboard.map(
        (user, index) => ({
          rank:
            index + 1,

          ...user,
        })
      );

    /*
    --------------------------------------------------
    RESPONSE
    --------------------------------------------------
    */

    return res.json({
      success: true,

      date:
        selectedDate,

      startDate:
        startDate.toISOString(),

      endDate:
        endDate.toISOString(),

      leaderboard:
        rankedLeaderboard,
    });
  } catch (error) {
    console.error(
      "GET LEADERBOARD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to retrieve study leaderboard.",

      error:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.message,
    });
  }
}


/*
====================================================
DELETE ONE SESSION
====================================================
*/

async function deleteSession(req, res) {
  try {
    const userId =
      getUserId(req);

    const { id } =
      req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "User authentication required.",
      });
    }

    const session =
      await prisma.studySession.findUnique({
        where: {
          id,
        },
      });

    if (!session) {
      return res.status(404).json({
        success: false,
        message:
          "Session not found.",
      });
    }

    if (
      session.userId !==
      userId
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot delete another user's session.",
      });
    }

    await prisma.studySession.delete({
      where: {
        id,
      },
    });

    return res.json({
      success: true,
      message:
        "Study session deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE SESSION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete study session.",
    });
  }
}


/*
====================================================
DELETE ALL USER SESSIONS
====================================================
*/

async function deleteAllSessions(req, res) {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "User authentication required.",
      });
    }

    const result =
      await prisma.studySession.deleteMany({
        where: {
          userId,
        },
      });

    return res.json({
      success: true,

      message:
        "All study sessions deleted successfully.",

      deletedCount:
        result.count,
    });
  } catch (error) {
    console.error(
      "DELETE ALL SESSIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete study sessions.",
    });
  }
}


/*
====================================================
EXPORTS
====================================================
*/

module.exports = {
  createSession,
  getSessions,

  startActiveStudy,
  getActiveStudy,
  heartbeatActiveStudy,
  pauseActiveStudy,
  resumeActiveStudy,
  stopActiveStudy,

  getLeaderboard,

  deleteSession,
  deleteAllSessions,
};