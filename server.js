// server.js
// where your node app starts

// init project
var express = require('express');
var app = express();

// enable CORS (https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)
// so that your API is remotely testable by FCC 
var cors = require('cors');
app.use(cors({ optionsSuccessStatus: 200 }));  // some legacy browsers choke on 204

/*
// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (req, res) {
  res.sendFile(__dirname + '/views/index.html');
}); */

//main page
app.get("/", function (req, res) {
  res.send("Hello World");
})

// your first API endpoint... 
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

  if (/\d{5,}/.test(dateString)) {
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

// listen for requests :)
var listener = app.listen(process.env.PORT || 3000, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
