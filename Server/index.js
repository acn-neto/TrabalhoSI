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

/***************************************************************** FUNCTIONS *****************************************************************/
var start = (object, arrayCallBack) => {
  // CHAMA PROXIMA ETAPA
  console.log('\n\nSTART')
  if (arrayCallBack.length > 0) {
    let nexCallBack = arrayCallBack[0]
    arrayCallBack.shift()
    nexCallBack(object, arrayCallBack)
  }
}

var removeBase64FromEncryptionMessage64 = (object, arrayCallBack) => {
  // REMOVE BASE64 DA MENSAGEM CIFRADA
  console.log('REMOVE BASE64 FROM ENCRYPTION MESSAGE')
  let encryptionMessage = new Buffer(object.messageBase64, 'base64')
  fs.writeFileSync(`./openssl/${object.id}-encryptionMessages.txt`, encryptionMessage)

  // CHAMA PROXIMA ETAPA
  if (arrayCallBack.length > 0) {
    let nexCallBack = arrayCallBack[0]
    arrayCallBack.shift()
    nexCallBack(object, arrayCallBack)
  }
}

var symmetricDecryptionOfMessages = (object, arrayCallBack) => {
  // DECIFRA AS MENSAGENS
  openssl(['enc', '-aes-128-cbc', '-pbkdf2', '-d' ,'-in', `${object.id}-encryptionMessages.txt`, '-out', `${object.id}-plainMessages.txt`, '-K', `${object.key}`, '-iv', `${object.iv}`], function (err) {
    console.log('DECIPHER THE MESSAGES')
    console.log(err.toString())

    // CHAMA PROXIMA ETAPA
    if (arrayCallBack.length > 0) {
      let nexCallBack = arrayCallBack[0]
      arrayCallBack.shift()
      nexCallBack(object, arrayCallBack)
    }
  })
}

var plainMessagesToJsong = (object, arrayCallBack) => {
  // TRANSFORMA A MENSAGEM EM JSON
  console.log('TRANSFORM JSON MESSAGE TO STRING')
  var messagesString = fs.readFileSync(`./openssl/${object.id}-plainMessages.txt`, "utf8")
  object.messageJson = JSON.parse(messagesString)

  // CHAMA PROXIMA ETAPA
  if (arrayCallBack.length > 0) {
    let nexCallBack = arrayCallBack[0]
    arrayCallBack.shift()
    nexCallBack(object, arrayCallBack)
  }
}

var removeBase64FromSignedHash = (object, arrayCallBack) => {
  // REMOVE BASE64 DO HASH ASSINADO
  console.log('REMOVE BASE64 FROM SIGNED HASH')
  let signedHash = new Buffer(object.signedHashBase64, 'base64')
  fs.writeFileSync(`./openssl/${object.id}-signedHash.txt`, signedHash)

  // CHAMA PROXIMA ETAPA
  if (arrayCallBack.length > 0) {
    let nexCallBack = arrayCallBack[0]
    arrayCallBack.shift()
    nexCallBack(object, arrayCallBack)
  }
}

var verifyTheHashSigned = (object, arrayCallBack) => {
  openssl(['rsautl', '-verify', '-inkey', `${object.id}-pu.pem`, '-pubin', '-in', `${object.id}-signedHash.txt`, '-out', `${object.id}-verifiedHash.txt`], function (err) {
    console.log('VERIFY THE HASHS SIGNED')
    if (err.toString()) {
      console.error(err.toString())
    }
    
    // CHAMA PROXIMA ETAPA
    if (arrayCallBack.length > 0) {
      let nexCallBack = arrayCallBack[0]
      arrayCallBack.shift()
      nexCallBack(object, arrayCallBack)
    }
  })
}

var compareMessageAndHash = (object, arrayCallBack) => {
  // VERIFICA A INTEGRIDADE
  console.log('COMPARE MESSAGE AND HASH')
  var hash = fs.readFileSync(`./openssl/${object.id}-verifiedHash.txt`, "utf8")

  if(!bcrypt.compareSync(object.messageBase64, hash)) {
    object.res.status(401)
    console.log('INTEGRIDADE COMPROMETIDA')
    object.res.send('INTEGRIDADE COMPROMETIDA')
  } else {
    // CHAMA PROXIMA ETAPA
    if (arrayCallBack.length > 0) {
      let nexCallBack = arrayCallBack[0]
      arrayCallBack.shift()
      nexCallBack(object, arrayCallBack)
    }
  }
}

var saveMessage = (object, arrayCallBack) => {
  // SALVA A MENSAGEM
  console.log('SAVE MESSAGE')

  let myName = object.messageJson.myName.replace(/ /g,'').toLowerCase()
  let yourName = object.messageJson.yourName.replace(/ /g,'').toLowerCase()
  let message = object.messageJson.message

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

  console.log('FINISH')
  object.res.send(object.req.body)
}

var jsonMessageToString = (object, arrayCallBack) => {
  // TRANSFORMA A MENSAGEM EM JSON EM STRING
  object.messageJson = JSON.stringify(object.message)
  console.log('TRANSFORM JSON MESSAGE TO STRING')

  // CHAMA PROXIMA ETAPA
  if (arrayCallBack.length > 0) {
    let nexCallBack = arrayCallBack[0]
    arrayCallBack.shift()
    nexCallBack(object, arrayCallBack)
  }
}

