const state = {
    currentSession: null,
    pauseScroll: true,
    scrollSpeed: 1,
    availableGenres: [],
    activeGenreFilters: []
};

const elements = {};

document.addEventListener("DOMContentLoaded", initApp);

// ---------------
// App setup
// ---------------

function initApp() {
    cacheElements();
    bindEvents();
    loadSession();
    startAutoScroll();
}

function cacheElements() {
    elements.body = document.body;
    elements.loginDialog = document.getElementById("login-dialog");
    elements.addMovieDialog = document.getElementById("add-movie-dialog");
    elements.loginForm = document.getElementById("login-form");
    elements.movieSearchInput = document.getElementById("movie-search-input");
    elements.sidebarOpenButton = document.getElementById("sidebar-open-button");
    elements.sidebarCloseButton = document.getElementById("sidebar-close-button");
    elements.logoutButton = document.getElementById("logout-button");
    elements.addMovieButton = document.getElementById("add-movie-button");
    elements.movieGrid = document.getElementById("movie-grid");
    elements.addMovieSearchInput = document.getElementById("add-movie-search-input");
    elements.addMovieResults = document.getElementById("add-movie-results");
    elements.activeGenreFilters = document.getElementById("active-genre-filters");
    elements.availableGenreFilters = document.getElementById("available-genre-filters");
    elements.sessionToast = document.getElementById("session-toast");
}

function bindEvents() {
    elements.loginDialog.addEventListener("close", () => {
        if (!state.currentSession) {
            elements.loginDialog.showModal();
        }
    });

    elements.loginForm.addEventListener("submit", handleLogin);
    elements.logoutButton.addEventListener("click", handleLogout);

    elements.sidebarCloseButton.addEventListener("click", closeSidebar);
    elements.sidebarOpenButton.addEventListener("click", openSidebar);

    elements.addMovieButton.addEventListener("click", () => {
        elements.addMovieDialog.showModal();
    });

    elements.addMovieDialog.addEventListener("click", (event) => {
        if (event.target === elements.addMovieDialog) {
            elements.addMovieDialog.close();
        }
    });

    elements.addMovieSearchInput.addEventListener("keyup", (event) => {
        if (event.key === "Enter") {
            loadMovieSuggestions();
        }
    });

    elements.movieSearchInput.addEventListener("keyup", loadMovies);
}

// ---------------
// Session
// ---------------

async function loadSession() {
    try {
        const response = await fetch("/session");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        state.currentSession = await response.json();
    } catch (error) {
        console.error("Failed to load session:", error);
        state.currentSession = null;
    }

    renderAppState();
}

async function handleLogin(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const username = formData.get("username");
    const password = formData.get("password");

    const response = await fetch("/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
        alert("Invalid username or password");
        return;
    }

    state.currentSession = await response.json();
    state.pauseScroll = true;
    elements.movieGrid.scrollTop = 0;
    elements.loginDialog.close();

    renderAppState();
    showLoginGreeting();
}

async function handleLogout() {
    try {
        const response = await fetch("/logout");
        if (!response.ok) {
            return;
        }

        state.currentSession = null;
        state.activeGenreFilters = [];
        state.pauseScroll = false;
        elements.movieSearchInput.value = "";

        renderAppState();
        showLogoutGreeting();
    } catch (error) {
        console.error("Logout failed:", error);
    }
}

function renderAppState() {
    loadMovies();
    renderGenreFilters();

    if (state.currentSession) {
        elements.body.classList.remove("is-sidebar-closed");
        elements.sidebarOpenButton.setAttribute("hidden", "");
        elements.movieGrid.classList.remove("movie-grid--blurred");
        state.pauseScroll = true;
        return;
    }

    elements.body.classList.add("is-sidebar-closed");
    elements.sidebarOpenButton.removeAttribute("hidden");
    elements.movieGrid.classList.add("movie-grid--blurred");
    state.pauseScroll = false;
    elements.loginForm.reset();
    elements.loginDialog.showModal();
}

