const cassandra = require("cassandra-driver");
const cassClient = require("../config/cassandra");
const redisClient = require("../config/redis");
const { v4: uuidv4 } = require("uuid");

const saveMovie = async (req, res) => {
    const { title, year, director, genres } = req.body;

    if (!title || !year) {
        return res.status(400).send("Popuni barem title i year");
    }

    const id = cassandra.types.Uuid.fromString(uuidv4());

    try {
        await cassClient.execute(
            `INSERT INTO movies (id, title, year, director, genres)
             VALUES (?, ?, ?, ?, ?)`,
            [id, title, parseInt(year), director, genres],
            { prepare: true }
        );

        await cassClient.execute(
            `INSERT INTO movie_statistics
             (movie_id, likes, views, rating_sum, rating_count, average_rating)
             VALUES (?, 0, 0, 0, 0, 0)`,
            [id],
            { prepare: true }
        );

        res.status(201).json({ id, title, year, director, genres });
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri dodavanju filma");
    }
};

const readMovie = async (req, res) => {
    try {
        const movieId = cassandra.types.Uuid.fromString(req.params.id);

        // Redis cache
        const cached = await redisClient.get(req.params.id);
        if (cached) {
            return res.json({ source: "redis", ...JSON.parse(cached) });
        }

        const movieRes = await cassClient.execute(
            "SELECT * FROM movies WHERE id = ?",
            [movieId],
            { prepare: true }
        );

        if (movieRes.rows.length === 0) {
            return res.status(404).send("Film ne postoji");
        }

        const statsRes = await cassClient.execute(
            `SELECT likes, views, average_rating
             FROM movie_statistics WHERE movie_id = ?`,
            [movieId],
            { prepare: true }
        );

        const movie = {
            ...movieRes.rows[0],
            ...statsRes.rows[0]
        };

        await redisClient.set(req.params.id, JSON.stringify(movie), { EX: 3600 });

        res.json({ source: "cassandra", ...movie });
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri čitanju filma");
    }
};

const addView = async (req, res) => {
    try {
        const movieId = cassandra.types.Uuid.fromString(req.params.id);

        const result = await cassClient.execute(
            'SELECT views FROM movie_statistics WHERE movie_id = ?',
            [movieId],
            { prepare: true }
        );

        if (result.rows.length === 0) {
            return res.status(404).send("Film nije pronađen");
        }

        const currentViews = result.rows[0].views || 0;

        const newViews = currentViews + 1;

        await cassClient.execute(
            'UPDATE movie_statistics SET views = ? WHERE movie_id = ?',
            [newViews, movieId],
            { prepare: true }
        );

        await redisClient.del(req.params.id);

        res.json({ success: true, views: newViews });
    } catch (err) {
        console.error("AddView error:", err);
        res.status(500).send("Greška pri dodavanju pregleda");
    }
};


const addLike = async (req, res) => {
    try {
        const movieId = cassandra.types.Uuid.fromString(req.params.id);

        const result = await cassClient.execute(
            'SELECT likes, views, rating_sum, rating_count, average_rating FROM movie_statistics WHERE movie_id = ?',
            [movieId],
            { prepare: true }
        );

        if (result.rows.length === 0) {
            return res.status(404).send("Film nije pronađen");
        }

        const stats = result.rows[0];
        const newLikes = (stats.likes || 0) + 1;
        const newViews = (stats.views || 0) + 1;

        await cassClient.execute(
            'UPDATE movie_statistics SET likes = ?, views = ? WHERE movie_id = ?',
            [newLikes, newViews, movieId],
            { prepare: true }
        );

  
        await redisClient.del(req.params.id);

        res.json({
            success: true,
            likes: newLikes,
            views: newViews,
            rating_sum: stats.rating_sum,
            rating_count: stats.rating_count,
            average_rating: stats.average_rating
        });
    } catch (err) {
        console.error("AddLike error:", err);
        res.status(500).send("Greška pri lajkovanju");
    }
};



const addRate = async (req, res) => {
    try {
        const movieId = cassandra.types.Uuid.fromString(req.params.id);
        const rating = Number(req.body.rating);

        const result = await cassClient.execute(
            'SELECT rating_sum, rating_count, views, likes, average_rating FROM movie_statistics WHERE movie_id = ?',
            [movieId],
            { prepare: true }
        );

        if (result.rows.length === 0) {
            return res.status(404).send("Film nije pronađen");
        }

        const stats = result.rows[0];

        const newSum = (stats.rating_sum || 0) + rating;
        const newCount = (stats.rating_count || 0) + 1;
        const avg = newSum / newCount;
        const newViews = (stats.views || 0) + 1;


        await cassClient.execute(
            'UPDATE movie_statistics SET rating_sum = ?, rating_count = ?, average_rating = ?, views = ? WHERE movie_id = ?',
            [newSum, newCount, avg, newViews, movieId],
            { prepare: true }
        );

        await redisClient.del(req.params.id);

        res.json({
            success: true,
            rating_sum: newSum,
            rating_count: newCount,
            average_rating: avg,
            views: newViews
        });
    } catch (err) {
        console.error("AddRate error:", err);
        res.status(500).send("Greška pri ocenjivanju");
    }
};


/* =============================
   EXPORT
============================= */
module.exports = {
    saveMovie,
    readMovie,
    addView,
    addLike,
    addRate
};
