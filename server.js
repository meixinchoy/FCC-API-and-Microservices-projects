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

let exerciseTracker = new mongoose.Schema({
  usersname: String,
  exercise: [{
    description: String,
    duration: Number,
    date: Date
  }]
})

// Create models
let urlModel = mongoose.model('urls', urlSchema);
let trackerModel = mongoose.model('tracker', exerciseTracker)

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
app.post("/api/shorturl/new", (req,res)=>{
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
    }else{
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
app.get("/api/shorturl/:url", (req,res)=>{
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
app.get("/", function (req, res) {
  res.render(process.cwd() + '/views/exercisetracker.html');
});

//add user
app.post("/api/exercise/new-user",(req,res)=>{
  trackerModel.find({username:req.body.username},(err,user)=>{
    if (user.length > 0){
      res.json({
        error:"username already taken"
      })
    }else{
      try{
        let newUser = new trackerModel({ usersname: req.body.username,exercise:[] })
        newUser.save()
        res.json({
          username: req.body.username,
          _id: newUser._id
        })
      }catch(e){
        res.json({
          error: "error saving username"
        })
      }
    }
  })
})

//add exercise
app.post("/api/exercise/add",(req,res)=>{
  try {
    trackerModel.findById(req.body.userId,(err,user)=>{
      if (typeof user === "undefined") {
        return res.json({
          error: "invalid id"
        })
      }
      let date = req.body.date
      if(req.body.date===""){
        date= new Date()
      }
      user.exercise.push({
        description: req.body.description,
        duration: req.body.duration,
        date: date
      })
      user.save();
      res.json({
        _id: user._id,
        username: user.usersname,
        date: date,
        duration: req.body.duration,
        description: req.body.description
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
app.get("/api/exercise/log", (req,res)=>{
  try {
    trackerModel.findById(req.query.userId, (err, user) => {
      if (user === null) {
        return res.json({
          error: "invalid id"
        })
      }else{
        let log = []
        let limit = user.exercise.length
        let count=0
        if (req.query.limit){
          if (req.query.limit < limit){
            limit = req.query.limit
          }
        }
        for (let i = 0; count < limit && i < user.exercise.length; i++) {
          if (req.query.from){
            if (new Date(req.query.from) > user.exercise[i].date){
              continue;
            }
          }   
          if (req.query.to) {
            if (new Date(req.query.to) < user.exercise[i].date) {
              continue;
            }
          }         
          log.push(user.exercise[i])
          count++
        }
        res.json({
          username: user.usersname,
          _id: user._id,
          count: limit,
          log: log
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

app.get("/api/exercise/users",(req,res)=>{
  let users=[]
  trackerModel.find({},(err,results)=>{
    if(err){
      console.error(err)
    }else{
      for (let i=0;i<results.length;i++) {
        users.push({ username: results[i].usersname, _id: results[i]._id })
      }
    }
    res.send(users)
  })
})

// listen for requests :)
var listener = app.listen(process.env.PORT || 3000, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});