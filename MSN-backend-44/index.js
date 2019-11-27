const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser');
const openssl = require('openssl-nodejs');
const axios = require('axios');

var app = express()

app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var myChat = {}

// LOGIN
app.post('/chat/login', function (req, res) {
  if (myChat.name) {
    let myName = req.body.name.replace(/ /g,'').toLowerCase()
    let chatName = myChat.name.replace(/ /g,'').toLowerCase()
  
    // CONECTOU NO BACKEND ERRADO
    if (myName !== chatName) {
      res.status(400)
      res.send('WRONG BACKEND')
    }
  } else {
    myChat.name = req.body.name
    myChat.avatar = req.body.avatar
    myChat.messages = {}
  }
  
  axios.post('http://localhost:8000/chat/login', {
      name: req.body.name,
      avatar: req.body.avatar
    })
    .then(response => {
      res.send(req.body)
    })
    .catch(error => {
      res.status(400)
      res.send('ERRO AO CONECTAR AO SERVER')
    })
})

// LOGOUT
app.post('/chat/logout', function (req, res) {
  let myName = req.body.name.replace(/ /g,'').toLowerCase()
  let chatName = myChat.name.replace(/ /g,'').toLowerCase()

  // CONECTOU NO BACKEND ERRADO
  if (myName !== chatName) {
    res.status(400)
    res.send('WRONG BACKEND')
  }

  axios.post('http://localhost:8000/chat/logout', {
      name: req.body.name,
      avatar: req.body.avatar
    })
    .then(response => {
      res.send(req.body)
    })
    .catch(error => {
      res.status(400)
      res.send('ERRO AO CONECTAR AO SERVER')
    })
})

// PEOPLE
app.get('/chat/people', function (req, res) {
  axios.get('http://localhost:8000/chat/people')
    .then(response => {
      res.send(response.data)
    })
    .catch(error => {
      console.log(error)
      res.status(400)
      res.send('ERRO AO CONECTAR AO SERVER')
    })
})

// SENT MESSAGE
app.post('/chat/message', function (req, res) {
  let myName = req.body.myName.replace(/ /g,'').toLowerCase()
  let yourName = req.body.yourName.replace(/ /g,'').toLowerCase()
  let chatName = myChat.name.replace(/ /g,'').toLowerCase()
  let message = req.body.message

  // CONECTOU NO BACKEND ERRADO
  if (myName !== chatName) {
    res.status(400)
    res.send('WRONG BACKEND')
  }

  axios.post('http://localhost:8000/chat/message', {
      myName: myName,
      yourName: yourName,
      message: message
    })
    .then(response => {
      res.send(req.body)
    })
    .catch(error => {
      res.status(400)
      res.send('ERRO AO CONECTAR AO SERVER')
    })
})

// GET ALL MESSAGES
app.get('/chat/messages', function (req, res) {
  let myName = req.query.myName.replace(/ /g,'').toLowerCase()
  let yourName = req.query.yourName.replace(/ /g,'').toLowerCase()
  let chatName = myChat.name.replace(/ /g,'').toLowerCase()

  // CONECTOU NO BACKEND ERRADO
  if (myName !== chatName) {
    res.status(400)
    res.send('WRONG BACKEND')
  }

  // CASO NÃO EXISTA MENSAGEM INICIALIZA O VETOR
  if (!myChat.messages[yourName]) {
    myChat.messages[yourName] = []
  }
  
  // ENVIA AS MENSAGENS EXISTENTES
  let messages = myChat.messages[yourName]
  res.send(messages)
})

// GET RECENTS MESSAGES
app.get('/chat/message', function (req, res) {
  let myName = req.query.myName.replace(/ /g,'').toLowerCase()
  let yourName = req.query.yourName.replace(/ /g,'').toLowerCase()
  let chatName = myChat.name.replace(/ /g,'').toLowerCase()
  let index = req.query.index

  // CONECTOU NO BACKEND ERRADO
  if (myName !== chatName) {
    res.status(400)
    res.send('WRONG BACKEND')
  }

  axios.get(`http://localhost:8000/chat/messages?myName=${myName}&yourName=${yourName}`)
    .then(response => {
      myChat.messages[yourName] = response.data
      let messages = myChat.messages[yourName].filter((el, i) => {
        return i >= index
      })
      res.send(messages)
    })
    .catch(error => {
      res.status(400)
      res.send('ERRO AO CONECTAR AO SERVER')
    })
})

// RODA O SERVIDOR
app.listen(8044, function () {
  console.log('Example app listening on port 8044!')
})