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

// GET THE AC PUBLIC KEY
axios.get('http://localhost:8000/certificate')
.then(function(response) {
  fs.writeFileSync("./openssl/ac-pukey.pem", response.data, "utf8")
})
.catch(function(error) {
  console.log(error)
});

/*************************************************************** FUNCTIONS ***************************************************************/
var start = (object, arrayCallBack) => {
  // CHAMA PROXIMA ETAPA
  console.log('\n\nSTART')
  if (arrayCallBack.length > 0) {
    let nexCallBack = arrayCallBack[0]
    arrayCallBack.shift()
    nexCallBack(object, arrayCallBack)
  }
}

var jsonMessageToString = (object, arrayCallBack) => {
  // TRANSFORMA A MENSAGEM EM JSON EM STRING
  object.messageJson = JSON.stringify({
    myName: object.myName,
    yourName: object.yourName,
    message: object.message
  })
  console.log('TRANSFORM JSON MESSAGE TO STRING')

  // CHAMA PROXIMA ETAPA
  if (arrayCallBack.length > 0) {
    let nexCallBack = arrayCallBack[0]
    arrayCallBack.shift()
    nexCallBack(object, arrayCallBack)
  }
}

var getSymmetricKeyIfNecessary = (object, arrayCallBack) => {
  // PEGA CHAVE SIMETRICA SE NECESSARIO
  console.log('GET SYMMETRIC KEY, IF NECESSARY')
  if (!object.key || !object.iv) {
    axios.get(`http://localhost:8000/keys?myName=${object.myName}&yourName=${object.yourName}`)
      .then(response => {
        let emBase64 = response.data
        var cipherKey = new Buffer(emBase64, 'base64')
  
        fs.writeFileSync("./openssl/theKeyCipher.txt", cipherKey)
  
        openssl(['rsautl', '-decrypt', '-inkey', 'myPK.pem', '-in', 'theKeyCipher.txt', '-out', 'theKey.txt'], function (err) {
          console.log('DECIPHER THE SYMMETRIC KEY')
          if (err.toString()) {
            console.error(err.toString())
          }

          let messageJson = fs.readFileSync("./openssl/theKey.txt", "utf8")
          let body = JSON.parse(messageJson)

          myChat.keys[object.yourName] = body.key
          myChat.ivs[object.yourName] = body.iv
          fs.writeFileSync("./db.json", JSON.stringify(myChat), "utf8")

          object.key = myChat.keys[object.yourName]
          object.iv = myChat.ivs[object.yourName]

          // CHAMA PROXIMA ETAPA
          if (arrayCallBack.length > 0) {
            let nexCallBack = arrayCallBack[0]
            arrayCallBack.shift()
            nexCallBack(object, arrayCallBack)
          }
        })
      })
      .catch(error => {
        object.res.status(400)
        object.res.send('ERRO AO CONECTAR AO SERVER')
      })
  } else {
    // CHAMA PROXIMA ETAPA
    if (arrayCallBack.length > 0) {
      let nexCallBack = arrayCallBack[0]
      arrayCallBack.shift()
      nexCallBack(object, arrayCallBack)
    }
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
    myName: object.myName,
    yourName: object.yourName,
    messageJson: object.messageBase64,
    messageHash: object.signedHashBase64,
  }
  axios.post('http://localhost:8000/chat/message', myBody)
    .then(response => {
      object.res.send(object.req.body)
      console.log('FINISH')
    })
    .catch(error => {
      object.res.status(400)
      object.res.send('ERRO AO CONECTAR AO SERVER')
    })
}

