CREATE KEYSPACE IF NOT EXISTS movies_app
WITH replication = {'class':'SimpleStrategy', 'replication_factor':1};

USE movies_app;

CREATE TABLE IF NOT EXISTS users (
    username text PRIMARY KEY,
    password text
);

CREATE TABLE IF NOT EXISTS movies (
    id uuid PRIMARY KEY,
    title text,
    year int,
    director text,
    genres list<text>,
    likes int,
    views int,
    rating_sum double,
    rating_count int,
    average_rating double
);


CREATE TABLE IF NOT EXISTS user_movie_interactions (
    username text,
    movie_id uuid,
    liked boolean,
    rating int,
    PRIMARY KEY (username, movie_id)
);
