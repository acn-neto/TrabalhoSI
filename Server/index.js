const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser');
const openssl = require('openssl-nodejs');

var app = express()

app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var chat = {}

var online = [
]
var offline = [
]

// LOGIN
app.post('/chat/login', function (req, res) {
  let name = req.body.name
  let id = name.replace(/ /g,'').toLowerCase()
  let avatar = req.body.avatar

  if(!online.find(el => {
    return el.name.replace(/ /g,'').toLowerCase() === name.replace(/ /g,'').toLowerCase()
  })) {
    online.push({
      name: name,
      avatar: avatar
    })
  }

  offline = offline.filter(el => {
    return el.name.replace(/ /g,'').toLowerCase() !== name.replace(/ /g,'').toLowerCase()
  })

  if (chat[id]) {
    chat[id].name = name
    chat[id].avatar = avatar
  } else {
    chat[id] = {
      name: name,
      avatar: avatar,
      messages: {}
    }
  }

  res.send(req.body)
})

// LOGOUT
app.post('/chat/logout', function (req, res) {
  let name = req.body.name
  let id = name.replace(/ /g,'').toLowerCase()
  let avatar = req.body.avatar

  if(!offline.find(el => {
    return el.name.replace(/ /g,'').toLowerCase() === name.replace(/ /g,'').toLowerCase()
  })) {
    offline.push({
      name: name,
      avatar: avatar
    })
  }

  online = online.filter(el => {
    return el.name.replace(/ /g,'').toLowerCase() !== name.replace(/ /g,'').toLowerCase()
  })

  res.send(req.body)
})

// PEOPLE
app.get('/chat/people', function (req, res) {
  let people = {
    online: online,
    offline: offline
  }
  res.status(200)
  res.send(people)
})

// GET ALL MESSAGES
app.get('/chat/messages', function (req, res) {
  let myName = req.query.myName.replace(/ /g,'').toLowerCase()
  let yourName = req.query.yourName.replace(/ /g,'').toLowerCase()

  if (!chat[myName] || !chat[yourName]) {
    res.status(400)
    res.send('EMISSOR OU RECEPTOR INVALIDO')
  }

  if (!chat[myName].messages[yourName]) {
    chat[myName].messages[yourName] = []
    chat[yourName].messages[myName] = []
  }

  let messages = chat[myName].messages[yourName]
  res.send(messages)
})

// SENT MESSAGE
app.post('/chat/message', function (req, res) {
  let myName = req.body.myName.replace(/ /g,'').toLowerCase()
  let yourName = req.body.yourName.replace(/ /g,'').toLowerCase()
  let message = req.body.message

  if (!chat[myName] || !chat[yourName]) {
    res.status(400)
    res.send('EMISSOR OU RECEPTOR INVALIDO')
  }

  if (!chat[myName].messages[yourName]) {
    chat[myName].messages[yourName] = []
    chat[yourName].messages[myName] = []
  }

  chat[myName].messages[yourName].push({ sent: true, message: message })
  chat[yourName].messages[myName].push({ sent: false, message: message })

  res.send(req.body)
})

// RODA O SERVIDOR
app.listen(8000, function () {
  console.log('Example app listening on port 8000!')
})
