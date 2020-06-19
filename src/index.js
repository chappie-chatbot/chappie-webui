// app Vue instance
var app = new Vue({
  // app initial state
  data: {
    user: 'user',
    conversation: 1,
    conversations: [],
    userConversations: []
  },

  // watch todos change for localStorage persistence
  watch: {
  },

  // computed properties
  // http://vuejs.org/guide/computed.html
  computed: {
  },

  filters: {
  },

  // methods that implement data logic.
  // note there's no DOM manipulation here at all.
  methods: {
    newConversation: function () {
      // Update existing conversation
      for(var existingConversation of this.conversations) {
        if(existingConversation.id == this.conversation) {
          existingConversation.user = this.user;
          return;
        }
      }
      var conversation = {id: this.conversation, user:this.user, messageIds:{}};
      this.conversations.push(conversation);
      Vue.set(conversation, 'collapsed', false);
      this.connect();
      this.prepopulateConversation(conversation, -100);
      conversation.subscription = this.stompClient.subscribe('/topic/messages/' + this.conversation, function(message) {
        this.displayMessage(conversation, JSON.parse(message.body));
      }.bind(this));
    },
    newMessage: function(conversation) {
      this.sendMessage(conversation, conversation.message);
      conversation.message = null;
    },
    connect: function() {
        if(!this.socket){
            console.log("Connecting...");
            var socket = new SockJS('/messages');
            this.socket = socket;
        }
        if(!this.stompClient){
            var stompClient = Stomp.over(socket);
            stompClient.connect({}, function(frame) {
                console.log('Connected: ' + frame);
            });
            this.stompClient = stompClient;
        }
    },
    prepopulateConversation: function(conversation, start){
      axios({
        method: 'GET',
        url: '/message?topic=chat&conversation='+conversation.id+"&start="+start
      }).then((resp) => {
        for(var message of resp.data.items){
          this.displayMessage(conversation, message);
        }
      });
    },
    displayMessage: function(conversation, message) {
      // Prevents duplicates
      if(!(message.id in conversation.messageIds)){
        conversation.messageIds[message.id] = message;
        conversation.newMessage = true;
        if(conversation.messages == null){
          Vue.set(conversation, 'messages', []);
          conversation.messages = [];
        }
        conversation.messages.push(message);
      }
    },
    uploadDocument: function (conversation){
      var file = document.getElementById("document-upload-file-input-"+conversation.id).files[0];
      var mime = file.type;
      var read = new FileReader();
      read.readAsBinaryString(file);
      read.onloadend = () => {
        var data = read.result;
        var base64 = btoa(data);
        this.sendMessage(conversation, base64, "base64", mime);
      }
    },
    sendMessage: function(conversation, text, type, mime) {
      if(text != null || text.trim().length > 0) {
        var message = {
          conversation: conversation.id,
          source: conversation.user,
          type: type,
          mime: mime,
          text: text
        };
        axios({
          method: 'POST',
          url: '/message',
          data: {items:[message]}
        }).then((resp) => {
          this.displayMessage(conversation, resp.data.items[0]);
        });
      }
    },
    isImage: function(message) {
      return message.mime.trim().toLowerCase().includes("image/");
    },
    blobUrl: function (message) {
      if(message.type=='base64'){
        var binary = atob(message.text);
        var array = new Uint8Array(binary.length)
        for( var i = 0; i < binary.length; i++ ) { array[i] = binary.charCodeAt(i) }
        var url = URL.createObjectURL(new Blob([array]))
        return url;
      }
    },
    contentUrl: function (message) {
      return "/message/"+message.id+"/content";
    },
    collapseConversation: function (conversation) {
      conversation.collapsed = !conversation.collapsed;
    },
    closeConversation: function (conversation) {
      conversation.subscription.unsubscribe();
      var index = this.conversations.indexOf(conversation);
      if (index > -1) {
        this.conversations.splice(index, 1);
      }
    },
    userChanged: function () {
      this.fetchConversationsByParticipant(this.user);
    },
    fetchConversationsByParticipant: function (user) {
      if(user == null)
        user = this.user;
      console.log("fetchConversationsByParticipant("+user+")");
      axios({
        method: 'GET',
        url: '/conversation?participant='+user
      }).then((resp) => {
        console.log("conversations: "+JSON.stringify(resp.data.items));
        this.userConversations = resp.data.items;
      });
    },
    scrollBottom: function (conversation){
      var messageList = document.getElementById("message-list-"+conversation.id);
      messageList.scrollTop = messageList.scrollHeight;
    }
  },

  updated() {
    for(var conversation of this.conversations){
      if(conversation.newMessage){
        conversation.newMessage=false;
        this.scrollBottom(conversation);
      }
    }
  },

  beforeMount(){
      this.connect();
      this.fetchConversationsByParticipant();
   },

  // a custom directive to wait for the DOM to be updated
  // before focusing on the input field.
  // http://vuejs.org/guide/custom-directive.html
  directives: {
    "todo-focus": function(el, binding) {
      if (binding.value) {
        el.focus();
      }
    }
  }
});

// mount
app.$mount(".chappie-app");
