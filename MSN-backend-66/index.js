// SERVER AND REQUEST PROPS
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// REQUEST TO SERVER
const axios = require('axios');

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
var myChat = JSON.parse(fs.readFileSync("./db.json", "utf8"))

if (!myChat.certificate) {
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
  myChat.certificate = true
  fs.writeFileSync("./db.json", JSON.stringify(myChat), "utf8")
}

// GET THE AC CERTIFICATE
axios.get('http://localhost:8000/certificate')
.then(function(response) {
  fs.writeFileSync("./openssl/ac-pukey.pem", response.data, "utf8")
})
.catch(function(error) {
  console.log(error);
});



/***************************************************************** APIs *****************************************************************/

// LOGIN
app.post('/chat/login', function (req, res) {
  let extra = ''

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
    myChat.ivs = {}
    myChat.keys = {}
    fs.writeFileSync("./db.json", JSON.stringify(myChat), "utf8")

    extra = fs.readFileSync("./openssl/myPU.pem", "utf8")
  }
  
  axios.post('http://localhost:8000/chat/login', {
      name: req.body.name,
      avatar: req.body.avatar,
      extra: extra
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
  var myName = req.body.myName.replace(/ /g,'').toLowerCase()
  var yourName = req.body.yourName.replace(/ /g,'').toLowerCase()
  var chatName = myChat.name.replace(/ /g,'').toLowerCase()
  var message = req.body.message

  // CONECTOU NO BACKEND ERRADO
  if (myName !== chatName) {
    res.status(400)
    res.send('WRONG BACKEND')
  }

  var sendMessage = () => {
    let messageJson = JSON.stringify({
      myName: myName,
      yourName: yourName,
      message: message
    })
  
    // TESTE DE INTEGRIDADE
    let FAKEmessageJson = JSON.stringify({
      myName: myName,
      yourName: yourName,
      message: message + 'BATATA'
    })
  
    var messageHash = bcrypt.hashSync(messageJson, saltRounds)
  
    fs.writeFileSync("./openssl/hash.txt", messageHash, "utf8")
  
    openssl(['rsautl', '-sign', '-inkey', 'myPK.pem', '-in', 'hash.txt', '-out', 'hashSigned.txt'], function (err) {
      console.log('SIGNING THE HASH')
      console.log(err.toString())
  
      var hashSigned = fs.readFileSync("./openssl/hashSigned.txt")
      var emBase64 = new Buffer(hashSigned).toString('base64')
  
      let myBody = {
        // TESTE DE INTEGRIDADE ****************************************************************************************
        // messageJson: FAKEmessageJson,
        messageJson: messageJson,
        messageHash: emBase64,
        id: myName
      }
      axios.post('http://localhost:8000/chat/message', myBody)
        .then(response => {
          res.send(req.body)
        })
        .catch(error => {
          res.status(400)
          res.send('ERRO AO CONECTAR AO SERVER')
        })
    })
  }

  if (!myChat.keys[yourName] || !myChat.ivs[yourName]) {
    axios.get(`http://localhost:8000/keys?myName=${myName}&yourName=${yourName}`)
      .then(response => {
        let emBase64 = response.data
        var cipherKey = new Buffer(emBase64, 'base64')
  
        fs.writeFileSync("./openssl/theKeyCipher.txt", cipherKey)
  
        openssl(['rsautl', '-decrypt', '-inkey', 'myPK.pem', '-in', 'theKeyCipher.txt', '-out', 'theKey.txt'], function (err) {
          console.log('DECIPHER THE SYMMETRIC KEY')
          console.log(err.toString())

          let messageJson = fs.readFileSync("./openssl/theKey.txt", "utf8")
          let body = JSON.parse(messageJson)

          myChat.keys[yourName] = body.key
          myChat.ivs[yourName] = body.iv
          fs.writeFileSync("./db.json", JSON.stringify(myChat), "utf8")
          sendMessage()
        })
      })
      .catch(error => {
        res.status(400)
        res.send('ERRO AO CONECTAR AO SERVER')
      })
  } else {
    sendMessage()
  }
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
      fs.writeFileSync("./db.json", JSON.stringify(myChat), "utf8")
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
app.listen(8066, function () {
  console.log('Example app listening on port 8066!')
})
