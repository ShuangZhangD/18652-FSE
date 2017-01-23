var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var chat = require(('./routes/index'));

var app = express();

// var app = require('../app');
var debug = require('debug')('FSE-ShuangZhang-Chatroom:server');
var http = require('http');
// view engine setup
//app.set('views', path.join(__dirname, 'views'));
//app.set('view engine', 'jade');
var server = http.createServer(app);
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('./chat.db');

app.get('/',function(req,res){
  res.sendFile(__dirname+'/views/chat.html');
});
/*app.get('/chat',function(req,res){
  res.sendFile(__dirname+'/views/chat.html');
});*/

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/chat', chat);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});



/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);
/**
 * initialize database
 */
db.run("CREATE TABLE IF NOT EXISTS users (userName TEXT, joinTime TEXT)");
db.run("CREATE TABLE IF NOT EXISTS messages (userName TEXT, time TEXT, content TEXT)");

var insertUser = db.prepare("insert into users Values(?,?)");
var insertMessage = db.prepare("insert into messages Values(?,?,?)");

/**
 * add socket.io
 */
var io = require("socket.io")(server);

io.on('connection', function(socket) {
  socket.on('chat message', function(data) {
    console.log(data.msg);
    var time = new Date().toLocaleString();
    insertMessage.run(data.userName, time, data.msg);
    io.emit('broadcast messages', data);
  });

  socket.on('new user', function (userName) {
    db.all("select * from users where userName=\"" + userName + "\"", function (err, row) {
      if(row.length == 0) {
        var time = new Date().toLocaleString();
        insertUser.run(userName, time);
        insertMessage.run(userName, time, userName + userName + " entered the chatroom");
        console.log("new user");
      } else {
        console.log(row[0].joinTime);
        db.all("select * from messages where time >\'" + row[0].joinTime + "\'", function(err, row){

          //console.log(row[0].joinTime);
          sendHistoryData(row, userName);
        });
        console.log("old user");
      }
    });
    io.emit('new user', userName);
  });

  function sendHistoryData(messages, userName) {
    console.log(messages.length);
    io.emit('load old message', {messages : messages, userName : userName});
  }

  socket.on('leave', function(userName){
    io.emit('leave', userName);
    console.log(userName + " left the group");
    var time = new Date().toLocaleString();
    insertMessage.run(userName, time, userName + " left the group");
  });

});

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(app.get('port'));
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
module.exports = app;
