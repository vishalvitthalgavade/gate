import { Router } from "express";
import { register, login, getMe, logout } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

export const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/logout", logout);
authRouter.get("/me", authenticate, getMe);
