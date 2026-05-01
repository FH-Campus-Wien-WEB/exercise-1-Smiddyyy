const express = require('express');
const path = require('path');
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const config = require("./config.js");
const userModel = require("./user-model.js");
const {
  saveMovieFile,
  normalizeMovieData,
  loadAllMovies,
  getAllMovies,
  getMovie,
  addMovieToUserCollection,
  removeMovieFromUserCollection
} = require('./movie-model.js');

const app = express()

// Parse JSON bodies
app.use(bodyParser.json());

// ---------------
// Main server code
// ---------------
// Session middleware
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Serve static content in directory 'files'
app.use(express.static(path.join(__dirname, 'files')));


// ---------------
//  Movies Endpoints
// ---------------
app.get('/movies', function (req, res) {
  const username = req.session.user?.username;

  // accept optional query parameter 'genre' to filter movies by genre (e.g. /movies?genre=Action)
  // can be used multiple times to filter by multiple genres (e.g. /movies?genre=Action,Sci-Fi)
  const genreFilter = req.query.genre;
  const genreFilters = genreFilter
    ? genreFilter.split(',').map(s => s.trim())
    : null;
  if (genreFilters) {
    console.log("Received request for movies with genre filters:", genreFilters);
  }

  // accept optional query parameter 'title' to filter movies by title (e.g. /movies?title=godfather)
  const titleFilter = req.query.title
    ? req.query.title.toLowerCase().trim()
    : null;
  if (titleFilter) {
    console.log("Received request for movies with title filter:", titleFilter);
  }

  // This endpoint will return a list of all movies from in-memory cache (returns json data as list).
  try {
    const movies = getAllMovies(username)
      .filter(movie => {
        // genre filter
        if (genreFilters) {
          const hasAllGenres = genreFilters.every(filter =>
            movie.genres.includes(filter)
          );
          if (!hasAllGenres) return false;
        }

        // title filter
        if (titleFilter) {
          const matchesTitle = movie.title
            .toLowerCase()
            .includes(titleFilter);
          if (!matchesTitle) return false;
        }

        return true;
      }
      );

    res.json(movies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal: failed to read movies' });
  }
});

app.get('/movies/:imdbID', requireLogin, function (req, res) {
  try {
    const username = req.session.user?.username;
    const imdbID = req.params.imdbID;
    const movie = getMovie(username, imdbID);
    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    res.json(movie);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal: failed to read movie' });
  }
});

app.put('/movies/:imdbID', requireLogin, async function (req, res) {
  const imdbID = req.params.imdbID;
  const movie = req.body;

  if (!movie) {
    return res.status(400).json({ error: 'invalid movie data' });
  }

  // Ensure the movie has the correct imdbID
  movie.imdbID = imdbID;

  console.log("Received movie data for update:", movie);

  try {
    // Check if movie exists in cache to determine if update or create
    const existingMovie = getMovie(null, imdbID);
    const fileExists = existingMovie !== null;

    // saveMovieFile also updates the cache
    await saveMovieFile(`${imdbID}.json`, movie);

    if (fileExists) {
      res.status(200).json({ status: 'success', message: 'Movie updated successfully' });
    } else {
      res.status(201).json(movie);
    }
  } catch (err) {
    console.error('Error saving movie:', err);
    res.status(500).json({ error: 'Failed to save movie' });
  }
});

app.delete("/movies/:imdbID", requireLogin, async function (req, res) {
  try {
    const username = req.session.user?.username;
    const imdbID = req.params.imdbID;
    const removed = await removeMovieFromUserCollection(imdbID, username);

    if (!removed) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    res.status(200).json({ status: 'success', msg: 'Movie removed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/fetch-movie-suggestions', requireLogin, async function (req, res) {
  try {
    const username = req.session.user?.username;
    const title = req.query.title;

    if (!title) {
      return res.status(400).send('missing query parameter: title');
    }

    // Call OMDB API
    const apiKey = config.omdbApiKey;

    if (!apiKey) {
      return res.status(500).json({ error: 'internal: OMDb API key not configured' });
    }

    const response = await fetch(
      `https://www.omdbapi.com/?s=${encodeURIComponent(title)}&apikey=${apiKey}`
    );
    const data = await response.json();
    if ('Error' in data) {
      return res.status(404).json(data);
    }

    const result = {}
    data['Search'].forEach(element => {
      result[element.imdbID] = {
        'title': element.Title,
        'year': element.Year,
        'inCollection': getMovie(username, element.imdbID) !== null
      }
    });
    return res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/fetch-new-movie', requireLogin, async function (req, res) {
  //This endpoint will fetch a new movie from the OMDB API and save it to a JSON file.
  try {
    const username = req.session.user?.username;
    const imdbID = req.query.imdbID;
    if (!imdbID) {
      return res.status(400).send('missing query parameter: imdbID');
    }
    const apiKey = config.omdbApiKey;
    if (!apiKey) {
      return res.status(500).json({ error: 'internal: OMDb API key not configured' });
    }

    // check if user already has movie
    if (getMovie(username, imdbID)) {
      return res.status(200).json({ "status": "success", "msg": "Movie already exists" });
    }

    // check if movie exists locally -> if not external api
    var movie = getMovie(null, imdbID)
    if (movie === null) {
      console.log("Movie must be fetched from external source");
      // Call OMDB API
      const response = await fetch(
        `https://www.omdbapi.com/?i=${encodeURIComponent(imdbID)}&apikey=${apiKey}`
      );
      const data = await response.json();

      if (data.Response === 'False') {
        return res.status(404).json({
          error: data.Error // Movie not found});
        });
      }

      // normalize and save movie data to JSON file
      movie = normalizeMovieData(data);

      await saveMovieFile(`${imdbID}.json`, movie);
    }

    // add Movie to Users Movies
    await addMovieToUserCollection(imdbID, movie, username);

    res.status(201).json({ "status": "success", "msg": "Movie added successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------
//  Session Endpoints
// ---------------
function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  return res.status(401).json({ error: "Login required" });
}

app.post("/login", function (req, res) {
  const { username, password } = req.body;
  const user = userModel[username];
  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.user = {
      username,
      firstName: user.firstName,
      lastName: user.lastName,
      loginTime: new Date().toISOString(),
    };
    res.send(req.session.user);
  } else {
    res.sendStatus(401);
  }
});

app.get("/logout", function (req, res) {
  req.session.destroy((err) => {
    if (err) {
      return res.sendStatus(500);
    }
    res.sendStatus(200);
  });
});

app.get("/session", function (req, res) {
  if (req.session.user) {
    res.send(req.session.user);
  } else {
    res.status(401).json(null);
  }
});


// ---------------
// Server startup
// ---------------

async function startServer() {
  // Load all movies into memory at startup
  await loadAllMovies();

  app.listen(config.port);
  console.log(`Server now listening on http://localhost:${config.port}/`);
}

startServer();

