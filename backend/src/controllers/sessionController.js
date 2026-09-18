const prisma = require("../config/prisma");

/*
====================================================
CREATE STUDY SESSION
====================================================
*/

async function createSession(req, res) {
  try {
    const userId = req.user?.userId;

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

    const numericDuration =
      Number(duration);

    if (
      !Number.isFinite(numericDuration) ||
      numericDuration <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Duration must be a positive number.",
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

    clientId is unique.

    If the same offline session is uploaded
    twice, we return the existing session
    instead of creating a duplicate.
    */

    const existing =
      await prisma.studySession.findUnique({
        where: {
          clientId,
        },
      });

    if (existing) {
      /*
        Security check:
        never return another user's session.
      */

      if (existing.userId !== userId) {
        return res.status(403).json({
          success: false,
          message:
            "This session belongs to another user.",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Session already synchronized.",
        session: existing,
      });
    }

    /*
    --------------------------------------------------
    DATE HELPERS
    --------------------------------------------------
    */

    function parseDate(value) {
      if (!value) {
        return null;
      }

      const date = new Date(value);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return null;
      }

      return date;
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

          duration:
            Math.round(
              numericDuration
            ),

          type: String(type),

          startedAt:
            parseDate(startedAt),

          completedAt:
            parseDate(completedAt),
        },
      });

    console.log(
      `Study session created: ${session.id} | user: ${userId}`
    );

    return res.status(201).json({
      success: true,
      message:
        "Study session saved successfully.",
      session,
    });
  } catch (error) {
    console.error(
      "CREATE SESSION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to save study session.",
      error:
        process.env.NODE_ENV ===
        "production"
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
    const userId = req.user?.userId;

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
DELETE ONE SESSION
====================================================
*/

async function deleteSession(req, res) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required.",
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
        message: "Session not found.",
      });
    }

    if (session.userId !== userId) {
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
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required.",
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
      deletedCount: result.count,
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

module.exports = {
  createSession,
  getSessions,
  deleteSession,
  deleteAllSessions,
};