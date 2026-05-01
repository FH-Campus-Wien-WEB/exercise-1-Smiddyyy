let currentSession = null;
let pauseScroll = true;
let scrollSpeed = 1;


window.onload = function () {
    const loginDialog = document.getElementById("loginDialog");
    const addMovieDialog = document.getElementById("addMovieDialog");
    const loginForm = document.getElementById('loginForm');
    const searchField = document.getElementById("search-input");
    const sidebar = document.getElementById("filter-sidebar");
    const toggleBtn = document.getElementById("menu-toggle");
    const closeBtn = document.getElementById("close-sidebar");
    const authBtn = document.getElementById('authBtn');
    const addBtn = document.getElementById('addBtn');
    const body = document.body;
    const mvcContainer = document.getElementById("movie-card-container");

    fetch("/session")
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            currentSession = data || null;
            updateUI();
        })
        .catch(error => {
            console.error('Failed to load session:', error);
            currentSession = null;
            updateUI();
        });

    // Login dialog
    loginDialog.addEventListener("close", () => {
        if (!currentSession) {
            loginDialog.showModal(); // reopen immediately
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const username = formData.get('username');
        const password = formData.get('password');

        const response = await fetch("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            currentSession = await response.json();
            fetchMovies();
            updateUI();
            loginDialog.close();
            renderLogin();
            pauseScroll = true;
            mvcContainer.scrollTop = 0;
        } else {
            alert("Invalid username or password");
        }
    });

    authBtn.onclick = () => {
        fetch("/logout")
            .then(response => {
                if (response.ok) {
                    currentSession = null;
                    activefilters = [];
                    updateUI();
                    renderLogout();
                    pauseScroll = false;
                }
            })
            .catch(error => {
                console.error('Logout failed:', error);
            });
    };

    closeBtn.addEventListener("click", () => {
        body.classList.toggle("sidebar-closed");
        toggleBtn.removeAttribute("hidden");
    });

    addBtn.addEventListener("click", () => {
        addMovieDialog.showModal();
    });

    addMovieDialog.addEventListener("click", (event) => {
        if (event.target === addMovieDialog) {
            addMovieDialog.close();
        }
    });

    const addMovieDialogSearchInput = document.getElementById("addMovieDialog-search-input");
    addMovieDialogSearchInput.addEventListener("keyup", (e) => {
        if (e.key === "Enter") addMovieSuggestions();
    });

    toggleBtn.addEventListener("click", () => {
        toggleBtn.setAttribute("hidden", "");
        body.classList.toggle("sidebar-closed");
    });

    searchField.addEventListener("keyup", function (event) {
        fetchMovies();
    });


    // fun
    function autoScroll() {
        if (!pauseScroll) {
            mvcContainer.scrollTop += scrollSpeed;

            // Loop back to top when reaching bottom
            if (mvcContainer.scrollTop + mvcContainer.clientHeight >= mvcContainer.scrollHeight) {
                mvcContainer.scrollTop = 0;
            }
        }
        requestAnimationFrame(autoScroll);
    }
    autoScroll()
};

