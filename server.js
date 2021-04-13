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

// Create schemas
let urlSchema = new mongoose.Schema({
  id: Number,
  url: String
});

let exerciseUser = new mongoose.Schema({
  username: String
})

let exercises = new mongoose.Schema({
  userId: String,
  description: String,
  duration: Number,
  date: Date
})

// Create models
let urlModel = mongoose.model('urls', urlSchema);
let trackerModel = mongoose.model('exercisetracker', exercises)
let exerciseUserModel = mongoose.model('exerciseUser', exerciseUser)

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


/*
TIMESTAMP MICROSERVICE
*/
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


/*
HEADER PARSER MICROSERVICE
*/
app.get("/api/whoami", function (req, res) {
  res.json({ ipaddress: req.ip, language: req.headers["accept-language"], software: req.get('User-Agent') });
})


/*
URL SHORTENER MICROSERVICE
*/
// render html page 
//Change route to "/" when submitting to fcc
app.get("/api/shorturl/", function (req, res) {
  res.render(process.cwd() + '/views/shorturl.html');
});

// create and save shortened url to MDB
app.post("/api/shorturl/new", (req, res) => {
  let newURL;
  try {
    // Convert string to URL
    newURL = new URL(req.body.url);
  } catch (e) {
    // Return error
    res.json({
      error: 'invalid url'
    });
  }
  // Check if valid address
  dns.lookup(newURL.hostname, (err, addresses, family) => {
    const httpRegex = new RegExp('^(http|https)(://)');
    if (!httpRegex.test(req.body.url)) {
      res.json({ error: 'invalid url' })
    } else {
      if (err) {
        // Return error
        res.json({
          error: 'invalid url'
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
              short_url: urlFound.id,
              new_url: process.env.baseURL + urlFound.id
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
                  short_url: urlFound.id,
                  new_url: process.env.baseURL + urlFound.id
                });
              });
            });
          }
        });
      }
    }
  });
})

//redirect from shortened url to actual page
app.get("/api/shorturl/:url", (req, res) => {
  urlModel.findOne({
    id: req.params.url
  }, (err, data) => {
    if (!data) {
      // Send error message
      res.json({
        error: 'invalid url'
      });
    } else {
      // Redirect to url
      res.redirect(data.url);
    }
  })
})


/*
EXERCISE TRACKER MICROSERVICE
*/
// render html page 
//Change route to "/" when submitting to fcc
app.get("/api/exercise/", function (req, res) {
  res.render(process.cwd() + '/views/exercisetracker.html');
});

//add user
app.post("/api/exercise/new-user", (req, res) => {
  exerciseUserModel.find({ username: req.body.username }, (err, user) => {
    if (user.length > 0) {
      res.json({
        error: "username already taken"
      })
    } else {
      try {
        let newUser = new exerciseUserModel({ username: req.body.username })
        newUser.save()
        res.json({
          username: newUser.username,
          _id: newUser._id
        })
      } catch (e) {
        res.json({
          error: "error saving username"
        })
      }
    }
  })
})

//add exercise
app.post("/api/exercise/add", (req, res) => {
  try {
    exerciseUserModel.findById(req.body.userId, (err, user) => {
      if (err) {
        res.json({
          error: "error saving username"
        })
      }
      if (typeof user === "undefined") {
        return res.json({
          error: "invalid id"
        })
      }
      let date = !req.body.date ? new Date() : new Date(req.body.date);
      if (date instanceof Date && isNaN(date)) {
        return res.json({ Error: 'Please enter valid date in format [YYYY-MM-DD]' });
      }
      let exercise = new trackerModel({
        userId: req.body.userId,
        description: req.body.description,
        duration: parseInt(req.body.duration),
        date: date.toDateString()
      })
      exercise.save().then(item => {
        res.json({
          _id: user._id,
          username: user.username,
          date: date.toDateString(),
          duration: parseInt(req.body.duration),
          description: req.body.description
        })
      })
    });
  } catch (error) {
    console.error(error)
    res.json({
      error: "error saving username"
    })
  }
})

//show record
app.get("/api/exercise/log", (req, res) => {
  try {
    exerciseUserModel.findById(req.query.userId, (err, user) => {
      if (user === null) {
        return res.json({
          error: "invalid id"
        })
      } else {
        trackerModel.find({ userId: req.query.userId }, (err, logs) => {
          let count = 0
          let limit = logs.length
          if (req.query.limit) {
            if (req.query.limit < limit) {
              limit = req.query.limit
            }
          }
          let fromdate = new Date(req.query.from)
          let todate = new Date(req.query.to)
          for (let i = 0; i < logs.length; i++) {
            if (req.query.from) {
              if (fromdate > logs[i].date) {
                logs.splice(i, 1)
                i--
                continue;
              }
            }
            if (req.query.to) {
              if (todate < logs[i].date) {
                logs.splice(i, 1)
                i--
                continue;
              }
            }
            if (count >= limit) {
              logs.splice(i, logs.length - i)
              break;
            }
            count++
          }
          res.json({
            _id: user._id,
            username: user.username,
            count: count,
            log: logs
          })
        })
      }
    });
  } catch (error) {
    console.error(error)
    res.json({
      error: "error showing logs"
    })
  }
})

app.get("/api/exercise/users", (req, res) => {
  let u = []
  exerciseUserModel.find({}, (err, results) => {
    if (err) {
      console.error(err)
    } else {
      for (let i = 0; i < results.length; i++) {
        u.push({ _id: results[i]._id, username: results[i].username })
      }
    }
    res.send(u)
  })
})



/*
FILE METADATA MICROSERVICE
*/
var multer = require('multer')
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
var upload = multer({ storage: storage })
// render html page 
//Change route to "/" when submitting to fcc
app.get("/", function (req, res) {
  res.render(process.cwd() + '/views/filemetadata.html');
});

app.post('/api/fileanalyse', upload.single('upfile'), function (req, res, next) {
  // display file details
  res.json({ name: req.file.originalname, type: req.file.mimetype, size: req.file.size })
})

// listen for requests :)
var listener = app.listen(process.env.PORT || 3000, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});