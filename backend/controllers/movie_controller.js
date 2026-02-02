import cassClient from "../config/cassandra.js";
import redisClient from "../config/redis.js";
import { v4 as uuidv4 } from "uuid";
import cassandra from "cassandra-driver";
const updateTopLists = async (movie) => {
    const id = movie.id.toString();

    await redisClient.zAdd("top:rating", {
        score: movie.average_rating || 0,
        value: id
    });

    await redisClient.zAdd("top:likes", {
        score: movie.likes || 0,
        value: id
    });

    await redisClient.zAdd("top:views", {
        score: movie.views || 0,
        value: id
    });

    await redisClient.zRemRangeByRank("top:rating", 0, -11);
    await redisClient.zRemRangeByRank("top:likes", 0, -11);
    await redisClient.zRemRangeByRank("top:views", 0, -11);
};

const saveMovie = async (req, res) => {
    const { title, year, director, genres, username } = req.body;

    if (!title || !year || !username) {
        return res.status(400).send("Nedostaju podaci");
    }

    const id = cassandra.types.Uuid.fromString(uuidv4());

    try {
        await cassClient.execute(
            `INSERT INTO movies (
                id, title, year, director, genres,
                likes, views, rating_sum, rating_count, average_rating
            ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0)`,
            [id, title, parseInt(year), director, genres],
            { prepare: true }
        );

        await updateTopLists({
            id,
            likes: 0,
            views: 0,
            average_rating: 0
        });

        res.status(201).json({ id, title, year, director, genres });
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri dodavanju filma");
    }
};

