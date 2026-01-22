const bcrypt = require("bcrypt");
const cassClient = require("../config/cassandra");


const registerUser = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) 
            return res.status(400).send("Popuni sva polja!");

        const check = await cassClient.execute(
            "SELECT username FROM users WHERE username = ?",
            [username],
            { prepare: true }
        );
        if (check.rows.length > 0) 
            return res.status(400).send("Username zauzet");

        const hashed = await bcrypt.hash(password, 10);

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

const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) 
            return res.status(400).send("Popuni sva polja!");

        const user = await cassClient.execute(
            "SELECT username, password FROM users WHERE username = ?",
            [username],
            { prepare: true }
        );


        if (user.rows.length === 0) 
            return res.status(400).json({ error: "Korisnik ne postoji" });

        const match = await bcrypt.compare(password, user.rows[0].password);
        if (!match) return res.status(400).json({ error: "Pogrešna lozinka" });

        res.json({ success: true, username });
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška pri logovanju");
    }
};

module.exports = { registerUser, loginUser };


