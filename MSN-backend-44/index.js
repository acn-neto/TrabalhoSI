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

    // FAZ CIFRAGEM SIMETRICA
    var key = myChat.keys[yourName]
    var iv = myChat.ivs[yourName]

    fs.writeFileSync("./openssl/plainText.txt", messageJson, "utf8")
    openssl(['enc', '-aes-128-cbc', '-pbkdf2' ,'-in', 'plainText.txt', '-out', 'cipherText.txt', '-K', `${key}`, '-iv', `${iv}`], function (err) {
      console.log('CIPHER THE MESSAGE')
      console.log(err.toString())

      var cipherText = fs.readFileSync("./openssl/cipherText.txt")
      var cipherTextEmBase64 = new Buffer(cipherText).toString('base64')
      

      // FAZ O HASH E ASSINA
      // TESTE DE INTEGRIDADE ****************************************************************************************
      var messageHash = bcrypt.hashSync(cipherTextEmBase64, saltRounds)
    
      fs.writeFileSync("./openssl/hash.txt", messageHash, "utf8")
    
      openssl(['rsautl', '-sign', '-inkey', 'myPK.pem', '-in', 'hash.txt', '-out', 'hashSigned.txt'], function (err) {
        console.log('SIGNING THE HASH')
        console.log(err.toString())
    
        var hashSigned = fs.readFileSync("./openssl/hashSigned.txt")
        var hashEmBase64 = new Buffer(hashSigned).toString('base64')
    
        let myBody = {
          messageJson: cipherTextEmBase64,
          messageHash: hashEmBase64,
          myName: myName,
          yourName: yourName
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

  var getMessages = () => {
    axios.get(`http://localhost:8000/chat/messages?myName=${myName}&yourName=${yourName}`)
      .then(response => {
        var cipherTextsEmBase64 = response.data.messageJson
        var cipherTexts = new Buffer(cipherTextsEmBase64, 'base64')

        var hashsSignedEmBase64 = response.data.messageHash
        var hashsSigned = new Buffer(hashsSignedEmBase64, 'base64')

        var key = myChat.keys[yourName]
        var iv = myChat.ivs[yourName]

        fs.writeFileSync("./openssl/cipherTexts.txt", cipherTexts)
        openssl(['enc', '-aes-128-cbc', '-pbkdf2', '-d' ,'-in', 'cipherTexts.txt', '-out', 'plainTexts.txt', '-K', `${key}`, '-iv', `${iv}`], function (err) {
          console.log('DECIPHER THE MESSAGEs')
          console.log(err.toString())

          var messagesJson = fs.readFileSync("./openssl/plainTexts.txt", "utf8")

          fs.writeFileSync("./openssl/hashsSigned.txt", hashsSigned)
          openssl(['rsautl', '-verify', '-inkey', 'ac-pukey.pem', '-pubin', '-in', 'hashsSigned.txt', '-out', 'hashsVerified.txt'], function (err) {
            console.log('DECYPHER THE HASHs SIGNED')
            console.log(err.toString())

            var messagesHash = fs.readFileSync("./openssl/hashsVerified.txt", "utf8")

            if(!bcrypt.compareSync(cipherTextsEmBase64, messagesHash)) {
              res.status(401)
              console.log('INTEGRIDADE COMPROMETIDA')
              res.send('INTEGRIDADE COMPROMETIDA')
            } else {
              let body = JSON.parse(messagesJson)

              myChat.messages[yourName] = body
              fs.writeFileSync("./db.json", JSON.stringify(myChat), "utf8")
              let messages2 = myChat.messages[yourName].filter((el, i) => {
                return i >= index
              })
              res.send(messages2)
            }
          })
        })
      })
      .catch(error => {
        res.status(400)
        res.send('ERRO AO CONECTAR AO SERVER')
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
          getMessages()
        })
      })
      .catch(error => {
        res.status(400)
        res.send('ERRO AO CONECTAR AO SERVER')
      })
  } else {
    getMessages()
  }
})

// RODA O SERVIDOR
app.listen(8044, function () {
  console.log('Example app listening on port 8044!')
})
