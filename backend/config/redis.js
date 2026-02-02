import redis from "redis";

const reClient = redis.createClient({
    url: "redis://movie-redis:6379"
});

reClient.connect()
    .then(() => console.log("Redis povezan!"))
    .catch(err => console.error("Redis greška:", err));

export default reClient;
