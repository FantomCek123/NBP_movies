// backend/routes/movie_routes.js
import express from "express";
const router = express.Router();

import * as controllerMovie from "../controllers/movie_controller.js"; // obavezno .js ekstenzija

router.get("/top/:type", controllerMovie.getTopMovies);

router.get("/search", controllerMovie.searchMoviesByTitle);
router.get("/user/:username/added-movies", controllerMovie.getAddedMovies);
router.get("/:username/:id/has-watched", controllerMovie.hasWatchedMovie);

router.get("/:username/recommended", controllerMovie.getRecommendedMovies);

router.post("/", controllerMovie.saveMovie);
router.post("/:username/:id/view", controllerMovie.addView);
router.post("/:username/:id/like", controllerMovie.addLike);
router.post("/:username/:id/rate", controllerMovie.addRate);

router.put("/:id", controllerMovie.updateMovie);
router.get("/:id", controllerMovie.readMovie); 

export default router;