var symmetricEncryptionOfMessage = (object, arrayCallBack) => {
  // CIFRA A MENSAGEM
  fs.writeFileSync(`./openssl/${object.id}-plainText.txt`, object.messageJson, "utf8")
  openssl(['enc', '-aes-128-cbc', '-pbkdf2' ,'-in', `${object.id}-plainText.txt`, '-out', `${object.id}-cipherText.txt`, '-K', `${object.key}`, '-iv', `${object.iv}`], function (err) {
    console.log('CYPHER THE STRING MESSAGE')
    if (err.toString()) {
      console.error(err.toString())
    }

    // CHAMA PROXIMA ETAPA
    if (arrayCallBack.length > 0) {
      let nexCallBack = arrayCallBack[0]
      arrayCallBack.shift()
      nexCallBack(object, arrayCallBack)
    }
  })
}

var encryptionMessageToBase64 = (object, arrayCallBack) => {
  // TRANSFORMA MENSAGEM CIFRADA EM BASE64
  console.log('TRANSFORM ENCRYPTION MESSAGE TO BASE64')
  var cipherText = fs.readFileSync(`./openssl/${object.id}-cipherText.txt`)
  object.messageBase64 = new Buffer(cipherText).toString('base64')

  // CHAMA PROXIMA ETAPA
  if (arrayCallBack.length > 0) {
    let nexCallBack = arrayCallBack[0]
    arrayCallBack.shift()
    nexCallBack(object, arrayCallBack)
  }
}

var generateHashFromMessage64 = (object, arrayCallBack) => {
  // GERA O HASH A PARTIR DA MENSAGEM
  console.log('GENERATE HASH FROM MESSAGE BASE64')
  object.messageHash = bcrypt.hashSync(object.messageBase64, saltRounds)
  fs.writeFileSync(`./openssl/${object.id}-hash.txt`, object.messageHash, "utf8")

  // CHAMA PROXIMA ETAPA
  if (arrayCallBack.length > 0) {
    let nexCallBack = arrayCallBack[0]
    arrayCallBack.shift()
    nexCallBack(object, arrayCallBack)
  }
}

var signedTheHashMessage = (object, arrayCallBack) => {
  openssl(['rsautl', '-sign', '-inkey', 'myPK.pem', '-in', `${object.id}-hash.txt`, '-out', `${object.id}-signedHash.txt`], function (err) {
    console.log('SIGNING THE HASH MESSAGE')
    if (err.toString()) {
      console.error(err.toString())
    }

    // CHAMA PROXIMA ETAPA
    if (arrayCallBack.length > 0) {
      let nexCallBack = arrayCallBack[0]
      arrayCallBack.shift()
      nexCallBack(object, arrayCallBack)
    }
  })
}

var signedHashToBase64 = (object, arrayCallBack) => {
  // TRANSFORMA O HASH PARA BASE64
  console.log('TRANSFORME THE HASH IN BASE64')
  let signedHash = fs.readFileSync(`./openssl/${object.id}-signedHash.txt`)
  object.signedHashBase64 = new Buffer(signedHash).toString('base64')

  // CHAMA PROXIMA ETAPA
  if (arrayCallBack.length > 0) {
    let nexCallBack = arrayCallBack[0]
    arrayCallBack.shift()
    nexCallBack(object, arrayCallBack)
  }
}

var sendMessage = (object, arrayCallBack) => {
  let myBody = {
    messageJson: object.messageBase64,
    messageHash: object.signedHashBase64,
  }
  object.res.send(myBody)
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
  let clientPuKey = req.body.puKey

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
    if (clientPuKey) {
      fs.writeFileSync(`./openssl/${id}-pu.pem`, clientPuKey, "utf8")
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
  let steps = [
    removeBase64FromEncryptionMessage64,
    symmetricDecryptionOfMessages,
    plainMessagesToJsong,
    removeBase64FromSignedHash,
    verifyTheHashSigned,
    compareMessageAndHash,
    saveMessage
  ]

  let object = {
    id: req.body.myName,
    myName: req.body.myName,
    yourName: req.body.yourName,
    messageJson: '',
    key: chat[req.body.myName].keys[req.body.yourName],
    iv: chat[req.body.myName].ivs[req.body.yourName],
    messageBase64: req.body.messageJson,
    signedHashBase64: req.body.messageHash,
    res: res,
    req: req
  }

  start(object, steps)
})

// GET ALL MESSAGES
app.get('/chat/messages', function (req, res) {
  let myName = req.query.myName.replace(/ /g,'').toLowerCase()
  let yourName = req.query.yourName.replace(/ /g,'').toLowerCase()

  if (!chat[myName] || !chat[yourName]) {
    res.status(400)
    res.send('EMISSOR OU RECEPTOR INVALIDO')
  }

  if (!chat[myName].keys[yourName] || !chat[myName].ivs[yourName]) {
    res.status(400)
    res.send('NAO EXISTE CHAVE SIMETRICA!')
  }

  if (!chat[myName].messages[yourName]) {
    chat[myName].messages[yourName] = []
    chat[yourName].messages[myName] = []
  }

  let steps = [
    jsonMessageToString,
    symmetricEncryptionOfMessage,
    encryptionMessageToBase64,
    generateHashFromMessage64,
    signedTheHashMessage,
    signedHashToBase64,
    sendMessage
  ]

  let object = {
    id: myName,
    myName: myName,
    yourName: yourName,
    message: chat[myName].messages[yourName],
    messageJson: '',
    key: chat[myName].keys[yourName],
    iv: chat[myName].ivs[yourName],
    messageBase64: '',
    messageHash: '',
    signedHashBase64: '',
    res: res,
    req: req
  }

  start(object, steps)
})

// RODA O SERVIDOR
app.listen(8000, function () {
  console.log('Example app listening on port 8000!')
})
