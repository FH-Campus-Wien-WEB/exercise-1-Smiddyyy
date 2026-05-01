# Movies!

A small movie collection web app built with Node.js, Express, plain HTML/CSS/JavaScript, and file-based JSON storage.

Users can log in, browse their movie collection, filter by genre, search by title, fetch movie data from OMDb, add movies to their own collection, remove movies again, and edit stored movie metadata.

This project was built for a web technology university course. Disclaimer: I used AI assistance during development, especially Codex and GitHub Copilot, for refactoring, naming cleanup, and implementation support.

## Features

- Session-based login/logout
- Per-user movie collections
- Admin user with access to all movies
- Movie cards with poster, genres, metadata, ratings, plot, and credits
- Genre filtering and title search
- Add movie dialog with OMDb search suggestions
- Add/remove movies from a user's collection
- Edit movie metadata in a separate edit window
- JSON file persistence, without a database

## Getting Started

Install dependencies:

```bash
npm install
```

Create a `.env` file based on `.env.example`:

```env
PORT=3000
OMDB_API_KEY=your_api_key_here
SESSION_SECRET=your_session_secret_here
```

Run the server:

```bash
npm start
```

Or run with nodemon:

```bash
npm run start-nodemon
```

Open the app:

```text
http://localhost:3000/
```

## Project Structure

