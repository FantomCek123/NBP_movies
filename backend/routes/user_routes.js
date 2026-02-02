import express from "express";
const router = express.Router();

import * as userController from "../controllers/user_controller.js";

router.post("/register", userController.registerUser);
router.post("/login", userController.loginUser);

export default router;
