// backend/server.js
import express from "express";
import cors from "cors";

import { logger } from "./middlewares/logger.js";
import { errorHandler } from "./middlewares/errorHandler.js";

import userRouter from "./routes/user_routes.js";
import movieRouter from "./routes/movie_routes.js";

const app = express();

app.use(cors());
app.use(express.json());

// Middleware
app.use(logger);

// Routes
app.use("/movies", movieRouter);
app.use("/users", userRouter);

// Error handler IDE POSLEDNJI
app.use(errorHandler);

// Pokretanje servera
app.listen(3000, () => {
    console.log("Server radi na http://localhost:3000");
});
