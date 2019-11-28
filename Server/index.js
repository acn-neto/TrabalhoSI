// SERVER AND REQUEST PROPS
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// CRYPTOGRAPHY
const openssl = require('openssl-nodejs');

// READ AND WRITE IN FILES
var fs = require("fs");

// HASH
const bcrypt = require('bcrypt');
const saltRounds = 10;

// SERVER PREPARATIONS
var app = express()

app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// APLICATION PREPARATIONS
var chat = JSON.parse(fs.readFileSync("./db.json", "utf8"))
var online = JSON.parse(fs.readFileSync("./online.json", "utf8"))
var offline = JSON.parse(fs.readFileSync("./offline.json", "utf8"))

if (!chat.certificate) {
  // CREATE PRIVATE KEY
  openssl(['genrsa', '-out', 'myPK.pem'], function (err) {
    console.log('CREATE PK')
    console.log(err.toString())

    // CREATE PUBLIC KEY
    openssl(['rsa', '-in', 'myPK.pem', '-pubout', '-out', 'myPU.pem'], function (err) {
      console.log('CREATE PU')
      console.log(err.toString())
    })
  })
  chat.certificate = true
  fs.writeFileSync("./db.json", JSON.stringify(chat), "utf8")
}

/***************************************************************** APIs *****************************************************************/

// SEND AC CERTIFICATE
app.get('/certificate', function (req, res) {
  res.download('./openssl/myPU.pem', 'ac-pukey.pem')
})

// LOGIN
app.post('/chat/login', function (req, res) {
  let name = req.body.name
  let id = name.replace(/ /g,'').toLowerCase()
  let avatar = req.body.avatar
  let extra = req.body.extra

  // organiza as pessoas onlines e offlines
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

  // atualiza os dados ou caso necessário cria
  if (chat[id]) {
    chat[id].name = name
    chat[id].avatar = avatar
  } else {
    chat[id] = {
      name: name,
      avatar: avatar,
      messages: {}
    }
    if (extra) {
      fs.writeFileSync(`./openssl/${id}-pu.pem`, extra, "utf8")
    }
  }

  // grava todas mudanças
  fs.writeFileSync("./db.json", JSON.stringify(chat), "utf8")
  fs.writeFileSync("./online.json", JSON.stringify(online), "utf8")
  fs.writeFileSync("./offline.json", JSON.stringify(offline), "utf8")

  res.send(req.body)
})

// LOGOUT
app.post('/chat/logout', function (req, res) {
  let name = req.body.name
  let avatar = req.body.avatar

  // organiza as pessoas onlines e offlines
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

  // grava todas mudanças
  fs.writeFileSync("./online.json", JSON.stringify(online), "utf8")
  fs.writeFileSync("./offline.json", JSON.stringify(offline), "utf8")

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

// SENT MESSAGE
app.post('/chat/message', function (req, res) {
  let messageJson = req.body.messageJson
  let emBase64 = req.body.messageHash
  var hashSigned = new Buffer(emBase64, 'base64')
  var id = req.body.id

  fs.writeFileSync("./openssl/hashSigned.txt", hashSigned)
  openssl(['rsautl', '-verify', '-inkey', `${id}-pu.pem`, '-pubin', '-in', 'hashSigned.txt', '-out', 'hashVerified.txt'], function (err) {
    console.log('DECYPHER THE HASH SIGNED')
    console.log(err.toString())

    var messageHash = fs.readFileSync("./openssl/hashVerified.txt", "utf8")

    if(!bcrypt.compareSync(messageJson, messageHash)) {
      res.status(401)
      console.log('INTEGRIDADE COMPROMETIDA')
      res.send('INTEGRIDADE COMPROMETIDA')
    } else {
      let body = JSON.parse(messageJson)
  
      let myName = body.myName.replace(/ /g,'').toLowerCase()
      let yourName = body.yourName.replace(/ /g,'').toLowerCase()
      let message = body.message
    
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
    
      fs.writeFileSync("./db.json", JSON.stringify(chat), "utf8")
    
      res.send(req.body)
    }
  })
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

// RODA O SERVIDOR
app.listen(8000, function () {
  console.log('Example app listening on port 8000!')
})
