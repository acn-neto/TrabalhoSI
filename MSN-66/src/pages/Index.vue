<template>
  <q-layout view="hHh LpR fFf">
    <q-header bordered>
      <q-resize-observer @resize="onResizeHeader" />
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="drawer = !drawer"/>

        <q-toolbar-title>
          <div class="row">
            <!-- AVATAR -->
            <q-btn flat round dense class="q-mr-md" :disable="online">
              <q-avatar class="bg-grey-2">
                <img :src="`../statics/avatar/${myAvatar}`">
              </q-avatar>

              <q-popup-proxy>
                <q-card class="bg-grey-10 q-pb-md">
                  <!-- HEADER -->
                  <div class="row text-h6 text-white q-px-lg q-py-sm bg-secondary"> Escolha seu avatar:</div>

                  <!-- BODY -->
                  <q-card-section>
                    <div class="row q-col-gutter-md">
                      <div class="col-4 text-center" v-for="(elem, index) in avatar" :key="index">
                        <q-btn flat round color="black" @click="setAvatar(elem)" v-close-popup>
                          <q-avatar class="bg-grey-2">
                            <img :src="`../statics/avatar/${elem}`">
                          </q-avatar>
                        </q-btn>
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
              </q-popup-proxy>
            </q-btn>

            <!-- NAME AND LOGIN BUTTON-->
            <q-input square bg-color="grey-3" standout="bg-grey-4 text-black" input-class="text-black" v-model="name" label="Nome" dense maxlength="15" :disable="online"/>
            <q-btn color="positive" label="ENTRAR" class="q-py-sm no-border-radius" @click="enterInChat" :disable="online"/>
          </div>
        </q-toolbar-title>

        <div class="row items-center" v-if="online">
          <q-btn round size="5px" color="positive" class="q-mr-sm" />
          <div class="text-h6">Online</div>
        </div>

        <div class="row items-center" v-else>
          <q-btn round size="5px" color="negative" class="q-mr-sm" />
          <div class="text-h6">Offline</div>
        </div>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="drawer"
      bordered
      :width="200"
      show-if-above
      content-class="bg-grey-9">

      <q-list dark>
        <!-- ONLINE -->
        <q-expansion-item expand-separator dense default-opened>
          <template v-slot:header>
            <q-item-section avatar>
              <q-btn round size="5px" color="positive" class="q-mr-sm" />
            </q-item-section>

            <q-item-section>
              <div class="text-white">Online</div>
            </q-item-section>
          </template>

          <q-item clickable v-for="(el, index) in people.online" :key="`online${index}`" class="bg-grey-7" @click="getAllMessages(el)">
            <q-item-section avatar>
              <q-avatar class="bg-grey-2">
                <img :src="`../statics/avatar/${el.avatar}`">
              </q-avatar>
            </q-item-section>

            <q-item-section>
              <q-item-label>{{ el.name }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-expansion-item>

        <!-- OFFLINE -->
        <q-expansion-item expand-separator dense>
          <template v-slot:header>
            <q-item-section avatar>
              <q-btn round size="5px" color="negative" class="q-mr-sm" />
            </q-item-section>

            <q-item-section>
              <div class="text-white">Offline</div>
            </q-item-section>
          </template>

          <q-item clickable v-for="(el, index) in people.offline" :key="`offline${index}`" class="bg-grey-7" @click="getAllMessages(el)">
            <q-item-section avatar>
              <q-avatar class="bg-grey-2">
                <img :src="`../statics/avatar/${el.avatar}`">
              </q-avatar>
            </q-item-section>

            <q-item-section>
              <q-item-label>{{ el.name }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-expansion-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <q-page class="row items-end bg-grey-2">
        <!-- MSN CHAT -->
        <q-scroll-area
          class="row full-width q-pa-md"
          :thumb-style="{
            right: '2px',
            borderRadius: '5px',
            backgroundColor: '#333',
            width: '10px',
            opacity: 0.75
          }"
          :style="`height: calc(100vh - ${chatHeight}px);`"
          ref="chat">

          <div class="col-12" v-for="(el, index) in messages" :key="`message${index}`">
            <q-chat-message
              v-if="el.sent"
              :name="name"
              :avatar="`../statics/avatar/${myAvatar}`"
              :text="[el.message]"
              sent
              bg-color="positive"/>
            <q-chat-message
              v-else
              :name="yourName"
              :avatar="`../statics/avatar/${yourAvatar}`"
              :text="[el.message]"
              bg-color="grey-5"/>
          </div>
        </q-scroll-area>

        <!-- INPUT TEXT - MESSAGE -->
        <div class="row full-width">
          <q-resize-observer @resize="onResizeInput" />
          <q-input
            class="full-width"
            v-model="message"
            bg-color="grey-3"
            standout="bg-grey-9 text-white"
            autogrow
            @keyup.enter="sendMessage">

            <template v-slot:append>
              <q-btn round dense flat icon="send" @click.stop="sendMessage"/>
            </template>
          </q-input>
      </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script>
export default {
  name: 'MSN',

  data () {
    return {
      drawer: false,
      headerHeight: 0,
      inputHeight: 0,

      online: false,

      name: null,
      myAvatar: 'mario.png',
      avatar: [
        'dst.jpg',
        'lol.jpg',
        'mario.png',
        'naruto.png',
        'sonic.png',
        'sp.png'
      ],

      yourName: null,
      yourAvatar: null,

      message: null,
      messages: [],

      people: {
        online: [],
        offline: []
      }
    }
  },

  computed: {
    chatHeight () {
      return (this.headerHeight + this.inputHeight)
    }
  },

  created () {
    setInterval(this.getMessages, 1000)
    setInterval(this.getPeople, 1000)
    window.onbeforeunload = function (e) {
      if (this.name) {
        this.$axios.post('logout', {
          name: this.name,
          avatar: this.myAvatar
        })
      }
    }
  },

  methods: {
    onResizeHeader (size) {
      this.headerHeight = size.height
    },

    enterInChat () {
      if (this.name) {
        this.$axios.post('login', {
          name: this.name,
          avatar: this.myAvatar
        })
          .then(response => {
            this.online = true
          })
          .catch(error => {
            console.error(error)
            this.$q.notify({
              color: 'negative',
              textColor: 'white',
              icon: 'report_problem',
              message: 'Erro na conexão com o servidor!',
              position: 'top',
              timeout: 3000
            })
          })
      } else {
        this.$q.notify({
          color: 'negative',
          textColor: 'white',
          icon: 'warning',
          message: 'O campo nome deve ser preenchido!',
          position: 'top',
          timeout: 3000
        })
      }
    },

    getPeople () {
      if (this.online) {
        this.$axios.get('people')
          .then(response => {
            this.online = true
            this.people.online = response.data.online.filter(el => {
              return el.name.replace(/ /g, '').toLowerCase() !== this.name.replace(/ /g, '').toLowerCase()
            })
            this.people.offline = response.data.offline.filter(el => {
              return el.name.replace(/ /g, '').toLowerCase() !== this.name.replace(/ /g, '').toLowerCase()
            })
          })
          .catch(error => {
            this.online = false
            console.error(error)
            this.$q.notify({
              color: 'negative',
              textColor: 'white',
              icon: 'report_problem',
              message: 'Erro na conexão com o servidor!',
              position: 'top',
              timeout: 3000
            })
          })
      }
    },

    getAllMessages (person) {
      this.online = false
      this.messages = []
      this.$axios.get('messages', { params: {
        myName: this.name,
        yourName: person.name
      } })
        .then(response => {
          this.yourName = person.name
          this.yourAvatar = person.avatar
          this.messages = response.data
          this.online = true
        })
        .catch(error => {
          this.online = false
          console.error(error)
          this.$q.notify({
            color: 'negative',
            textColor: 'white',
            icon: 'report_problem',
            message: 'Erro na conexão com o servidor!',
            position: 'top',
            timeout: 3000
          })
        })
    },

    setAvatar (elem) {
      this.myAvatar = elem
    },

    onResizeInput (size) {
      this.inputHeight = size.height
    },

    sendMessage () {
      if (this.message) {
        this.$axios.post('message', {
          myName: this.name,
          yourName: this.yourName,
          message: this.message
        })
          .then(response => {
            this.message = null
          })
          .catch(error => {
            this.online = false
            console.error(error)
            this.$q.notify({
              color: 'negative',
              textColor: 'white',
              icon: 'report_problem',
              message: 'Erro na conexão com o servidor!',
              position: 'top',
              timeout: 3000
            })
          })
      } else {
        this.$q.notify({
          color: 'negative',
          textColor: 'white',
          icon: 'warning',
          message: 'O campo de mensagem deve ser preenchido!',
          position: 'top',
          timeout: 3000
        })
      }
    },

    getMessages () {
      if (this.online && !!this.yourName) {
        this.$axios.get('message', { params: {
          myName: this.name,
          yourName: this.yourName,
          index: this.messages.length
        } })
          .then(response => {
            this.online = true
            if (response.data) {
              this.messages = this.messages.concat(response.data)
              this.$refs.chat.setScrollPosition(this.messages.length * 100, 500)
            }
          })
          .catch(error => {
            this.online = false
            console.error(error)
            this.$q.notify({
              color: 'negative',
              textColor: 'white',
              icon: 'report_problem',
              message: 'Erro na conexão com o servidor!',
              position: 'top',
              timeout: 3000
            })
          })
      }
    }
  }
}
</script>