var getMessage = (object, arrayCallBack) => {
  // PEGA AS MENSAGENS DO SERVIDOR
  axios.get(`http://localhost:8000/chat/messages?myName=${object.myName}&yourName=${object.yourName}`)
    .then(response => {
      object.messageBase64 = response.data.messageJson
      object.signedHashBase64 = response.data.messageHash

      // CHAMA PROXIMA ETAPA
      if (arrayCallBack.length > 0) {
        let nexCallBack = arrayCallBack[0]
        arrayCallBack.shift()
        nexCallBack(object, arrayCallBack)
      }
    })
    .catch(error => {
      object.res.status(400)
      object.res.send('ERRO AO CONECTAR AO SERVER')
    })
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
  openssl(['rsautl', '-verify', '-inkey', 'ac-pukey.pem', '-pubin', '-in', `${object.id}-signedHash.txt`, '-out', `${object.id}-verifiedHash.txt`], function (err) {
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

  myChat.messages[object.yourName] = object.messageJson
  fs.writeFileSync("./db.json", JSON.stringify(myChat), "utf8")
  let messages2 = myChat.messages[object.yourName].filter((el, i) => {
    return i >= object.index
  })
  console.log('FINISH')
  object.res.send(messages2)
}
/***************************************************************** APIs *****************************************************************/

// LOGIN
app.post('/chat/login', function (req, res) {
  let puKey = ''

  // VERIFY IF EXISTS ONE PERSON REGISTERED
  if (myChat.name) {
    let myName = req.body.name.replace(/ /g,'').toLowerCase()
    let chatName = myChat.name.replace(/ /g,'').toLowerCase()
  
    // CONECTOU NO BACKEND ERRADO
    if (myName !== chatName) {
      res.status(400)
      res.send('WRONG BACKEND')
    }
  }

  // INITIALIZES THE CLIENT INFORMATIONS
  else {
    myChat.name = req.body.name
    myChat.avatar = req.body.avatar
    myChat.messages = {}
    myChat.ivs = {}
    myChat.keys = {}
    fs.writeFileSync("./db.json", JSON.stringify(myChat), "utf8")

    puKey = fs.readFileSync("./openssl/myPU.pem", "utf8")
  }
  
  // SEND MESSAGE TO SERVER - LOGIN
  axios.post('http://localhost:8000/chat/login', {
      name: req.body.name,
      avatar: req.body.avatar,
      // CLIENT PU KEY
      puKey: puKey
    })
    .then(response => {
      res.send(req.body)
    })
    .catch(error => {
      console.log(error)
      res.status(400)
      res.send('ERRO AO CONECTAR AO SERVER')
    })
})

// LOGOUT
app.post('/chat/logout', function (req, res) {
  let myName = req.body.name.replace(/ /g,'').toLowerCase()
  let chatName = myChat.name.replace(/ /g,'').toLowerCase()

  // NAO EXISTE INFORMAÇÃO NO BACK
  if (chatName) {
    res.status(400)
    res.send('NENHUMA PESSOA CADASTRADA NO BACK')
  }

  // CONECTOU NO BACKEND ERRADO
  if (myName !== chatName) {
    res.status(400)
    res.send('WRONG BACKEND')
  }

  // SEND MESSAGE TO SERVER - LOGOUT
  axios.post('http://localhost:8000/chat/logout', {
      name: req.body.name,
      avatar: req.body.avatar
    })
    .then(response => {
      res.end()
    })
    .catch(error => {
      console.log(error)
      res.end()
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
  // EXTRAIR INFORMAÇÕES DO BODY
  var myName = req.body.myName.replace(/ /g,'').toLowerCase()
  var yourName = req.body.yourName.replace(/ /g,'').toLowerCase()
  var chatName = myChat.name.replace(/ /g,'').toLowerCase()
  var message = req.body.message

  // VERIFICA SE ESTÁ NO BACKEND CERTO
  if (myName !== chatName) {
    res.status(400)
    res.send('WRONG BACKEND')
  }

  let steps = [
    jsonMessageToString,
    getSymmetricKeyIfNecessary,
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
    message: message,
    messageJson: '',
    key: myChat.keys[yourName] || '',
    iv: myChat.ivs[yourName] || '',
    messageBase64: '',
    messageHash: '',
    signedHashBase64: '',
    res: res,
    req: req
  }

  start(object, steps)
})

// GET ALL MESSAGES IN BACKEND
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

// GET RECENTS MESSAGES IN SERVER
app.get('/chat/message', function (req, res) {
  // EXTRAIR INFORMAÇÕES DO BODY
  let myName = req.query.myName.replace(/ /g,'').toLowerCase()
  let yourName = req.query.yourName.replace(/ /g,'').toLowerCase()
  let chatName = myChat.name.replace(/ /g,'').toLowerCase()
  let index = req.query.index

  // VERIFICA SE ESTÁ NO BACKEND CERTO
  if (myName !== chatName) {
    res.status(400)
    res.send('WRONG BACKEND')
  }
  
  let steps = [
    getSymmetricKeyIfNecessary,
    getMessage,
    removeBase64FromEncryptionMessage64,
    symmetricDecryptionOfMessages,
    plainMessagesToJsong,
    removeBase64FromSignedHash,
    verifyTheHashSigned,
    compareMessageAndHash,
    saveMessage
  ]

  let object = {
    id: myName,
    myName: myName,
    yourName: yourName,
    index: index,
    messageJson: '',
    key: myChat.keys[yourName] || '',
    iv: myChat.ivs[yourName] || '',
    messageBase64: '',
    messageHash: '',
    signedHashBase64: '',
    res: res,
    req: req
  }

  start(object, steps)
})

// RODA O SERVIDOR
app.listen(8066, function () {
  console.log('Example app listening on port 8066!')
})
