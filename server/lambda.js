'use strict';
const serverless = require('serverless-http');
const app = require('./index');

// Remove the app.listen call when running in Lambda
module.exports.handler = serverless(app);
