const addBtn = document.getElementById("addBtn");
const searchBtn = document.getElementById("searchBtn");
const likeBtn = document.getElementById("likeBtn");
const viewBtn = document.getElementById("viewBtn");
const rateBtn = document.getElementById("rateBtn");
const result = document.getElementById("result");

const myMoviesBtn = document.getElementById("myMoviesBtn");
const myMoviesResult = document.getElementById("myMoviesResult");

const editId = document.getElementById("editId");
const editTitle = document.getElementById("editTitle");
const editYear = document.getElementById("editYear");
const editDirector = document.getElementById("editDirector");
const editGenres = document.getElementById("editGenres");
const saveEditBtn = document.getElementById("saveEditBtn");

const searchTitleBtn = document.getElementById("searchTitleBtn");
const searchTitleInput = document.getElementById("searchTitleInput");
const searchTitleResults = document.getElementById("searchTitleResults");

const BASE_URL = "http://localhost:3000/movies";
const username = localStorage.getItem("username");

const hasWatchedMovie = async (id) => {
    try {
        const res = await fetch(`${BASE_URL}/${username}/${id}/has-watched`);
        if (!res.ok) return false;
        const data = await res.json();
        return data.toRet;
    } catch (err) {
        console.error(err);
        return false;
    }
};

async function refreshMovieUI(movieId) {
    try {
        const res = await fetch(`${BASE_URL}/${movieId}`);
        const m = await res.json();

        const movieDiv = document.getElementById(`movie_${movieId}`);
        if (!movieDiv) return;

        movieDiv.querySelector(".stats").innerText =
            `Views: ${m.views || 0}, Likes: ${m.likes || 0}, Ocena: ${m.average_rating?.toFixed(1) || 0}`;
    } catch (err) {
        console.error(err);
    }
}

async function loadTop(type, elementId, label) {
    try {
        const res = await fetch(`${BASE_URL}/top/${type}`);
        const data = await res.json();

        data.sort((a, b) => {
            if (type === "rating") return b.average_rating - a.average_rating;
            if (type === "likes") return b.likes - a.likes;
            return b.views - a.views;
        });

        const list = document.getElementById(elementId);
        list.innerHTML = "";

        data.forEach(movie => {
            const li = document.createElement("li");
            li.innerText = `${movie.title} (${label}: ${
                type === "rating" ? movie.average_rating.toFixed(2)
                : type === "likes" ? movie.likes
                : movie.views
            })`;
            list.appendChild(li);
        });
    } catch (err) {
        console.error(err);
    }
}

addBtn.addEventListener("click", async () => {
    const title = document.getElementById("title").value.trim();
    const year = document.getElementById("year").value.trim();
    const director = document.getElementById("director").value.trim();
    const genres = Array.from(
        document.querySelectorAll('input[name="genre"]:checked')
    ).map(cb => cb.value);

    if (!title || !year || !director || genres.length === 0) {
        alert("Popuni sva polja!");
        return;
    }

    try {
        const res = await fetch(BASE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, title, year, director, genres })
        });

        const data = await res.json();
        result.innerText = `Film dodat:\n${JSON.stringify(data, null, 2)}`;

        document.getElementById("title").value = "";
        document.getElementById("year").value = "";
        document.getElementById("director").value = "";
        document.querySelectorAll('input[name="genre"]').forEach(cb => cb.checked = false);

        loadTop("rating", "topRating", "ocena");
        loadTop("likes", "topLikes", "lajkovi");
        loadTop("views", "topViews", "pregledi");
    } catch (err) {
        result.innerText = `Greška pri komunikaciji sa serverom`;
        console.error(err);
    }
});

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

