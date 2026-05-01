const fs = require('fs');
const config = require("./config.js");

const users = JSON.parse(fs.readFileSync(config.usersFile, 'utf8'));

module.exports = users;
