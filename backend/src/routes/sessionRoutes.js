const express = require("express");

const {
  createSession,
  getSessions,
  deleteSession,
  deleteAllSessions,
} = require("../controllers/sessionController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


/*
====================================================
ALL SESSION ROUTES REQUIRE LOGIN
====================================================
*/

router.use(authMiddleware);


/*
POST /api/sessions
*/
router.post("/", createSession);


/*
GET /api/sessions
*/
router.get("/", getSessions);


/*
DELETE /api/sessions
*/
router.delete("/", deleteAllSessions);


/*
DELETE /api/sessions/:id
*/
router.delete("/:id", deleteSession);


module.exports = router;