viewBtn.addEventListener("click", async () => {
    const id = document.getElementById("movieId").value.trim();
    if (!id) {
        alert("Upiši ID filma!");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/${username}/${id}/view`, { method: "POST" });
        const data = await res.json();
        result.innerText = `Pregled dodat:\n${JSON.stringify(data, null, 2)}`;

        loadTop("rating", "topRating", "ocena");
        loadTop("likes", "topLikes", "lajkovi");
        loadTop("views", "topViews", "pregledi");
    } catch (err) {
        result.innerText = "Greška pri dodavanju pregleda";
        console.error(err);
    }
});

likeBtn.addEventListener("click", async () => {
    const id = document.getElementById("movieId").value.trim();
    if (!id) {
        alert("Upiši ID filma!");
        return;
    }

    const watched = await hasWatchedMovie(id);
    if (!watched) {
        alert("Morate prvo da gledate film da biste ga mogli lajkovati!");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/${username}/${id}/like`, { method: "POST" });
        const data = await res.json();
        result.innerText = `Film lajkovan:\n${JSON.stringify(data, null, 2)}`;

        loadTop("rating", "topRating", "ocena");
        loadTop("likes", "topLikes", "lajkovi");
        loadTop("views", "topViews", "pregledi");
    } catch (err) {
        result.innerText = "Greška pri lajkovanju filma";
        console.error(err);
    }
});

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

    const watched = await hasWatchedMovie(id);
    if (!watched) {
        alert("Morate prvo da gledate film da biste ga mogli oceniti!");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/${username}/${id}/rate`, {
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

        loadTop("rating", "topRating", "ocena");
        loadTop("likes", "topLikes", "lajkovi");
        loadTop("views", "topViews", "pregledi");
    } catch (err) {
        result.innerText = "Greška pri ocenjivanju filma:\n" + err.message;
        console.error(err);
    }
});

myMoviesBtn.addEventListener("click", async () => {
    try {
        const res = await fetch(`${BASE_URL}/user/${username}/added-movies`);
        const movies = await res.json();

        if (movies.length === 0) {
            myMoviesResult.innerHTML = "Niste dodali nijedan film";
        } else {
            myMoviesResult.innerHTML = movies.map(m => `
                <div>
                    <pre>${JSON.stringify(m, null, 2)}</pre>
                    <button onclick='editMovie("${m.id}")'>Edit</button>
                </div>
            `).join("");
        }
    } catch (err) {
        myMoviesResult.innerText = "Greška pri dohvatanju filmova:\n" + err.message;
        console.error(err);
    }
});

window.editMovie = (id) => {
    const movieDivs = Array.from(myMoviesResult.querySelectorAll("div"));
    for (let div of movieDivs) {
        const m = JSON.parse(div.querySelector("pre").innerText);
        if (m.id === id) {
            editId.value = m.id;
            editTitle.value = m.title;
            editYear.value = m.year;
            editDirector.value = m.director;
            editGenres.value = m.genres.join(", ");
            break;
        }
    }
};

saveEditBtn.addEventListener("click", async () => {
    const id = editId.value;
    const title = editTitle.value.trim();
    const year = editYear.value.trim();
    const director = editDirector.value.trim();
    const genres = editGenres.value.trim().split(",").map(g => g.trim());

    if (!id || !title || !year || !director || genres.length === 0) {
        alert("Popuni sva polja!");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, title, year, director, genres })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText);
        }

        await res.json();
        alert("Film uspešno izmenjen!");
        myMoviesBtn.click();
    } catch (err) {
        alert("Greška pri čuvanju izmena:\n" + err.message);
        console.error(err);
    }
});

searchTitleBtn.addEventListener("click", async () => {
    const query = searchTitleInput.value.trim();
    if (!query) {
        alert("Upiši naziv filma!");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/search?title=${encodeURIComponent(query)}&username=${encodeURIComponent(username)}`);
        const movies = await res.json();

        if (movies.length === 0) {
            searchTitleResults.innerHTML = "Nema filmova koji odgovaraju pretrazi";
            return;
        }

        searchTitleResults.innerHTML = movies.map(m => `
            <div id="movie_${m.id}" style="border:1px solid #ccc; padding:10px; margin:10px 0;">
                <strong>${m.title} (${m.year})</strong> - ${m.director}<br>
                Žanrovi: ${m.genres.join(", ")}<br>
                <span class="stats">
                    Views: ${m.views || 0},
                    Likes: ${m.likes || 0},
                    Ocena: ${m.average_rating?.toFixed(1) || 0}
                </span><br><br>

                <button onclick='handleView("${m.id}")'>Gledao / Ne gledao</button>
                <button onclick='handleLike("${m.id}")'>Lajkuj</button>
                <input type="number" id="rate_${m.id}" placeholder="Ocena 1-10" style="width:60px;">
                <button onclick='handleRate("${m.id}")'>Oceni</button>
            </div>
        `).join("");
    } catch (err) {
        console.error(err);
        searchTitleResults.innerHTML = "Greška pri pretrazi filmova";
    }
});

window.handleView = async (id) => {
    try {
        await fetch(`${BASE_URL}/${username}/${id}/view`, { method: "POST" });
        await refreshMovieUI(id);
    } catch (err) {
        console.error(err);
        alert("Greška pri gledanju");
    }
};

window.handleLike = async (id) => {
    try {
        const watched = await hasWatchedMovie(id);
        if (!watched) return alert("Morate prvo da gledate film!");

        await fetch(`${BASE_URL}/${username}/${id}/like`, { method: "POST" });
        await refreshMovieUI(id);
    } catch (err) {
        console.error(err);
        alert("Greška pri lajkovanju");
    }
};

window.handleRate = async (id) => {
    try {
        const ratingInput = document.getElementById(`rate_${id}`);
        const rating = Number(ratingInput.value);

        if (rating < 1 || rating > 10) {
            return alert("Ocena mora biti između 1 i 10!");
        }

        const watched = await hasWatchedMovie(id);
        if (!watched) return alert("Morate prvo da gledate film!");

        await fetch(`${BASE_URL}/${username}/${id}/rate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rating })
        });

        ratingInput.value = "";
        await refreshMovieUI(id);
    } catch (err) {
        console.error(err);
        alert("Greška pri ocenjivanju");
    }
};

window.addEventListener("load", () => {
    loadTop("rating", "topRating", "ocena");
    loadTop("likes", "topLikes", "lajkovi");
    loadTop("views", "topViews", "pregledi");
});

async function getRecommendedMovies() {
    try {
        const res = await fetch(`${BASE_URL}/${username}/recommended`);
        if (!res.ok) throw new Error("Greška pri dohvatu preporuka");

        const movies = await res.json();
        const list = document.getElementById("recommendedMovies");
        list.innerHTML = "";

        if (movies.length === 0) {
            list.innerHTML = "<li>Nema preporučenih filmova za sada</li>";
            return;
        }

        movies.forEach(movie => {
            const li = document.createElement("li");
            li.textContent = `${movie.title} (${movie.year}) — Režiser: ${movie.director}, Ocena: ${movie.average_rating.toFixed(1)}`;
            list.appendChild(li);
        });
    } catch (err) {
        console.error(err);
    }
}

window.addEventListener("DOMContentLoaded", () => {
    getRecommendedMovies();
});