function addMovieSuggestions() {
    const container = document.getElementById('addMovieDialog-suggestions');
    const searchInput = document.getElementById('addMovieDialog-search-input');
    const title = searchInput.value.trim();

    container.innerHTML = "";
    if (!title) {
        return;
    }

    fetch(`/fetch-movie-suggestions?title=${encodeURIComponent(title)}`)
        .then(response => response.ok ? response.json() : {})
        .then(suggestions => {
            if (searchInput.value.trim() !== title) {
                return;
            }

            container.innerHTML = "";
            Object.entries(suggestions).forEach(([imdbID, movie]) => {
                const row = document.createElement("div");
                row.classList.add("add-movie-suggestion");

                const movieText = document.createElement("div");
                movieText.classList.add("add-movie-suggestion-text");

                const movieTitle = document.createElement("span");
                movieTitle.classList.add("add-movie-suggestion-title");
                movieTitle.textContent = movie.title;

                const movieYear = document.createElement("span");
                movieYear.classList.add("add-movie-suggestion-year");
                movieYear.textContent = movie.year;

                movieText.append(movieTitle);
                movieText.append(movieYear);

                const addButton = document.createElement("button");
                addButton.type = "button";
                addButton.classList.add("add-movie-suggestion-btn");
                addButton.dataset.imdbID = imdbID;

                if (movie.inCollection) {
                    addButton.classList.add("remove-from-collection");
                    addButton.textContent = "Remove from collection";
                } else {
                    addButton.textContent = "Add";
                }

                addButton.addEventListener("click", async () => {
                    addButton.disabled = true;
                    const isInCollection = addButton.classList.contains("remove-from-collection");
                    addButton.textContent = isInCollection ? "Removing..." : "Adding...";

                    const response = isInCollection
                        ? await fetch(`/movies/${encodeURIComponent(imdbID)}`, { method: "DELETE" })
                        : await fetch(`/fetch-new-movie?imdbID=${encodeURIComponent(imdbID)}`, { method: "POST" });

                    if (response.ok) {
                        addButton.classList.toggle("remove-from-collection", !isInCollection);
                        addButton.textContent = isInCollection ? "Add" : "Remove from collection";
                        addButton.disabled = false;
                        fetchMovies();
                    } else {
                        addButton.disabled = false;
                        addButton.textContent = isInCollection ? "Remove from collection" : "Add";
                        alert(isInCollection ? "Movie could not be removed" : "Movie could not be added");
                    }
                });

                row.append(movieText);
                row.append(addButton);
                container.append(row);
            });
        })
        .catch(error => {
            console.error("Failed to load movie suggestions:", error);
        });
}

function updateUI() {
    fetchMovies();
    renderGenreFilters();
    if (currentSession) {
        document.body.classList.remove("sidebar-closed");
        document.getElementById("menu-toggle").setAttribute("hidden", "");
        document.getElementById("movie-card-container").classList.remove("blurred");
        pauseScroll = true;
    } else {
        document.body.classList.add("sidebar-closed");
        document.getElementById("menu-toggle").removeAttribute("hidden");
        document.getElementById("movie-card-container").classList.add("blurred");
        pauseScroll = false;
        loginForm.reset();
        loginDialog.showModal();
    }
}

function renderLogout() {
    const greetingElement = document.getElementById('user-greeting');
    greetingElement.innerHTML = `
        <p class="greeting-title">
        👋 See you soon!
        </p>
    `;
    greetingElement.style.display = "block";
    greetingElement.classList.add("show");
    setTimeout(() => {
        greetingElement.classList.add("hide");

        setTimeout(() => {
            greetingElement.classList.remove("show", "hide");
            greetingElement.style.display = "none";
        }, 500);
    }, 3000);
}

function renderLogin() {
    const greetingElement = document.getElementById('user-greeting');
    if (currentSession) {
        const loginDate = new Date(currentSession.loginTime);
        const formattedTime = loginDate.toLocaleString();
        greetingElement.innerHTML = `
            <p class="greeting-title">
                👋 Welcome, <span class="greeting-name">${currentSession.firstName} ${currentSession.lastName}</span>!
            </p>
            <p class="greeting-user">@${currentSession.username}</p>
            <p class="greeting-time">Logged in at: ${formattedTime}</p>
        `;

        greetingElement.style.display = "block";
        greetingElement.classList.add("show");
        setTimeout(() => {
            greetingElement.classList.add("hide");

            setTimeout(() => {
                greetingElement.classList.remove("show", "hide");
                greetingElement.style.display = "none";
            }, 500);
        }, 10000);
    }
}

