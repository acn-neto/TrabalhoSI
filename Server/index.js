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

// RANDOM KEYS IN HEX
const crypto = require('crypto')

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

function randomKey() {
  let len = 32
  return crypto
    .randomBytes(Math.ceil(len / 2))
    .toString('hex')
    .slice(0, len)
}
/***************************************************************** APIs *****************************************************************/

// SEND AC CERTIFICATE
app.get('/certificate', function (req, res) {
  res.download('./openssl/myPU.pem', 'ac-pukey.pem')
})

// GET SYMMETRIC KEY
app.get('/keys', function (req, res) {
  var myName = req.query.myName.replace(/ /g,'').toLowerCase()
  let yourName = req.query.yourName.replace(/ /g,'').toLowerCase()

  if (!chat[myName].keys[yourName] || !chat[myName].ivs[yourName]) {
    chat[myName].keys[yourName] = randomKey()
    chat[yourName].keys[myName] = chat[myName].keys[yourName]
    chat[myName].ivs[yourName] = randomKey()
    chat[yourName].ivs[myName] = chat[myName].ivs[yourName]

    fs.writeFileSync("./db.json", JSON.stringify(chat), "utf8")
  }

  let messageJson = JSON.stringify({ key: chat[myName].keys[yourName], iv: chat[myName].ivs[yourName] })
  fs.writeFileSync("./openssl/theKey.txt", messageJson, "utf8")
  openssl(['rsautl', '-encrypt', '-inkey', `${myName}-pu.pem`, '-pubin', '-in', 'theKey.txt', '-out', 'theKeyCipher.txt'], function (err) {
    console.log('CYPHER THE SYMMETRIC KEY')
    console.log(err.toString())

    var cipherKey = fs.readFileSync("./openssl/theKeyCipher.txt")
    var emBase64 = new Buffer(cipherKey).toString('base64')
    
    res.status(200)
    res.send(emBase64)
  })
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
      messages: {},
      keys: {},
      ivs: {}
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
  let cipherTextEmBase64 = req.body.messageJson
  var cipherText = new Buffer(cipherTextEmBase64, 'base64')

  let hashSignedEmBase64 = req.body.messageHash
  var hashSigned = new Buffer(hashSignedEmBase64, 'base64')

  var myName = req.body.myName
  var yourName = req.body.yourName

  var key = chat[myName].keys[yourName]
  var iv = chat[myName].ivs[yourName]

  fs.writeFileSync("./openssl/cipherText.txt", cipherText)
  openssl(['enc', '-aes-128-cbc', '-pbkdf2', '-d' ,'-in', 'cipherText.txt', '-out', 'plainText.txt', '-K', `${key}`, '-iv', `${iv}`], function (err) {
    console.log('DECIPHER THE MESSAGE')
    console.log(err.toString())

    var messageJson = fs.readFileSync("./openssl/plainText.txt", "utf8")

    fs.writeFileSync("./openssl/hashSigned.txt", hashSigned)
    openssl(['rsautl', '-verify', '-inkey', `${myName}-pu.pem`, '-pubin', '-in', 'hashSigned.txt', '-out', 'hashVerified.txt'], function (err) {
      console.log('DECYPHER THE HASH SIGNED')
      console.log(err.toString())
  
      var messageHash = fs.readFileSync("./openssl/hashVerified.txt", "utf8")
  
      if(!bcrypt.compareSync(cipherTextEmBase64, messageHash)) {
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
