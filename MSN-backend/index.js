const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser');

var app = express()

app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var chat = {
  fuguete: {
    name: 'Fuguete',
    avatar: 'naruto.png',
    messages: {
      assustado: [
        { message: 'Ouuuuuuuu', sent: true },
        { message: 'Fala', sent: false },
        { message: 'Eai', sent: true },
        { message: 'Fez o trabalho?', sent: true },
        { message: 'Não', sent: false }
      ]
    }
  },

  assustado: {
    name: 'Assustado',
    avatar: 'dst.jpg',
    messages: {
      fuguete: [
        { message: 'Ouuuuuuuu', sent: false },
        { message: 'Fala', sent: true },
        { message: 'Eai', sent: false },
        { message: 'Fez o trabalho?', sent: false },
        { message: 'Não', sent: true }
      ]
    }
  }
}

var online = [
  { name: 'Assustado', avatar: 'dst.jpg' },
  { name: 'Fuguete', avatar: 'naruto.png' }
]
var offline = [
  { name: 'Farofa', avatar: 'mario.png' }
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
    chat[id].avatar = avatar
    chat[id].name = name
    res.send(req.body)
  } else {
    chat[id] = {
      name: name,
      avatar: avatar,
      messages: {}
    }
    res.send(req.body)
  }
})

// PEOPLE
app.get('/chat/people', function (req, res) {
  let people = {
    online: online,
    offline: offline
  }
  res.send(people)
})

// GET ALL MESSAGES
app.get('/chat/messages', function (req, res) {
  let myName = req.query.myName.replace(/ /g,'').toLowerCase()
  let yourName = req.query.yourName.replace(/ /g,'').toLowerCase()

  if (!chat[myName].messages[yourName]) {
    chat[myName].messages[yourName] = []
  }
  let messages = chat[myName].messages[yourName]
  res.send(messages)
})

// SENT MESSAGE
app.post('/chat/message', function (req, res) {
  let myName = req.body.myName.replace(/ /g,'').toLowerCase()
  let yourName = req.body.yourName.replace(/ /g,'').toLowerCase()
  let message = req.body.message
  
  if(!online.find(el => {
    return el.name.replace(/ /g,'').toLowerCase() === myName
  })) {
    online.push({
      name: chat[myName].name,
      avatar: chat[myName].avatar
    })
  }

  offline = offline.filter(el => {
    return el.name.replace(/ /g,'').toLowerCase() !== myName
  })

  if (chat[myName].messages[yourName]) {
    chat[myName].messages[yourName].push({ sent: true, message: message })
  } else {
    chat[myName].messages[yourName] = [{ sent: true, message: message }]
  }
  if (chat[yourName].messages[myName]) {
    chat[yourName].messages[myName].push({ sent: false, message: message })
  } else {
    chat[yourName].messages[myName] = [{ sent: false, message: message }]
  }
  res.send(req.body)
})

// GET RECENTS MESSAGES
app.get('/chat/message', function (req, res) {
  let myName = req.query.myName.replace(/ /g,'').toLowerCase()
  let yourName = req.query.yourName.replace(/ /g,'').toLowerCase()
  let index = req.query.index
  
  let messages = chat[myName].messages[yourName].filter((el, i) => {
    return i >= index
  })
  res.send(messages)
})

app.listen(8000, function () {
  console.log('Example app listening on port 8000!')
})