var path = require('path');
var express = require('express');
var compression = require('compression');
var favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var session = require('express-session');
var RedisStore = require('connect-redis')(session);
var url = require('url');
var csrf = require('csurf');

var dbURL = process.env.MONGOLAB_URI || "mongodb://localhost/LifeCounter";

var db = mongoose.connect(dbURL, function(err) {
	if (err) {
		console.log("Error: Could not connect to database");
		throw err;
	}
});

var redisURL = {
	hostname: 'localhost',
	port: 6379
};

var redisPASS;

if (process.env.REDISCLOUD_URL) {
	redisURL = url.parse(process.env.REDISCLOUD_URL);
	redisPASS = redisURL.auth.split(":")[1];
}

var router = require('./router.js');
var controllers = require('./controllers');
var port = process.env.PORT || process.env.NODE_PORT || 3000;

var app = express();
app.use('/assets', express.static(path.resolve(__dirname + '../../client/')));
app.use(compression());
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(session({
	key: "sessionid",
	store: new RedisStore({
		host: redisURL.hostname,
		port: redisURL.port,
		pass: redisPASS
	}),
	secret: 'Super Secret Tech',
	resave: true,
	saveUninitialized: true,
	cookie: {
		httpOnly: true
	}
}));
app.set('view engine', 'jade');
app.set('views', __dirname + '/views');
app.disable('x-powered-by');
app.use(cookieParser());
app.use(csrf());
app.use(function(err, req, res, next) {
	if (err.code !== 'EBADCSRFTOKEN') {
		return next(err);
	}
	
	return;
});

router(app);

var server = app.listen(port, function(err) {
	if (err) {
		throw err;
	}
	
	console.log('Listening on port ' + port);
});

var io = require('socket.io').listen(server);

//setup socketIO events
io.on('connection', function(socket) {
	socket.on('login', function(data) {
		controllers.Account.socketLogin(socket, data);
	});
	
	socket.on('signup', function(data) {
		controllers.Account.socketSignup(socket, data);
	});
	
	socket.on('createRoom', function(data) {
		controllers.Account.resetLife(data);
		controllers.Room.socketCreateRoom(socket, data);
	});
	
	socket.on('getRooms', function() {
		controllers.Room.socketGetRooms(socket);
	});
	
	socket.on('joinRoom', function(data) {
		controllers.Account.resetLife(data);
		controllers.Room.socketJoinRoom(io, socket, data);
	});
	
	socket.on('leaveRoom', function(data) {
		controllers.Account.resetLife(data);
		controllers.Room.socketLeaveRoom(io, socket, data);
	});
	
	socket.on('updateLife', function(data) {
		controllers.Account.socketUpdateLife(io, socket, data);
	});
});