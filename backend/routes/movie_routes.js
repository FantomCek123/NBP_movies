const express = require("express");
const router = express.Router();

const controllerMovie = require("../controllers/movie_controller");

router.post("/", controllerMovie.saveMovie);
router.get("/:id", controllerMovie.readMovie);
router.post("/:id/view", controllerMovie.addView);
router.post("/:id/like", controllerMovie.addLike);
router.post("/:id/rate", controllerMovie.addRate);


module.exports = router;