```text
webtech/
|-- data/
|   |-- users.json
|   `-- movies/
|       `-- tt*.json
|-- server/
|   |-- config.js
|   |-- movie-model.js
|   |-- server.js
|   |-- user-model.js
|   `-- files/
|       |-- index.html
|       |-- index.js
|       |-- edit.html
|       |-- edit.js
|       |-- base.css
|       |-- layout.css
|       |-- sidebar.css
|       |-- dialogs.css
|       |-- movie-card.css
|       `-- edit.css
|-- requests/
|-- tasks/
|-- package.json
`-- README.md
```

## Important Files

### Server

- `server/server.js`
  Main Express application. It configures middleware, serves static frontend files, defines API endpoints, handles login/logout/session logic, and starts the server.

- `server/movie-model.js`
  Handles movie loading, movie cache access, user collection updates, movie file writes, user file writes, and OMDb movie normalization.

- `server/user-model.js`
  Loads `data/users.json` once into memory and exports the user object.

- `server/config.js`
  Central place for environment/config values like port, OMDb API key, session secret, timeout, and the users file path.

### Frontend

- `server/files/index.html`
  Main page markup.

- `server/files/index.js`
  Main frontend logic: app initialization, DOM caching, event binding, session handling, movie loading, rendering movie cards, add movie dialog, and genre filters.

- `server/files/edit.html` and `server/files/edit.js`
  Separate edit window for updating stored movie data.

### CSS

The CSS is split by page responsibility:

- `base.css`
  Global defaults and scrollbar styling.

- `layout.css`
  Page grid, header/footer, sidebar-open state, and session toast.

- `sidebar.css`
  Sidebar layout, movie search, genre filter tags, and sidebar action buttons.

- `dialogs.css`
  Login dialog and add movie dialog.

- `movie-card.css`
  Movie grid, card layout, poster, action menu, genres, metadata, details, tabs, ratings, plot, and credits.

- `edit.css`
  Styling for the edit form page.

## Data Model And Persistence

The project uses JSON files instead of a database.

### Movie Files

Each movie is stored as one JSON file in:

```text
data/movies/
```

The filename is based on the IMDb ID:

```text
data/movies/tt0133093.json
```

Movie objects are normalized before being saved. The stored shape is roughly:

```json
{
  "imdbID": "tt0133093",
  "title": "The Matrix",
  "released": "1999-03-31",
  "runtime": 136,
  "genres": ["Action", "Sci-Fi"],
  "directors": ["Lana Wachowski", "Lilly Wachowski"],
  "actors": ["Keanu Reeves", "Laurence Fishburne"],
  "writers": ["Lana Wachowski", "Lilly Wachowski"],
  "plot": "...",
  "poster": "...",
  "metascore": 73,
  "imdbRating": 8.7
}
```

### User File

Users are stored in:

```text
data/users.json
```

Each user has profile data, a hashed password, and a movie collection.

Normal users store a list of IMDb IDs:

```json
{
  "tobi": {
    "firstName": "Tobias",
    "lastName": "Schmidt",
    "password": "...",
    "movies": ["tt0031381", "tt0133093"]
  }
}
```

The admin user is special:

```json
{
  "admin": {
    "movies": "__all__"
  }
}
```

`"__all__"` means the admin can see all movie files. Admin is excluded from normal add/remove persistence, because admin does not own a normal movie list.

## Movie Cache Logic

At startup, `server.js` calls:

```js
loadAllMovies();
```

This loads movie JSON files from `data/movies` into an in-memory cache in `movie-model.js`.

The cache is organized by username:

```js
movieCache = {
  admin: {
    tt0133093: { ...movie }
  },
  tobi: {
    tt0133093: { ...movie }
  }
}
```

That means the server can quickly return movies for the currently logged-in user.

When a movie file is saved with `saveMovieFile(...)`, the changed movie is also updated in the cache for users who already have that movie.

When a user adds a movie:

1. The server checks whether the user already has it.
2. If the movie file already exists locally, it reuses the local file.
3. If it does not exist locally, it fetches full movie data from OMDb.
4. The movie is normalized and saved to `data/movies/<imdbID>.json`.
5. The IMDb ID is added to the user's `movies` array in `data/users.json`.
6. The in-memory cache is updated.

When a user removes a movie:

1. The IMDb ID is removed from that user's `movies` array.
2. `data/users.json` is written again.
3. The movie is removed from that user's in-memory cache.
4. The movie JSON file itself is not deleted, because another user or admin may still use it.

## Server Endpoints

### Movies

#### `GET /movies`

Returns movies for the current session user. Supports optional filters:

```text
/movies?genre=Action,Sci-Fi&title=matrix
```

Query parameters:

- `genre`: comma-separated list of required genres
- `title`: title substring search

#### `GET /movies/:imdbID`

Requires login. Returns one movie from the current user's collection.

#### `PUT /movies/:imdbID`

Requires login. Saves/updates a movie JSON file.

Used by the edit page.

#### `DELETE /movies/:imdbID`

Requires login. Removes the movie from the current user's collection.

This updates `data/users.json` and the in-memory cache, but does not delete the movie file from `data/movies`.

### OMDb / Add Movie

#### `GET /fetch-movie-suggestions?title=<title>`

Requires login. Searches OMDb by title and returns suggestions.

The response includes `inCollection`, so the frontend can show either Add or Remove from collection.

#### `POST /fetch-new-movie?imdbID=<imdbID>`

Requires login. Adds a movie to the current user's collection.

If the movie is not already stored locally, it fetches the movie from OMDb first.

### Session

#### `POST /login`

Logs in with username and password. Passwords are checked with bcrypt.

#### `GET /logout`

Destroys the current session.

#### `GET /session`

Returns the current session user if logged in, otherwise returns `401`.

## Frontend Logic

The main frontend file is:

```text
server/files/index.js
```

It is structured around:

- `state`
  Holds client-side app state like the current session, active genre filters, available genres, and auto-scroll state.

- `elements`
  Stores cached DOM references so the code does not repeatedly call `document.getElementById(...)`.

- `initApp()`
  Runs after `DOMContentLoaded`, caches DOM elements, binds events, loads the session, and starts auto-scroll.

- `loadMovies()`
  Fetches `/movies` with the current title and genre filters.

- `renderMovieCards(...)`
  Renders movie cards into the movie grid.

- `loadMovieSuggestions()`
  Fetches OMDb suggestions through the server and renders add/remove rows in the add movie dialog.

- `renderGenreFilters()`
  Renders active and available genre filter buttons.

## Naming Conventions

The frontend uses kebab-case IDs and BEM-style class names.

### IDs

IDs are used for unique page elements and JavaScript hooks:

```html
<main id="movie-grid">
<aside id="sidebar">
<dialog id="add-movie-dialog">
<button id="logout-button">
```

### Classes

Classes are used for styling reusable pieces.

The project uses a light BEM-style convention:

```text
block
block__element
block__element--modifier
```

Examples:

```css
.movie-card
.movie-card__menu
.movie-card__menu-button
.movie-card__menu-option--danger

.genre-filter
.genre-filter--active
.genre-filter__remove

.add-movie-result
.add-movie-result__button
.add-movie-result__button--remove
```

State classes use readable state names:

```css
.is-sidebar-closed
.movie-grid--blurred
.session-toast--show
.session-toast--hide
```

## Development Notes

- This project intentionally uses file-based JSON storage instead of a database.
- The app keeps an in-memory cache of movies for faster reads.
- User collection membership is stored in `data/users.json`.
- Movie metadata is stored separately in `data/movies`.
- Admin sees all movies through the special `"__all__"` marker.
- The frontend is intentionally written with plain JavaScript, without a framework.

## Credits

Written by Tobias Schmidt as a web technology university project.

Development assistance and refactoring support were provided with Codex and GitHub Copilot.
