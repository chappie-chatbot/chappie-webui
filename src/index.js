// app Vue instance
var app = new Vue({
  // app initial state
  data: {
    messages: {},
    user: 'user',
    conversation: 1,
    conversations: []
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
      console.log("User: " + this.user);
      console.log("Conversation: " + this.conversation);
      var conversation = {id: this.conversation, user:this.user};
      this.conversations.push(conversation);
      this.connect();
      this.prepopulateConversation(conversation, -100);
      this.stompClient.subscribe('/topic/messages/' + this.conversation, function(message) {
        this.displayMessage(conversation, JSON.parse(message.body));
      }.bind(this));
    },
    newMessage: function(conversation) {
      console.log("User: " + conversation.user);
      console.log("Conversation: " + conversation.id);
      console.log("Message: " + conversation.message);
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
//                stompClient.subscribe('/topic/messages', function(messageOutput) {
//                    showMessageOutput(messageOutput);
//                });
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
      if(!(message.id in this.messages)){
        this.messages[message.id] = message;
        console.log("Display: " + JSON.stringify(message));
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
      console.log("Mime: "+mime);
      var read = new FileReader();
      read.readAsBinaryString(file);
      read.onloadend = () => {
        var data = read.result;
        var base64 = btoa(data);
        this.sendMessage(conversation, base64, "base64", mime);
      }
    },
    sendMessage: function(conversation, text, type, mime) {
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
    },
    documentToUrl(message) {
      if(message.type=='base64'){
        var binary = atob(message.text);
        var array = new Uint8Array(binary.length)
        for( var i = 0; i < binary.length; i++ ) { array[i] = binary.charCodeAt(i) }
        var url = URL.createObjectURL(new Blob([array]))
        console.log(url);
        return url;
      }
    }
  },

  beforeMount(){
      this.connect()
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
