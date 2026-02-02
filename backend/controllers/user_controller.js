
import bcrypt from "bcrypt";
import cassClient from "../config/cassandra.js"; // ESM import

// Registracija korisnika
export const registerUser = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).send("Popuni sva polja!");

        // Provera da li username već postoji
        const check = await cassClient.execute(
            "SELECT username FROM users WHERE username = ?",
            [username],
            { prepare: true }
        );

        if (check.rows.length > 0)
            return res.status(400).send("Username zauzet");

        // Hash lozinke
        const hashed = await bcrypt.hash(password, 10);

        // Ubacivanje korisnika u Cassandra
        await cassClient.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            [username, hashed],
            { prepare: true }
        );

        res.json({ success: true, username });
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri registraciji");
    }
};

// Logovanje korisnika
export const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).send("Popuni sva polja!");

        // Dohvatanje korisnika iz Cassandra
        const user = await cassClient.execute(
            "SELECT username, password FROM users WHERE username = ?",
            [username],
            { prepare: true }
        );

        if (user.rows.length === 0)
            return res.status(400).json({ error: "Korisnik ne postoji" });

        // Provera lozinke
        const match = await bcrypt.compare(password, user.rows[0].password);
        if (!match) return res.status(400).json({ error: "Pogrešna lozinka" });

        res.json({ success: true, username });
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri logovanju");
    }
};
