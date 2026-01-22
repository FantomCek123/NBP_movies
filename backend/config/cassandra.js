const cassandra = require("cassandra-driver");

const cassClient = new cassandra.Client({
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'movies_app'
});

cassClient.connect()
    .then(() => console.log("Cassandra povezana!"))
    .catch(err => console.error("Cassandra greška:", err));

module.exports = cassClient;
