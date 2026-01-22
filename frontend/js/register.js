const registerBtn = document.getElementById("registerBtn");
const result = document.getElementById("result");

const BASE_URL = "http://localhost:3000/users";

registerBtn.addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
        alert("Popuni sva polja!");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!res.ok) {
            result.innerText = `Greška: ${data}`;  // OVDE TREBA DA PISE DA JE USERNAME ZAUZET
            return;
        }

        result.innerText = `Uspešna registracija!\nUsername: ${data.username}`; // OVO TREBA DA SE IZBRISE


        setTimeout(() => {
            window.location.href = "login.html"; 
        }, 1500);

    } catch (err) {
        console.error(err);
        result.innerText = "Greška pri registraciji (server problem)";
    }
});
