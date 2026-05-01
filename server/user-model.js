const fs = require('fs');
const path = require('path');
const config = require("./config.js");

const users = JSON.parse(fs.readFileSync(config.usersFile, 'utf8'));

module.exports = users;
