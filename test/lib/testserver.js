'use strict';

var fs = require('fs');
var express = require('express');
var app = express();
var morgan = require('morgan');
var cssvalidator = require("./cssvalidator");
var htmlvalidator = require("./htmlvalidator");
var tokenChecker = require("./tokenchecker");
var htmlTemplate = require("./htmltemplate");
var getMetadata = require('./utils').getMetadata;
var draftsSystemPath = require('./utils').draftsSystemPath;
var request = require('request');

var port = (process.env.PORT || 3000) + 1;

var TestServer = function () {};

app.use(morgan('dev', {
  stream: fs.createWriteStream("/tmp/echidna-testserver.log", {flags: 'w'})
}));

app.use(cssvalidator);
app.use(htmlvalidator);
app.use(tokenChecker);

// setup the templating before using express static
app.use(htmlTemplate('/drafts', draftsSystemPath));
app.use('/drafts', express.static(draftsSystemPath));
app.use(express.static('test/views/'));

app.get('/data/specs.json', function(req, res) {
  var specs = [];
  var metadata;
  var listing = fs.readdirSync(draftsSystemPath);

  for (var i in listing) {
    metadata = getMetadata(listing[i]);
    if (metadata) specs.push({id: listing[i], metadata: metadata});
    else throw new Error(
      'Spec “' + listing[i] + '” does not have associated metadata!'
    );
  };

  res.send({specs: specs});
});

app.get('/robots', function(req, res) {
  res.send("<!doctype html><p>Those are not the robots you're looking for.");
});

app.get('/elvis', function(req, res) {
  res.send('<!doctype html><p>Elvis is alive.');
});

// pseudo-endpoint for spec generator
app.get('/generate', function(req, res) {
  var type = (req.query.type || "").toLowerCase();
  var url = req.query.url;

  if (!url || !type) {
    return res.status(500).json({ error: "Both 'type' and 'url' are required." });
  }
  if (type !== "test") {
    return res.status(500).json({ error: "Unknown type '" + type + "'"});
  }

  request(url, function(err, response, body) {
    res.send(body.replace("<title>", "<title>Spec-generated "));
  });
});

var server;

TestServer.start = function () {
  var limit_port = port + 30;

  if (app === undefined) init();

  do {
    server = app.listen(port).on('error', function(err) {
      // Only when there's an error because the port is already in use,
      // we simply continue trying.
      if ('EADDRINUSE' !== err.code) {
        throw new Error('Error while trying to launch the test server: ' + err);
      }
    });
    port += 1;
  } while ((server.address() === null) && (port < limit_port));

  if (server.address() === null) {
    throw new Error("Can't find a free port for the test server " + port);
  }
  // FIXME Do not override a pseudo-constant!
  global.SPEC_GENERATOR = this.location() + '/generate';
};

TestServer.location = function () {
  if (server && server.address()) {
    return "http://localhost:" + server.address().port;
  }
};

// this will return metadata associate with a draft
TestServer.getMetadata = function (name) {
  var data = getMetadata(name);
  if (data.location === undefined) {
    data.location = this.location() + "/drafts/" + name + "/";
  }
  return data;
};

TestServer.start();

module.exports = TestServer;
