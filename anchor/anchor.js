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
var reporters = {};

/**
 * Node address translation, translates reporter ids to node ids
 */
var nat = {
	'nids': {},
 	'insert': function(tvid, nid) {
 		this.nids[nid] = tvid;
 	},
 	'remove': function(nid) {
 		delete this.nids[nid];
 	},
 	'translate': function(nid) {
 		return this.nids[nid];
 	}
}

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
		data.dst.forEach (function(id) {
			if (reporters[id]) {
				reporters[id].sendMessage({'data': data.data});
			}
		});

		//socket.emit('console', {'time': new Date().getTime(), 'node': 'sn9', 'data': data.data + " with love from anchor"});
		
		// reporters.forEach(function(reporter) {
		// 	reporter.socket.sendMessage(data);
		// });
	});
	socket.emit('init', graphData);
	for (rep in reporters) {
		publish('online', {'id': rep, 'info': {}});
	}
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

function publish(type, data) {
	clients.forEach(function(socket) {
		socket.emit(type, data);
	});	
}

/**
 * Start the backend
 */
var net = require('net');
var JsonSocket = require('json-socket');

var serverSocket = net.createServer(function(basicSocket) {
	console.log('SOCKET: Reporter connected from: ' + basicSocket.remoteAddress + ':' + basicSocket.remotePort);
	sock = new JsonSocket(basicSocket);
	// create reporter id
	var id;
	if (basicSocket.remoteAddress == '127.0.0.1') {
		id = basicSocket.remoteAddress + ":" + basicSocket.remotePort;
	} else {
		id = basicSocket.remoteAddress;
	}
	reporters[id] = sock;
	// publish reporter to frontend
	publish('online', {'id': id, 'info': {}});		// TODO: send more information as node id etc from condig file

	sock.on('message', function(data) {
		if (data.type == 'raw') {
			data.node = id;
			clientSendRaw(data);
		} else {
			clientUpdate(data);
		}
	});
	sock.on('error', function(error) {
		console.log(error);
	});
	sock.on('close', function(test) {
		publish('offline', {'id': id});
		delete reporters[id];
		console.log('SOCKET: Reporter disconnected: ' + id);
	});
});

function init(port) {
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

