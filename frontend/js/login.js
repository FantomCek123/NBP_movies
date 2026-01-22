const loginBtn = document.getElementById("loginBtn");
const goRegisterBtn = document.getElementById("goRegisterBtn");
const result = document.getElementById("result");

const BASE_URL = "http://localhost:3000/users";

goRegisterBtn.addEventListener("click", () => {
    window.location.href = "register.html"; 
});

loginBtn.addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
        alert("Popuni sva polja!");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!res.ok) {
            result.innerText = `Greška: ${data.error}`;  // OVDE TREBA DA PISE NEPOSTOJECI USERNAME ILI POGRESNA LOZINKA
            return;
        }

        localStorage.setItem("username", data.username);

        window.location.href = "test.html";
    } catch (err) {
        console.error(err);
        result.innerText = "Greška pri logovanju";
    }
});
