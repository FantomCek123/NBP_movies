const addBtn = document.getElementById("addBtn");
const searchBtn = document.getElementById("searchBtn");
const likeBtn = document.getElementById("likeBtn");
const viewBtn = document.getElementById("viewBtn");
const rateBtn = document.getElementById("rateBtn");
const result = document.getElementById("result");

const BASE_URL = "http://localhost:3000/movies";

// ------------------- Dodavanje filma -------------------
addBtn.addEventListener("click", async () => {
    const title = document.getElementById("title").value.trim();
    const year = document.getElementById("year").value.trim();
    const director = document.getElementById("director").value.trim();
    const genres = document
        .getElementById("genres")
        .value.trim()
        .split(",")
        .map(g => g.trim());

    if (!title || !year || !director || genres.length === 0) {
        alert("Popuni sva polja!");
        return;
    }

    try {
        const res = await fetch(BASE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, year, director, genres })
        });

        const data = await res.json();
        result.innerText = `Film dodat:\n${JSON.stringify(data, null, 2)}`;

        // reset
        document.getElementById("title").value = "";
        document.getElementById("year").value = "";
        document.getElementById("director").value = "";
        document.getElementById("genres").value = "";

    } catch (err) {
        result.innerText = "Greška pri komunikaciji sa serverom";
        console.error(err);
    }
});

// ------------------- Pronađi film -------------------
searchBtn.addEventListener("click", async () => {
    const id = document.getElementById("searchId").value.trim();
    if (!id) {
        alert("Upiši ID filma!");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/${id}`);
        const data = await res.json();

        result.innerText = `Film pronađen (${data.source}):\n${JSON.stringify(data, null, 2)}`;
    } catch (err) {
        result.innerText = "Greška pri komunikaciji sa serverom";
        console.error(err);
    }
});

// ------------------- Lajk -------------------
likeBtn.addEventListener("click", async () => {
    const id = document.getElementById("movieId").value.trim();
    if (!id) {
        alert("Upiši ID filma!");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/${id}/like`, {
            method: "POST"
        });

        const data = await res.json();
        result.innerText = `Film lajkovan:\n${JSON.stringify(data, null, 2)}`;
    } catch (err) {
        result.innerText = "Greška pri lajkovanju filma";
        console.error(err);
    }
});

// ------------------- Pregled -------------------
viewBtn.addEventListener("click", async () => {
    const id = document.getElementById("movieId").value.trim();
    if (!id) {
        alert("Upiši ID filma!");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/${id}/view`, {
            method: "POST"
        });

        const data = await res.json();
        result.innerText = `Pregled dodat:\n${JSON.stringify(data, null, 2)}`;
    } catch (err) {
        result.innerText = "Greška pri dodavanju pregleda";
        console.error(err);
    }
});

// ------------------- Ocena -------------------
rateBtn.addEventListener("click", async () => {
    const id = document.getElementById("movieId").value.trim();
    const rating = Number(document.getElementById("userRating").value.trim());

    if (!id || isNaN(rating)) {
        alert("Upiši ID i validnu ocenu!");
        return;
    }

    if (rating < 1 || rating > 10) {
        alert("Ocena mora biti između 1 i 10!");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/${id}/rate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rating })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText);
        }

        const data = await res.json();
        result.innerText = `Film ocenjen:\n${JSON.stringify(data, null, 2)}`;
    } catch (err) {
        result.innerText = "Greška pri ocenjivanju filma:\n" + err.message;
        console.error(err);
    }
});
