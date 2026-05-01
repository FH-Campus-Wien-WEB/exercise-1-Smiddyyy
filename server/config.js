// Load .env file into process.env
require('dotenv').config();

// Load configuration from environment variables
module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  omdbApiKey: process.env.OMDB_API_KEY || '',
  sessionSecret: process.env.SESSION_SECRET,
  usersFile: 'data/users.json',
  omdbTimeoutMs: 5000 // 5 second timeout for external API calls
};