function showLogoutGreeting() {
    elements.sessionToast.innerHTML = `
        <p class="session-toast__title">See you soon!</p>
    `;
    showGreeting(3000);
}

function showLoginGreeting() {
    if (!state.currentSession) {
        return;
    }

    const loginDate = new Date(state.currentSession.loginTime);
    const formattedTime = loginDate.toLocaleString();

    elements.sessionToast.innerHTML = `
        <p class="session-toast__title">
            Welcome, <span class="session-toast__name">${state.currentSession.firstName} ${state.currentSession.lastName}</span>!
        </p>
        <p class="session-toast__user">@${state.currentSession.username}</p>
        <p class="session-toast__time">Logged in at: ${formattedTime}</p>
    `;
    showGreeting(10000);
}

function showGreeting(durationMs) {
    elements.sessionToast.style.display = "block";
    elements.sessionToast.classList.add("session-toast--show");

    setTimeout(() => {
        elements.sessionToast.classList.add("session-toast--hide");

        setTimeout(() => {
            elements.sessionToast.classList.remove("session-toast--show", "session-toast--hide");
            elements.sessionToast.style.display = "none";
        }, 500);
    }, durationMs);
}

// ---------------
// Movies
// ---------------

async function loadMovies() {
    const params = new URLSearchParams({
        genre: state.activeGenreFilters.join(","),
        title: elements.movieSearchInput.value
    });

    try {
        const response = await fetch(`/movies?${params.toString()}`);
        if (!response.ok) {
            renderMovieLoadError(response.status, response.statusText);
            return;
        }

        const movies = await response.json();
        updateAvailableGenres(movies);
        renderMovieCards(movies);
    } catch (error) {
        console.error("Failed to load movies:", error);
        renderMovieLoadError("", "Failed to load movies");
    }
}

function updateAvailableGenres(movies) {
    state.availableGenres = [];

    movies.forEach(movie => {
        movie.genres.forEach(genre => {
            if (!state.availableGenres.includes(genre)) {
                state.availableGenres.push(genre);
            }
        });
    });

    renderGenreFilters();
}

function renderMovieLoadError(status, statusText) {
    elements.movieGrid.innerHTML = "";

    const errorMessage = document.createElement("p");
    errorMessage.textContent = `Daten konnten nicht geladen werden, Status ${status} - ${statusText}`;
    elements.movieGrid.append(errorMessage);
}

function renderMovieCards(movies) {
    elements.movieGrid.innerHTML = "";
    movies.forEach((movie, movieIndex) => {
        elements.movieGrid.append(createMovieCard(movie, movieIndex));
    });
}

function createMovieCard(movie, movieIndex) {
    const article = document.createElement("article");
    article.classList.add("movie-card");

    article.append(createMovieHeader(movie));
    article.append(createMoviePoster(movie));
    article.append(createMovieMetadata(movie));

    const movieDetails = document.createElement("div");
    movieDetails.classList.add("movie-card__details");
    article.append(movieDetails);

    const expandButton = document.createElement("button");
    expandButton.classList.add("movie-card__expand-button");
    expandButton.textContent = "show details";
    expandButton.addEventListener("click", () => toggleMovieDetails(expandButton));
    article.append(expandButton);

    movieDetails.append(document.createElement("hr"));
    movieDetails.append(createMovieDetails(movie, movieIndex));

    return article;
}

function createMovieHeader(movie) {
    const header = document.createElement("header");

    const titleRow = document.createElement("div");
    titleRow.classList.add("movie-card__title-row");

    const title = document.createElement("h2");
    title.textContent = movie.title;
    titleRow.append(title);
    titleRow.append(createMovieMenu(movie));

    header.append(titleRow);
    header.append(createGenreTags(movie));

    return header;
}

