/*
 * Copyright (C) 2013 Freie Universität Berlin
 *
 * This file subject to the terms and conditions of the GLGPLv2 License. See the file LICENSE in the  
 * top level directory for more details.
 */

/**
 * @fileoverview    Definition of configuration values and bootstrapping the application
 *
 * @author          Hauke Petersen <hauke.petersen@fu-berlin.de>
 */

/**
 * Setup the base configuration
 */
const APP_PORT = 3000;
const BACKEND_PORT = 23511;
const APP_DIR = __dirname + '/app';
const ROOT_DIR = __dirname + '/root';
const LAYOUT_DIR = __dirname + '/data';
const DEFAULT_LAYOUT = LAYOUT_DIR + '/layout.json';

/**
 * include packages
 */
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var fs = require('fs');

/**
 * define global variables
 */
var clients = [];									// list of clients connected to the anchor
var graphData;										// the initial graph as read from the graph.json file
var reporters = [];

/**
 * Read graph.json file from filesystem
 */
function parseLayout(url) {
	var layout = url.match(/[a-zA-Z0-9]+$/g);
	var layoutfile = LAYOUT_DIR + "/" + layout + ".json";
	// try to read layout file
	fs.readFile(layoutfile, 'utf8', function (err, data) {
		if (err) {
			console.log('INFO: Unable to locate layout: ' + layoutfile);
			console.log('INFO: Fallback to default layout: ' + DEFAULT_LAYOUT);
			fs.readFile(DEFAULT_LAYOUT, 'utf8', function(err, data) {
				if (err) {
					console.log('While opening default layout: ' + err);
					return;
				}
				graphData = JSON.parse(data);
			});
			return;
		} 
		graphData = JSON.parse(data);
	});
}

/**
 * Setup static routes for img, js, css and the favicon
 */
app.use('/img', express.static(ROOT_DIR + '/img'));
app.use('/js', express.static(ROOT_DIR + '/js'));
app.use('/css', express.static(ROOT_DIR + '/css'));
app.use('/data', express.static(ROOT_DIR + '/data'));
app.use(express.favicon(ROOT_DIR + '/img/favicon.ico'));


/**
 * Setup one generic route that always points to the index.html
 */
app.get('/*', function(req, res) {
	parseLayout(req.url);
	res.sendfile(__dirname + '/views/index.html');
});

/**
 * Start the app
 */
server.listen(APP_PORT, function() {
	console.info('Server running at http://127.0.0.1:' + APP_PORT + '/');
});

/**
 * Configure the socket.io interface
 * 
 * When a new client is connecting, a initial node list is send to it. Later it receives 
 * all update information.
 */
io.set('log level', 1);
io.sockets.on('connection', function(socket) {
	clients.push(socket);
	socket.on('console', function(data) {
		console.log('TODO NEW CONSOLE DATA');
		//socket.emit('console', {'time': new Date().getTime(), 'node': 'sn9', 'data': data.data + " with love from anchor"});
		reporters.forEach(function(reporter) {
			reporter.socket.sendMessage(data);
		});
	});
	socket.emit('init', graphData);	
});

function clientUpdate(data) {
	clients.forEach(function(socket) {
		socket.emit('update', data);
	});
}

function clientSendRaw(data) {
	clients.forEach(function(socket) {
		socket.emit('console', data);
	});
}

/**
 * Start the backend
 */
var net = require('net');
var JsonSocket = require('json-socket');

var serverSocket = net.createServer(function(sock) {
	sock = new JsonSocket(sock);
	reporters.push({'id': 'TODO', 'socket': sock});
	console.log('connection from reporter');
	// sock.on('data', function(data) {
	// 	console.log('Got data');
	// 	console.log(data);
	// 	var foo = "";
	// 	for (var i = 0; i < data.length; i++) {
	// 		foo += String.fromCharCode(data[i]);
	// 	}
	// 	console.log(foo);
	// });
	sock.on('message', function(data) {
		if (data.type == 'raw') {
			console.log("TODO NEW UART DATA");
			data.node = 'sn2';
			clientSendRaw(data);
		} else {
			clientUpdate(data);
		}
	});
	sock.on('error', function(error) {
		console.log(error);
	});
	sock.on('close', function() {
		console.log("TODO: REPORTER DISCONNECTED");
	});
});

var init = function(port) {
	serverSocket.listen(port, function() {
		console.log('SOCKET: Backend socket started at port ' + port);
	});
};

init(BACKEND_PORT);

/*
// dummy update packages
 setInterval(function() {
 	var src = 'sn' + Math.floor(Math.random() * 10);
 	var dst = 'sn' + Math.floor(Math.random() * 10);
 	var data = {'hopsrc': src, 'hopdst': dst, 'type': 'event', 'data': {}, 'time': 1234565,};
 	clientUpdate(data);
 }, 2500);
 */