function fetchMovies() {
    const xhr = new XMLHttpRequest()
    xhr.addEventListener("load", () => setAvailableGenres(xhr));
    xhr.addEventListener("load", () => renderMovies(xhr));
    xhr.open("GET", `/movies?genre=${activefilters.join(',')}&title=${document.getElementById("search-input").value}`);
    xhr.send();
    console.log("Fetching movies with title filter:", document.getElementById("search-input").value);
    console.log("Fetching movies with genre filters:", activefilters);
}

function renderMovies(xhrRequest) {
    const movieCardContainer = document.querySelector("main");
    movieCardContainer.innerHTML = "";
    if (xhrRequest.status == 200) {
        const movies = JSON.parse(xhrRequest.responseText);
        movies.forEach((movie, movieIndex) => {
            const article = document.createElement("article");
            article.classList.add("movie-card"); // Add a class for styling

            const header = document.createElement("header");

            // Create a wrapper for title + edit button
            const titleRow = document.createElement("div");
            titleRow.classList.add("title-row");

            // Title
            const title = document.createElement("h2");
            title.textContent = movie.title;
            titleRow.append(title);

            const movieMenu = document.createElement("div");
            movieMenu.classList.add("movie-menu");

            const menuButton = document.createElement("button");
            menuButton.id = movie.imdbID + "-menu";
            menuButton.classList.add("movie-menu-btn");
            menuButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <circle cx="8" cy="3" r="1.5"/>
                <circle cx="8" cy="8" r="1.5"/>
                <circle cx="8" cy="13" r="1.5"/>
            </svg>`;
            menuButton.setAttribute("aria-label", `Open actions for ${movie.title}`);
            menuButton.setAttribute("title", `Actions for ${movie.title}`);

            const menuOptions = document.createElement("div");
            menuOptions.classList.add("movie-menu-options");
            menuOptions.setAttribute("hidden", "");

            const editButton = document.createElement("button");
            editButton.id = movie.imdbID + "-edit";
            editButton.classList.add("movie-menu-option");
            editButton.type = "button";
            editButton.textContent = "Edit";
            editButton.onclick = function () {
                window.open('edit.html?imdbID=' + movie.imdbID, '_blank', 'width=500,height=800');
                menuOptions.setAttribute("hidden", "");
            };

            const removeButton = document.createElement("button");
            removeButton.id = movie.imdbID + "-remove";
            removeButton.classList.add("movie-menu-option", "remove-option");
            removeButton.type = "button";
            removeButton.textContent = "Delete";
            removeButton.onclick = async function () {
                const response = await fetch(`/movies/${encodeURIComponent(movie.imdbID)}`, {
                    method: "DELETE"
                });

                if (response.ok) {
                    fetchMovies();
                } else {
                    alert("Movie could not be removed");
                }
            };

            menuButton.onclick = function () {
                menuOptions.toggleAttribute("hidden");
            };

            menuOptions.append(editButton);
            menuOptions.append(removeButton);
            movieMenu.append(menuButton);
            movieMenu.append(menuOptions);
            titleRow.append(movieMenu);
            header.append(titleRow);

            // Genres as tags
            const genres = document.createElement("div");
            genres.classList.add("movie-genres");
            movie.genres.forEach(genre => {
                const genreSpan = document.createElement("span");
                genreSpan.textContent = genre;
                genreSpan.classList.add("genre-tag"); // Add a class for styling
                if (activefilters.length > 0 && activefilters.includes(genre)) {
                    genreSpan.classList.add("active-genre");
                } else {
                    genreSpan.classList.add("inactive-genre");
                }
                genres.append(genreSpan);
            });
            header.append(genres);

            article.append(header);

            // Poster image
            const imgwrapper = document.createElement("div");
            imgwrapper.classList.add("img-wrapper");

            const poster = document.createElement("img");
            poster.src = movie.poster;
            poster.alt = "Poster of " + movie.title;
            poster.width = 200;

            imgwrapper.append(poster);
            article.append(imgwrapper);

            // Details as simple text
            const date = new Date(movie.released);
            const formatted_data = `${date.getFullYear()} ${date.toLocaleString("en-US", { month: "short" })
                } ${String(date.getDate()).padStart(2, "0")}`;
            const detailsText = document.createElement("p");
            detailsText.classList.add("meta-data");
            detailsText.innerHTML = `
                    <span class="label">Runtime</span> 
                    <span class="value">${movie.runtime} min</span>
                    <span class="separator">|</span>
                    <span class="label">Released</span> 
                    <span class="value">${formatted_data}</span>
                    `;
            article.append(detailsText);

            const movieDetails = document.createElement("div");
            movieDetails.classList.add("movie-details");
            article.append(movieDetails);

            const expandButton = document.createElement("button");
            expandButton.classList.add("expand-btn");
            expandButton.textContent = "show details";
            expandButton.addEventListener("click", () => toggleCard(expandButton));
            article.append(expandButton);


            // Movie Details:
            // Plot summary
            const plot = document.createElement("p");
            plot.classList.add("movie-plot");
            plot.classList.add("scrollable");
            plot.textContent = movie.plot;

            // Ratings as pills
            const ratingsText = document.createElement("div");
            ratingsText.classList.add("movie-ratings");
            ratingsText.innerHTML = `
                <span class="rating-badge imdb">IMDb ${movie.imdbRating}/10</span>
                <span class="rating-badge metascore">Metascore ${movie.metascore}</span>
                `;

            // credits list
            const creditsPanel = document.createElement("div");
            creditsPanel.classList.add("credits-panel-container")
            const credits = [
                { id: "actors", label: "Actors", items: movie.actors },
                { id: "directors", label: "Directors", items: movie.directors },
                { id: "writers", label: "Writers", items: movie.writers }
            ];
            credits.forEach(contributor => {

                const creditsDiv = document.createElement("div");
                creditsDiv.classList.add("credits-panel");

                const title = document.createElement("h2");
                title.textContent = contributor.label;
                creditsDiv.append(title);

                const list = document.createElement("ul");
                contributor.items.forEach(item => {
                    const listItem = document.createElement("li");
                    listItem.textContent = item;
                    list.append(listItem);
                });
                creditsDiv.append(list);
                creditsPanel.append(creditsDiv);
            });

            // Credits section with tabs
            // Create tablist container
            const tablist = document.createElement("div");
            tablist.classList.add("details-tablist");
            tablist.setAttribute("role", "tablist");
            tablist.setAttribute("aria-label", "Movie Credits");

            // Define tabs with data
            const tabs = [
                { id: "summary", label: "Summary", items: [plot, ratingsText] },
                { id: "credits", label: "Credits", items: [creditsPanel] },
            ];

            // Create all tab buttons
            const panels = [];
            tabs.forEach((tab, index) => {
                const button = document.createElement("button");
                button.id = `tab-${movieIndex}-${tab.id}`;
                button.classList.add("details-tab-button");
                button.setAttribute("role", "tab");
                button.setAttribute("aria-controls", `panel-${movieIndex}-${tab.id}`);
                button.setAttribute("aria-selected", index === 0 ? "true" : "false");
                button.setAttribute("tabindex", index === 0 ? "0" : "-1");
                button.textContent = tab.label;

                tablist.append(button);

                // Create corresponding panel
                const panel = document.createElement("section");
                panel.classList.add("details-section")
                panel.classList.add("scrollable")
                panel.id = `panel-${movieIndex}-${tab.id}`;
                panel.setAttribute("role", "tabpanel");
                panel.setAttribute("aria-labelledby", `tab-${movieIndex}-${tab.id}`);
                if (index !== 0) {
                    panel.setAttribute("hidden", "");
                }

                tab.items.forEach(item => panel.append(item));

                panels.push({ button, panel });
            });

            // Set up click handlers for tab switching
            panels.forEach(({ button, panel }) => {
                button.addEventListener("click", () => {
                    // Deactivate all tabs and panels
                    panels.forEach(({ button: btn, panel: pnl }) => {
                        btn.setAttribute("aria-selected", "false");
                        btn.setAttribute("tabindex", "-1");
                        pnl.setAttribute("hidden", "");
                    });

                    // Activate clicked tab and its panel
                    button.setAttribute("aria-selected", "true");
                    button.setAttribute("tabindex", "0");
                    panel.removeAttribute("hidden");
                });
            });

            movieDetails.append(document.createElement("hr")); // Add a horizontal rule for separation
            movieDetails.append(tablist);
            panels.forEach(({ panel }) => movieDetails.append(panel));

            movieCardContainer.append(article);
        });

    } else {
        const errorMessage = document.createElement("p");
        errorMessage.textContent =
            "Daten konnten nicht geladen werden, Status " +
            xhrRequest.status +
            " - " +
            xhrRequest.statusText;
        movieCardContainer.append(errorMessage);
    }
};

function toggleCard(button) {
    const details = button.previousElementSibling;
    const isOpen = details.classList.contains("open");

    details.classList.toggle("open");
    button.textContent = isOpen ? "show details" : "hide details";
};


// const ALL_GENRES = [
//     "Action",
//     "Adventure",
//     "Animation",
//     "Biography",
//     "Comedy",
//     "Crime",
//     "Documentary",
//     "Drama",
//     "Family",
//     "Fantasy",
//     "Film Noir",
//     "History",
//     "Horror",
//     "Music",
//     "Musical",
//     "Mystery",
//     "Romance",
//     "Sci-Fi",
//     "Short Film",
//     "Sport",
//     "Superhero",
//     "Thriller",
//     "War",
//     "Western"
// ]
let ALL_GENRES = [];
let activefilters = [];

function setAvailableGenres(xhrRequest) {
    ALL_GENRES = [];
    if (xhrRequest.status == 200) {
        const movies = JSON.parse(xhrRequest.responseText);
        movies.forEach((movie, movieIndex) => {
            movie.genres.forEach(genre => {
                if (!ALL_GENRES.includes(genre)) {
                    ALL_GENRES.push(genre);
                }
            });
        });
        renderGenreFilters();
    } else {
        const errorMessage = document.createElement("p");
        errorMessage.textContent =
            "Daten konnten nicht geladen werden, Status " +
            xhrRequest.status +
            " - " +
            xhrRequest.statusText;
        document.getElementById('available-filters').append(errorMessage);
    }
}

function renderGenreFilters() {
    const activeFilterContainer = document.getElementById("active-filters");
    const availableFilterContainer = document.getElementById("available-filters");

    activeFilterContainer.innerHTML = "";
    availableFilterContainer.innerHTML = "";

    if (activefilters.length == 0) {
        const allBtn = document.createElement("span");
        allBtn.classList.add("filter-btn", "active-filter");
        allBtn.textContent = "ALL";
        allBtn.addEventListener("click", (e) => e.stopPropagation());
        activeFilterContainer.append(allBtn);
    } else {
        activefilters.forEach(genre => {
            const btn = document.createElement("span");
            btn.classList.add("filter-btn", "active-filter");
            btn.textContent = genre;
            btn.addEventListener("click", (e) => e.stopPropagation());

            const remove = document.createElement("span");
            remove.classList.add("remove-filter");
            remove.textContent = "x";
            btn.append(remove);

            remove.onclick = () => removefilter(genre);

            activeFilterContainer.append(btn);
        });
    }

    ALL_GENRES.filter(genre => !activefilters.includes(genre))
        .forEach(genre => {
            const btn = document.createElement("span");
            btn.classList.add("filter-btn", "available-filter");
            btn.textContent = genre;
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                addFilter(genre);
            });
            availableFilterContainer.append(btn);
        });
}

function removefilter(genre) {
    activefilters = activefilters.filter(g => g !== genre);
    fetchMovies();
}

function addFilter(genre) {
    activefilters.push(genre);
    fetchMovies();
}
