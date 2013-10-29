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
const GRAPH_LAYOUT = __dirname + '/data/layout.json';

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

/**
 * Read graph.json file from filesystem
 */
fs.readFile(GRAPH_LAYOUT, 'utf8', function (err, data) {
  if (err) {
    console.log('Error: ' + err);
    return;
  } 
  graphData = JSON.parse(data);
});

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
	res.sendfile(__dirname + '/views/index.html');
//	res.sendfile(__dirname + '/test.html');
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
io.sockets.on('connection', function(socket) {
	clients.push(socket);
	socket.emit('init', graphData);	
});

function clientUpdate(data) {
	clients.forEach(function(socket) {
		socket.emit('update', data);
	});
}

/**
 * Start the backend
 */
var net = require('net');
var JsonSocket = require('json-socket');

var serverSocket = net.createServer(function(sock) {
	sock = new JsonSocket(sock);
	console.log('connection from reporter');
	sock.on('message', function(data) {
		console.log(data);
	});
});

var init = function(port) {
	serverSocket.listen(port, function() {
		console.log('SOCKET: Backend socket started at port ' + port);
	});
};

init(BACKEND_PORT);

// dummy update packages
setInterval(function() {
	var src = 'sn' + Math.floor(Math.random() * 10);
	var dst = 'sn' + Math.floor(Math.random() * 10);
	var data = {'src': src, 'dst': dst, 'type': 'event', 'data': {}, 'time': 1234565,};
	clientUpdate(data);
}, 2500);