const readMovie = async (req, res) => {
    try {
        const movieId = cassandra.types.Uuid.fromString(req.params.id);


        const result = await cassClient.execute(
            "SELECT * FROM movies WHERE id = ?",
            [movieId],
            { prepare: true }
        );

        if (!result.rows.length) {
            return res.status(404).send("Film ne postoji");
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri čitanju filma");
    }
};

const addView = async (req, res) => {
    try {
        const movieId = cassandra.types.Uuid.fromString(req.params.id);
        const username = req.params.username;

        const interactionRes = await cassClient.execute(
            `SELECT liked, rating FROM user_movie_interactions 
             WHERE username = ? AND movie_id = ? LIMIT 1`,
            [username, movieId],
            { prepare: true }
        );

        const movieRes = await cassClient.execute(
            `SELECT views, likes, rating_sum, rating_count
             FROM movies WHERE id = ?`,
            [movieId],
            { prepare: true }
        );

        if (movieRes.rows.length === 0) {
            return res.status(404).send("Film nije pronađen");
        }

        const movie = movieRes.rows[0];

        let newViews = movie.views || 0;
        let newLikes = movie.likes || 0;
        let newRatingSum = movie.rating_sum || 0;
        let newRatingCount = movie.rating_count || 0;
        let newAvg = movie.average_rating || 0;

        if (interactionRes.rows.length > 0) {
            const userInter = interactionRes.rows[0];

            newViews = Math.max(newViews - 1, 0);

            if (userInter.liked) {
                newLikes = Math.max(newLikes - 1, 0);
            }

            if (userInter.rating != null) {
                newRatingSum -= userInter.rating;
                newRatingCount = Math.max(newRatingCount - 1, 0);
                newAvg = newRatingCount > 0 ? newRatingSum / newRatingCount : 0;
            }

            await cassClient.execute(
                `UPDATE movies 
                 SET views = ?, likes = ?, rating_sum = ?, rating_count = ?, average_rating = ?
                 WHERE id = ?`,
                [
                    newViews,
                    newLikes,
                    newRatingSum,
                    newRatingCount,
                    newAvg,
                    movieId
                ],
                { prepare: true }
            );

            await cassClient.execute(
                `DELETE FROM user_movie_interactions 
                 WHERE username = ? AND movie_id = ?`,
                [username, movieId],
                { prepare: true }
            );


            return res.json({
                success: true,
                message: "Pregled poništen, lajk i ocena korisnika uklonjeni ako su postojali",
                views: newViews,
                likes: newLikes,
                rating_sum: newRatingSum,
                rating_count: newRatingCount,
                average_rating: newAvg
            });
        }

        await cassClient.execute(
            `INSERT INTO user_movie_interactions (username, movie_id, liked, rating) 
             VALUES (?, ?, ?, ?)`,
            [username, movieId, false, null],
            { prepare: true }
        );

        newViews += 1;

        await cassClient.execute(
            `UPDATE movies SET views = ? WHERE id = ?`,
            [newViews, movieId],
            { prepare: true }
        );


        await updateTopLists({
            id: movieId,
            views: newViews,
            likes: movie.likes,
            average_rating: movie.average_rating
        });

        const prefKey = `user:preferences:${username}`;

       

        res.json({
            success: true,
            message: "Pregled dodat",
            views: newViews
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri dodavanju pregleda");
    }
};
///////////
const addLike = async (req, res) => {
    try {
        const username = req.params.username;
        const movieIdStr = req.params.id;
        const movieUUID = cassandra.types.Uuid.fromString(movieIdStr);

        const { alreadyLiked, movie, newLikes } =
            await toggleLikeCore(username, movieUUID, movieIdStr);

        if (alreadyLiked) {
            await rollbackLikePreferences(username, movie);
        } else {
            await applyLikePreferences(username, movie);
        }

        res.json({
            success: true,
            liked: !alreadyLiked,
            likes: newLikes,
            views: movie.views,
            rating_sum: movie.rating_sum,
            rating_count: movie.rating_count,
            average_rating: movie.average_rating
        });
    } catch (err) {
        if (err.message === "MOVIE_NOT_FOUND") {
            return res.status(404).send("Film nije pronađen");
        }

        console.error("AddLike error:", err);
        res.status(500).send("Greška pri lajkovanju");
    }
};
const toggleLikeCore = async (username, movieUUID, movieIdStr) => {
    const interactionRes = await cassClient.execute(
        `SELECT liked FROM user_movie_interactions
         WHERE username = ? AND movie_id = ? LIMIT 1`,
        [username, movieUUID],
        { prepare: true }
    );

    const alreadyLiked =
        interactionRes.rows.length > 0 &&
        interactionRes.rows[0].liked === true;

    const movieRes = await cassClient.execute(
        `SELECT likes, views, rating_sum, rating_count, average_rating, genres, director
         FROM movies WHERE id = ?`,
        [movieUUID],
        { prepare: true }
    );

    if (movieRes.rows.length === 0) {
        throw new Error("MOVIE_NOT_FOUND");
    }

    const movie = movieRes.rows[0];

    const newLikes = alreadyLiked
        ? Math.max((movie.likes || 0) - 1, 0)
        : (movie.likes || 0) + 1;

    await cassClient.execute(
        `UPDATE movies SET likes = ? WHERE id = ?`,
        [newLikes, movieUUID],
        { prepare: true }
    );

    await cassClient.execute(
        `INSERT INTO user_movie_interactions (username, movie_id, liked)
         VALUES (?, ?, ?)`,
        [username, movieUUID, !alreadyLiked],
        { prepare: true }
    );

    await redisClient.del(movieIdStr);

    await updateTopLists({
        id: movieUUID,
        likes: newLikes,
        views: movie.views,
        average_rating: movie.average_rating
    });

    return { alreadyLiked, movie, newLikes };
};
const applyLikePreferences = async (username, movie) => {
    const prefKey = `user:preferences:${username}`;

    if (movie.director) {
        const field = `director:${movie.director}`;
        const current = await redisClient.hGet(prefKey, field);

        if (!current) {
            await redisClient.hSet(prefKey, field, 100);
        } else {
            await redisClient.hSet(
                prefKey,
                field,
                Math.round(Number(current) * 1.2)
            );
        }
    }

    if (movie.genres && Array.isArray(movie.genres)) {
        for (const genre of movie.genres) {
            const field = `genre:${genre}`;
            const current = await redisClient.hGet(prefKey, field);

            if (!current) {
                await redisClient.hSet(prefKey, field, 10);
            } else {
                await redisClient.hSet(
                    prefKey,
                    field,
                    Math.round(Number(current) * 1.2)
                );
            }
        }
    }
};
const rollbackLikePreferences = async (username, movie) => {
    const prefKey = `user:preferences:${username}`;

    if (movie.director) {
        const field = `director:${movie.director}`;
        const current = await redisClient.hGet(prefKey, field);

        if (current) {
            const decreased = Math.round(Number(current) / 1.2);

            if (decreased <= 0) {
                await redisClient.hDel(prefKey, field);
            } else {
                await redisClient.hSet(prefKey, field, decreased);
            }
        }
    }

    if (movie.genres && Array.isArray(movie.genres)) {
        for (const genre of movie.genres) {
            const field = `genre:${genre}`;
            const current = await redisClient.hGet(prefKey, field);

            if (current) {
                const decreased = Math.round(Number(current) / 1.2);

                if (decreased <= 0) {
                    await redisClient.hDel(prefKey, field);
                } else {
                    await redisClient.hSet(prefKey, field, decreased);
                }
            }
        }
    }
};
//////////
const rateMovieCore = async (username, movieUUID, movieIdStr, newRating) => {
    const interactionRes = await cassClient.execute(
        `SELECT rating FROM user_movie_interactions
         WHERE username = ? AND movie_id = ? LIMIT 1`,
        [username, movieUUID],
        { prepare: true }
    );

    const alreadyRated = interactionRes.rows.length > 0 && interactionRes.rows[0].rating != null;
    const oldRating = alreadyRated ? interactionRes.rows[0].rating : 0;

    const movieRes = await cassClient.execute(
        `SELECT rating_sum, rating_count, average_rating, views, likes, genres, director
         FROM movies WHERE id = ?`,
        [movieUUID],
        { prepare: true }
    );

    if (movieRes.rows.length === 0) throw new Error("MOVIE_NOT_FOUND");

    const movie = movieRes.rows[0];

    // rollback stare ocene
    let ratingSum = (movie.rating_sum || 0) - oldRating + newRating;
    let ratingCount = alreadyRated ? movie.rating_count : (movie.rating_count || 0) + 1;
    let avg = ratingCount > 0 ? ratingSum / ratingCount : 0;

    await cassClient.execute(
        `UPDATE movies
         SET rating_sum = ?, rating_count = ?, average_rating = ?
         WHERE id = ?`,
        [ratingSum, ratingCount, avg, movieUUID],
        { prepare: true }
    );

    await cassClient.execute(
        `INSERT INTO user_movie_interactions (username, movie_id, rating)
         VALUES (?, ?, ?)`,
        [username, movieUUID, newRating],
        { prepare: true }
    );

    await redisClient.del(movieIdStr);

    await updateTopLists({
        id: movieUUID,
        likes: movie.likes,
        views: movie.views,
        average_rating: avg
    });

    return { movie, oldRating, ratingSum, ratingCount, avg, alreadyRated };
};
const addRate = async (req, res) => {
    try {
        const username = req.params.username;
        const movieIdStr = req.params.id;
        const movieUUID = cassandra.types.Uuid.fromString(movieIdStr);
        const rating = Number(req.body.rating);

        if (isNaN(rating) || rating < 1 || rating > 10) {
            return res.status(400).send("Ocena mora biti između 1 i 10");
        }

        const { movie, oldRating, ratingSum, ratingCount, avg, alreadyRated } =
            await rateMovieCore(username, movieUUID, movieIdStr, rating);

        const prefKey = `user:preferences:${username}`;

        // rollback prethodne preferences ako je već ocenjivao
        if (alreadyRated && oldRating !== rating) {
            if (movie.director) {
                const directorField = `director:${movie.director}`;
                const current = await redisClient.hGet(prefKey, directorField);
                if (current) {
                    const decreased = Math.round(Number(current) / (1 + (oldRating - 5) * 0.05));
                    await redisClient.hSet(prefKey, directorField, decreased);
                }
            }
            if (movie.genres && Array.isArray(movie.genres)) {
                for (const genre of movie.genres) {
                    const field = `genre:${genre}`;
                    const current = await redisClient.hGet(prefKey, field);
                    if (current) {
                        const decreased = Math.round(Number(current) / (1 + (oldRating - 5) * 0.05));
                        await redisClient.hSet(prefKey, field, decreased);
                    }
                }
            }
        }

        // primeni novu ocenu na preferences
        if (movie.director) {
            const directorField = `director:${movie.director}`;
            const current = await redisClient.hGet(prefKey, directorField);
            if (!current) {
                const baseValue = rating * rating * 2 - 50;
                await redisClient.hSet(prefKey, directorField, baseValue);
            } else {
                const percent = (rating - 5) * 5;
                const increased = Math.round(Number(current) * (1 + percent / 100));
                await redisClient.hSet(prefKey, directorField, increased);
            }
        }

        if (movie.genres && Array.isArray(movie.genres)) {
            for (const genre of movie.genres) {
                const field = `genre:${genre}`;
                const current = await redisClient.hGet(prefKey, field);
                if (!current) {
                    const baseValue = (rating - 5) * 4;
                    await redisClient.hSet(prefKey, field, baseValue);
                } else {
                    const percent = (rating - 5) * 5;
                    const increased = Math.round(Number(current) * (1 + percent / 100));
                    await redisClient.hSet(prefKey, field, increased);
                }
            }
        }

        res.json({
            success: true,
            rating,
            rating_sum: ratingSum,
            rating_count: ratingCount,
            average_rating: avg,
            views: movie.views,
            likes: movie.likes
        });
    } catch (err) {
        if (err.message === "MOVIE_NOT_FOUND") {
            return res.status(404).send("Film nije pronađen");
        }
        console.error("AddRate error:", err);
        res.status(500).send("Greška pri ocenjivanju");
    }
};
//////
const getTopMovies = async (req, res) => {
    const { type } = req.params;
    const key = `top:${type}`;

    try {
        const ids = await redisClient.zRange(key, -10, -1, { REV: true });
        if (!ids.length) {
            return res.json([]);
        }

        const uuids = ids.map(id =>
            cassandra.types.Uuid.fromString(id)
        );

        const result = await cassClient.execute(
            `SELECT * FROM movies WHERE id IN ?`,
            [uuids],
            { prepare: true }
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri top listi");
    }
};

const getAddedMovies = async (req, res) => {
    const { username } = req.params;

    if (!username) {
        return res.status(400).send("Nedostaje username");
    }

    const redisKey = `users:addedMovies:${username}`;

    try {
        const movies = await redisClient.lRange(redisKey, 0, -1);
        const parsedMovies = movies.map(m => JSON.parse(m));
        res.json(parsedMovies);
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri dohvatanju filmova iz Redis-a");
    }
};

const updateMovie = async (req, res) => {
    const movieId = cassandra.types.Uuid.fromString(req.params.id);
    const { title, year, director, genres, username } = req.body;

    if (!username) {
        return res.status(400).send("Nedostaje username za Redis update");
    }

    try {
        await cassClient.execute(
            `UPDATE movies 
             SET title = ?, year = ?, director = ?, genres = ?
             WHERE id = ?`,
            [title, parseInt(year), director, genres, movieId],
            { prepare: true }
        );

        const redisKey = `users:addedMovies:${username}`;
        const movies = await redisClient.lRange(redisKey, 0, -1);

        const updatedMovie = {
            id: movieId.toString(),
            title,
            year: parseInt(year),
            director,
            genres
        };

        const updatedList = movies.map(m => {
            const obj = JSON.parse(m);
            return obj.id === movieId.toString() ? updatedMovie : obj;
        });

        await redisClient.del(redisKey);

        if (updatedList.length > 0) {
            await redisClient.rPush(
                redisKey,
                ...updatedList.map(m => JSON.stringify(m))
            );
        }

        res.json({ success: true, movie: updatedMovie });
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri izmeni filma");
    }
};

const hasWatchedMovie = async (req, res) => {
    try {
        const { username, id } = req.params;
        const movieUUID = cassandra.types.Uuid.fromString(id);

        const result = await cassClient.execute(
            `SELECT * FROM user_movie_interactions
             WHERE username = ? AND movie_id = ? LIMIT 1`,
            [username, movieUUID],
            { prepare: true }
        );

        res.json({ toRet: result.rows.length > 0 });
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri proveri pregleda");
    }
};

const searchMoviesByTitle = async (req, res) => {
    const { title, username } = req.query;

    if (!title || !username) {
        return res.status(400).send("Nedostaje title ili username");
    }

    const redisKey = `movie:search:${username}:${title}`;

    try {
        const cached = await redisClient.get(redisKey);
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        const result = await cassClient.execute(
            `SELECT * FROM movies
             WHERE title >= ? AND title <= ?
             ALLOW FILTERING`,
            [title, title + "\uffff"],
            { prepare: true }
        );

        const movies = result.rows;

        await redisClient.setEx(
            redisKey,
            60,
            JSON.stringify(movies)
        );

        res.json(movies);
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri pretrazi filmova");
    }
};

const getRecommendedMovies = async (req, res) => {
    try {
        const { username } = req.params;
        const prefKey = `user:preferences:${username}`;

        const result = await cassClient.execute(
            `SELECT id, title, year, director, genres, average_rating, likes, views 
             FROM movies 
             WHERE average_rating > 0
             ALLOW FILTERING`
        );

        const movies = result.rows;
        

        if (!movies.length) return res.json([]);

        const userPrefs = await redisClient.hGetAll(prefKey);

        if (!userPrefs || Object.keys(userPrefs).length === 0) {
            return res.json([]);
        }

        for (const k in userPrefs) userPrefs[k] = Number(userPrefs[k]);

        const scoredMovies = movies.map(movie => {
            let score = 0;

            if (movie.director) {
                const dirKey = `director:${movie.director}`;
                if (userPrefs[dirKey]) score += userPrefs[dirKey];
            }

            if (movie.genres && Array.isArray(movie.genres)) {
                for (const genre of movie.genres) {
                    const genreKey = `genre:${genre}`;
                    if (userPrefs[genreKey]) score += userPrefs[genreKey];
                }
            }

            
            const finalScore = score * (movie.average_rating || 0);
            console.log(`Film: ${movie.title}, Skor: ${finalScore}`);


            return { ...movie, score: score * (movie.average_rating || 0) };
        });

        const topRecommended = scoredMovies
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        res.json(topRecommended);
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri dohvatanju preporučenih filmova");
    }
};

export {
    saveMovie,
    readMovie,
    addView,
    addLike,
    addRate,
    getAddedMovies,
    updateMovie,
    hasWatchedMovie,
    searchMoviesByTitle,
    updateTopLists,
    getTopMovies,
    getRecommendedMovies
};