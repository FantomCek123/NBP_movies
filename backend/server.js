const express = require("express");
const cors = require("cors");

const { logger } = require("./middlewares/logger");
const { errorHandler } = require("./middlewares/errorHandler");


const userRouter = require("./routes/user_routes");
const movieRouter = require("./routes/movie_routes");


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
