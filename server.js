'use strict';

var process = require('process'); 
var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var dns = require('dns');
var { URL } = require('url');

var app = express();
// enable CORS (https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)
// so that your API is remotely testable by FCC 
var cors = require('cors');
app.use(cors({ optionsSuccessStatus: 200 }));  // some legacy browsers choke on 204

app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

app.engine('html', require('ejs').renderFile);
app.use('/public', express.static(process.cwd() + '/public'));

// database config
require('dotenv').config()
mongoose.connect(process.env.DB_URI, { useUnifiedTopology: true, useNewUrlParser: true })

mongoose.connection.on("error", function (error) {
  console.log(error)
})

mongoose.connection.on("open", function () {
  console.log("Connected to MongoDB database.")
})

// Create url schema
let urlSchema = new mongoose.Schema({
  id: Number,
  url: String
});

// Create url model
let urlModel = mongoose.model('urls', urlSchema);

/*
// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (req, res) {
  res.sendFile(__dirname + '/views/index.html');
}); */

// your first API endpoint... 
// app.get("/", function (req, res) {
//   res.send("Hello World");
// })

// hello API 
app.get("/api/hello", function (req, res) {
  res.json({ greeting: 'hello API' });
});

//set current timestamp
app.get("/api/timestamp/", (req, res) => {
  res.json({ unix: Date.now(), utc: Date() });
});

//set date
app.get("/api/timestamp/:date_string", (req, res) => {
  let dateString = req.params.date_string;

  if ((/\d{5,}/).test(dateString)) {
    dateInt = parseInt(dateString);
    dateStr = new Date(dateInt).toUTCString()

    if (dateStr != "Invalid Date") {
      res.json({ unix: dateInt, utc: dateStr });
    }
  }

  let dateObject = new Date(dateString);

  if (dateObject.toString() != "Invalid Date") {
    res.json({ unix: dateObject.valueOf(), utc: dateObject.toUTCString() });
  }

  res.json({ error: "Invalid Date" });
});

//set current timestamp
app.get("/api/timestamp/", (req, res) => {
  res.json({ unix: Date.now(), utc: Date() });
});

//header parser
app.get("/api/whoami", function (req, res) {
  res.json({ ipaddress: req.ip, language: req.headers["accept-language"], software: req.get('User-Agent') });
})

// url shortener
app.get("/api/shorturl/", function (req, res) {
  res.render(process.cwd() + '/views/index.html');
});

app.post("/api/shorturl/new",(req,res)=>{
  let newURL;
  try {
    // Convert string to URL
    newURL = new URL(req.body.url);
  } catch (e) {
    // Return error
    res.json({
      error: 'invalid URL'
    });
  }
  console.log(req.body)
  // Check if valid address
  dns.lookup(newURL.hostname, (err, addresses, family) => {
    if (err) {
      // Return error
      res.json({
        error: 'invalid URL'
      });
    } else {
      // Check if url already exists
      urlModel.findOne({
        url: req.body.url
      }, (err, urlFound) => {
        // Return url data
        if (urlFound !== null) {
          res.json({
            original_url: urlFound.url,
            short_url: urlFound.id
          });
        } else {
          // Get url count
          urlModel.count({}, (err, urlCounter) => {
            // Get next id
            let newId = urlCounter + 1;

            // Create new url from post
            let newUrlModel = new urlModel({
              id: newId,
              url: req.body.url
            });

            // Save new url
            newUrlModel.save((err, urlFound) => {
              // Return results
              res.json({
                original_url: urlFound.url,
                short_url: urlFound.id
              });
            });
          });
        }
      });
    }
  });
})

// listen for requests :)
var listener = app.listen(process.env.PORT || 3000, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});