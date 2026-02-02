import cassandra from "cassandra-driver";

const cassClient = new cassandra.Client({
    contactPoints: ['movie-cassandra'], 
    localDataCenter: 'datacenter1',
    keyspace: 'movies_app'
});

try {
    await cassClient.connect();
    console.log("Cassandra povezana!");
} catch (err) {
    console.error("Cassandra greška:", err);
}

export default cassClient;
