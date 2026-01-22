const redis = require("redis");

const reClient = redis.createClient();

reClient.connect()
    .then(() => console.log("Redis povezan!"))
    .catch(err => console.error("Redis greška:", err));

module.exports = reClient;