function createMovieMenu(movie) {
    const movieMenu = document.createElement("div");
    movieMenu.classList.add("movie-card__menu");

    const menuButton = document.createElement("button");
    menuButton.id = `${movie.imdbID}-menu`;
    menuButton.classList.add("movie-card__menu-button");
    menuButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <circle cx="8" cy="3" r="1.5"/>
        <circle cx="8" cy="8" r="1.5"/>
        <circle cx="8" cy="13" r="1.5"/>
    </svg>`;
    menuButton.setAttribute("aria-label", `Open actions for ${movie.title}`);
    menuButton.setAttribute("title", `Actions for ${movie.title}`);

    const menuOptions = document.createElement("div");
    menuOptions.classList.add("movie-card__menu-options");
    menuOptions.setAttribute("hidden", "");

    const editButton = document.createElement("button");
    editButton.id = `${movie.imdbID}-edit`;
    editButton.classList.add("movie-card__menu-option");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => {
        window.open(`edit.html?imdbID=${movie.imdbID}`, "_blank", "width=500,height=800");
        menuOptions.setAttribute("hidden", "");
    });

    const removeButton = document.createElement("button");
    removeButton.id = `${movie.imdbID}-remove`;
    removeButton.classList.add("movie-card__menu-option", "movie-card__menu-option--danger");
    removeButton.type = "button";
    removeButton.textContent = "Delete";
    removeButton.addEventListener("click", async () => {
        const response = await fetch(`/movies/${encodeURIComponent(movie.imdbID)}`, {
            method: "DELETE"
        });

        if (response.ok) {
            loadMovies();
        } else {
            alert("Movie could not be removed");
        }
    });

    menuButton.addEventListener("click", () => {
        menuOptions.toggleAttribute("hidden");
    });

    menuOptions.append(editButton);
    menuOptions.append(removeButton);
    movieMenu.append(menuButton);
    movieMenu.append(menuOptions);

    return movieMenu;
}

function createGenreTags(movie) {
    const genres = document.createElement("div");
    genres.classList.add("movie-card__genres");

    movie.genres.forEach(genre => {
        const genreSpan = document.createElement("span");
        genreSpan.textContent = genre;
        genreSpan.classList.add("movie-card__genre");

        if (state.activeGenreFilters.includes(genre)) {
            genreSpan.classList.add("movie-card__genre--active");
        } else {
            genreSpan.classList.add("movie-card__genre--inactive");
        }

        genres.append(genreSpan);
    });

    return genres;
}

function createMoviePoster(movie) {
    const imageWrapper = document.createElement("div");
    imageWrapper.classList.add("movie-card__poster-frame");

    const poster = document.createElement("img");
    poster.src = movie.poster;
    poster.alt = `Poster of ${movie.title}`;
    poster.width = 200;

    imageWrapper.append(poster);
    return imageWrapper;
}

function createMovieMetadata(movie) {
    const releasedDate = new Date(movie.released);
    const formattedDate = `${releasedDate.getFullYear()} ${releasedDate.toLocaleString("en-US", { month: "short" })} ${String(releasedDate.getDate()).padStart(2, "0")}`;

    const detailsText = document.createElement("p");
    detailsText.classList.add("movie-card__meta");
    detailsText.innerHTML = `
        <span class="label">Runtime</span>
        <span class="value">${movie.runtime} min</span>
        <span class="separator">|</span>
        <span class="label">Released</span>
        <span class="value">${formattedDate}</span>
    `;

    return detailsText;
}

function createMovieDetails(movie, movieIndex) {
    const fragment = document.createDocumentFragment();
    const plot = createPlotPanel(movie);
    const ratings = createRatingsPanel(movie);
    const credits = createCreditsPanel(movie);
    const tabs = [
        { id: "summary", label: "Summary", items: [plot, ratings] },
        { id: "credits", label: "Credits", items: [credits] }
    ];
    const panels = [];

    const tablist = document.createElement("div");
    tablist.classList.add("movie-card__tab-list");
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", "Movie Credits");

    tabs.forEach((tab, index) => {
        const button = document.createElement("button");
        button.id = `tab-${movieIndex}-${tab.id}`;
        button.classList.add("movie-card__tab-button");
        button.setAttribute("role", "tab");
        button.setAttribute("aria-controls", `panel-${movieIndex}-${tab.id}`);
        button.setAttribute("aria-selected", index === 0 ? "true" : "false");
        button.setAttribute("tabindex", index === 0 ? "0" : "-1");
        button.textContent = tab.label;

        const panel = document.createElement("section");
        panel.id = `panel-${movieIndex}-${tab.id}`;
        panel.classList.add("movie-card__tab-panel", "scrollable");
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", button.id);

        if (index !== 0) {
            panel.setAttribute("hidden", "");
        }

        tab.items.forEach(item => panel.append(item));
        panels.push({ button, panel });
        tablist.append(button);
    });

    panels.forEach(({ button, panel }) => {
        button.addEventListener("click", () => {
            panels.forEach(({ button: otherButton, panel: otherPanel }) => {
                otherButton.setAttribute("aria-selected", "false");
                otherButton.setAttribute("tabindex", "-1");
                otherPanel.setAttribute("hidden", "");
            });

            button.setAttribute("aria-selected", "true");
            button.setAttribute("tabindex", "0");
            panel.removeAttribute("hidden");
        });
    });

    fragment.append(tablist);
    panels.forEach(({ panel }) => fragment.append(panel));

    return fragment;
}

function createPlotPanel(movie) {
    const plot = document.createElement("p");
    plot.classList.add("movie-card__plot", "scrollable");
    plot.textContent = movie.plot;
    return plot;
}

function createRatingsPanel(movie) {
    const ratings = document.createElement("div");
    ratings.classList.add("movie-card__ratings");
    ratings.innerHTML = `
        <span class="movie-card__rating imdb">IMDb ${movie.imdbRating}/10</span>
        <span class="movie-card__rating metascore">Metascore ${movie.metascore}</span>
    `;
    return ratings;
}

function createCreditsPanel(movie) {
    const creditsPanel = document.createElement("div");
    creditsPanel.classList.add("movie-card__credits");

    const credits = [
        { label: "Actors", items: movie.actors },
        { label: "Directors", items: movie.directors },
        { label: "Writers", items: movie.writers }
    ];

    credits.forEach(contributor => {
        const creditsDiv = document.createElement("div");
        creditsDiv.classList.add("movie-card__credit-group");

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

    return creditsPanel;
}

function toggleMovieDetails(button) {
    const details = button.previousElementSibling;
    const isOpen = details.classList.contains("open");

    details.classList.toggle("open");
    button.textContent = isOpen ? "show details" : "hide details";
}

// ---------------
// Add movie dialog
// ---------------

async function loadMovieSuggestions() {
    const title = elements.addMovieSearchInput.value.trim();
    elements.addMovieResults.innerHTML = "";

    if (!title) {
        return;
    }

    try {
        const response = await fetch(`/fetch-movie-suggestions?title=${encodeURIComponent(title)}`);
        const suggestions = response.ok ? await response.json() : {};

        if (elements.addMovieSearchInput.value.trim() !== title) {
            return;
        }

        elements.addMovieResults.innerHTML = "";
        Object.entries(suggestions).forEach(([imdbID, movie]) => {
            elements.addMovieResults.append(createMovieSuggestionRow(imdbID, movie));
        });
    } catch (error) {
        console.error("Failed to load movie suggestions:", error);
    }
}

function createMovieSuggestionRow(imdbID, movie) {
    const row = document.createElement("div");
    row.classList.add("add-movie-result");

    const movieText = document.createElement("div");
    movieText.classList.add("add-movie-result__text");

    const movieTitle = document.createElement("span");
    movieTitle.classList.add("add-movie-result__title");
    movieTitle.textContent = movie.title;

    const movieYear = document.createElement("span");
    movieYear.classList.add("add-movie-result__year");
    movieYear.textContent = movie.year;

    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.classList.add("add-movie-result__button");
    actionButton.dataset.imdbID = imdbID;
    setSuggestionButtonState(actionButton, movie.inCollection);
    actionButton.addEventListener("click", () => toggleMovieInCollection(imdbID, actionButton));

    movieText.append(movieTitle);
    movieText.append(movieYear);
    row.append(movieText);
    row.append(actionButton);

    return row;
}

function setSuggestionButtonState(button, isInCollection) {
    button.disabled = false;
    button.classList.toggle("add-movie-result__button--remove", isInCollection);
    button.textContent = isInCollection ? "Remove from collection" : "Add";
}

async function toggleMovieInCollection(imdbID, button) {
    const isInCollection = button.classList.contains("add-movie-result__button--remove");
    button.disabled = true;
    button.textContent = isInCollection ? "Removing..." : "Adding...";

    const response = isInCollection
        ? await fetch(`/movies/${encodeURIComponent(imdbID)}`, { method: "DELETE" })
        : await fetch(`/fetch-new-movie?imdbID=${encodeURIComponent(imdbID)}`, { method: "POST" });

    if (response.ok) {
        setSuggestionButtonState(button, !isInCollection);
        loadMovies();
        return;
    }

    setSuggestionButtonState(button, isInCollection);
    alert(isInCollection ? "Movie could not be removed" : "Movie could not be added");
}

// ---------------
// Genre filters
// ---------------

function renderGenreFilters() {
    elements.activeGenreFilters.innerHTML = "";
    elements.availableGenreFilters.innerHTML = "";

    if (state.activeGenreFilters.length === 0) {
        const allButton = document.createElement("span");
        allButton.classList.add("genre-filter", "genre-filter--active");
        allButton.textContent = "ALL";
        allButton.addEventListener("click", event => event.stopPropagation());
        elements.activeGenreFilters.append(allButton);
    } else {
        state.activeGenreFilters.forEach(genre => {
            elements.activeGenreFilters.append(createActiveGenreFilter(genre));
        });
    }

    state.availableGenres
        .filter(genre => !state.activeGenreFilters.includes(genre))
        .forEach(genre => {
            elements.availableGenreFilters.append(createAvailableGenreFilter(genre));
        });
}

function createActiveGenreFilter(genre) {
    const button = document.createElement("span");
    button.classList.add("genre-filter", "genre-filter--active");
    button.textContent = genre;
    button.addEventListener("click", event => event.stopPropagation());

    const remove = document.createElement("span");
    remove.classList.add("genre-filter__remove");
    remove.textContent = "x";
    remove.addEventListener("click", () => removeGenreFilter(genre));

    button.append(remove);
    return button;
}

function createAvailableGenreFilter(genre) {
    const button = document.createElement("span");
    button.classList.add("genre-filter", "genre-filter--available");
    button.textContent = genre;
    button.addEventListener("click", event => {
        event.stopPropagation();
        addGenreFilter(genre);
    });
    return button;
}

function removeGenreFilter(genre) {
    state.activeGenreFilters = state.activeGenreFilters.filter(activeGenre => activeGenre !== genre);
    loadMovies();
}

function addGenreFilter(genre) {
    state.activeGenreFilters.push(genre);
    loadMovies();
}

// ---------------
// Small UI helpers
// ---------------

function openSidebar() {
    elements.sidebarOpenButton.setAttribute("hidden", "");
    elements.body.classList.remove("is-sidebar-closed");
}

function closeSidebar() {
    elements.body.classList.add("is-sidebar-closed");
    elements.sidebarOpenButton.removeAttribute("hidden");
}

function startAutoScroll() {
    if (!state.pauseScroll) {
        elements.movieGrid.scrollTop += state.scrollSpeed;

        if (
            elements.movieGrid.scrollTop + elements.movieGrid.clientHeight >=
            elements.movieGrid.scrollHeight
        ) {
            elements.movieGrid.scrollTop = 0;
        }
    }

    requestAnimationFrame(startAutoScroll);
}
