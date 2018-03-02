'use strict';

/******************* socket.io scoped socket implementation  *******************/
var ScopedSocket = function(socket, $rootScope) {
  this.socket = socket;
  this.$rootScope = $rootScope;
  this.listeners = [];
};

ScopedSocket.prototype.removeAllListeners = function(opts) {
  if (!opts) opts = {};
  for (var i = 0; i < this.listeners.length; i++) {
    var details = this.listeners[i];
    if (opts.skipConnect && details.event === 'connect') {
      continue;
    }
    this.socket.removeListener(details.event, details.fn);
  }
  this.listeners = [];
};

ScopedSocket.prototype.on = function(event, callback) {
  var socket = this.socket;
  var $rootScope = this.$rootScope;

  var wrapped_callback = function() {
    var args = arguments;
    $rootScope.$apply(function() {
      callback.apply(socket, args);
    });
  };
  socket.on(event, wrapped_callback);

  this.listeners.push({
    event: event,
    fn: wrapped_callback
  });
};

ScopedSocket.prototype.emit = function(event, data, callback) {
  var socket = this.socket;
  var $rootScope = this.$rootScope;
  var args = Array.prototype.slice.call(arguments);

  args.push(function() {
    var args = arguments;
    $rootScope.$apply(function() {
      if (callback) {
        callback.apply(socket, args);
      }
    });
  });

  socket.emit.apply(socket, args);
};

/******************* socket.io module implementation  *******************/
/*angular.module('insight.socket').factory('getSocket',
  function($rootScope) {
    var socket = io.connect('ws://localhost:3001/ws', {
      'reconnect': true,
      'reconnection delay': 500,
    });
    return function(scope) {
      var scopedSocket = new ScopedSocket(socket, $rootScope);
      scope.$on('$destroy', function() {
        scopedSocket.removeAllListeners();
      });
      socket.on('connect', function() {
        scopedSocket.removeAllListeners({
          skipConnect: true
        });
      });
      return scopedSocket;
    };
  });*/

/******************* pure web sockets implementation  *******************/

var ScopedPureSocket = function(socket, $rootScope) {
  this.socket = socket;
  this.$rootScope = $rootScope;
  this.listeners = [];
  var self = this;
  this.socket.onmessage = function(msg) {
    var messageData = JSON.parse(event.data);
    var events = ScopedPureSocket.eventsDictionary;
    if(messageData.eventname != undefined && messageData.eventname in events)
    {
      events[messageData.eventname](messageData);
    }
  }
};

ScopedPureSocket.eventsDictionary = {};

ScopedPureSocket.prototype.removeAllListeners = function(opts) {
  if (!opts) opts = {};
  for (var i = 0; i < this.listeners.length; i++) {
    var details = this.listeners[i];
    if (opts.skipConnect && details.event === 'connect') {
      continue;
    }
    this.socket.removeListener(details.event, details.fn);
  }
  this.listeners = [];
};

ScopedPureSocket.prototype.on = function(event, callback) {
  var socket = this.socket;
  var $rootScope = this.$rootScope;
  var events = ScopedPureSocket.eventsDictionary;

  var wrapped_callback = function() {
    var args = arguments;
    $rootScope.$apply(function() {
      callback.apply(socket, args);
    });
  };
  events[event] = wrapped_callback;
  this.listeners.push({
    event: event,
    fn: wrapped_callback
  });
  if(event == "tx") {
    socket.send("SubscribeToTxs");
  }
  else if(event == "block") {
    socket.send("SubscribeToBlocks");
  }
};

ScopedPureSocket.prototype.emit = function(event, data, callback) {
  var socket = this.socket;
  var $rootScope = this.$rootScope;
  var args = Array.prototype.slice.call(arguments);

  args.push(function() {
    var args = arguments;
    $rootScope.$apply(function() {
      if (callback) {
        callback.apply(socket, args);
      }
    });
  });
  //TODO We don't do anything here because client side tries to emit (send)
  //before connection is open. Socket.io seems to allow this somehow.
  //To emulate it, if connection is not open, queue messages and send them when connection
  //is opened
};

angular.module('insight.socket').factory('getSocket',
  function($rootScope) {
    var socket = new WebSocket('ws://localhost:3001/ws'); //TODO Make configurable
    return function(scope) {
      var scopedSocket = new ScopedPureSocket(socket, $rootScope);
      scope.$on('$destroy', function() {
        //TODO Here, we should send the server a ServerClose message.
        //However, being a scoped socket, this would close the connection too early.
        //Some reference counting or cleanup mechanism is needed
      });
      socket.onopen = function() {
      };
      socket.onerror = function(error){
        console.log('WebSocket error: ' + error);
      }
      return scopedSocket;
    };
  });