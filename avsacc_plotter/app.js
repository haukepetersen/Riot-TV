/*
 * Copyright (C) 2013 Freie Universität Berlin
 *
 * This file subject to the terms and conditions of the GLGPLv2 License. See the file LICENSE in the  
 * top level directory for more details.
 */

/**
 * define configuration values
 */
const WEB_PORT = 9999;
const SERIAL_PORT = "/dev/ttyUSB0";


/**
 * include dependencies
 */
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var SerialPort = require('serialport').SerialPort;



var serialPort = new SerialPort(SERIAL_PORT, 
	{'baudrate': 115200, 'databits': 8, 'parity': 'none', 'stopbits': 1},
	false);	
var buffer = "";
var clients = [];

/**
 * setup the web server to server static content from the web subfolder and the web/index.html for
 * all other requests
 */
app.use('/web', express.static(__dirname + '/web'));
app.use(express.favicon(__dirname + '/web/favicon.ico'));
app.get('/*', function(req, res) {
	res.sendfile(__dirname + '/web/index.html');
});

/**
 * setup the websocket
 */
io.set('log level', 0); 			// reduce the rather verbose socket.io output
io.sockets.on('connection', function(socket) {
	clients.push(socket);
	socket.on('disconnect', function() {
		var i = clients.indexOf(socket);		// remove socket from available clients
		clients.splice(i, 1);
	});
});

/**
 * setup the serialport
 */
serialPort.open(function() {
	console.log("Opened serialport " + SERIAL_PORT);
});
serialPort.on('data', function(data) {
	receiveData(data);
});
function receiveData(data) {
	for (var i = 0; i < data.length; i++) {
		if (data[i] == 10 && buffer.length > 0) {
			publishData();
		} else {
			buffer += String.fromCharCode(data[i]);
		}
	}
};
function publishData() {
	var item = buffer;
	buffer = "";
	parseItem(item, function(data) {
		clients.forEach(function(socket) {
			socket.emit('new data', data);
		});
	});
};
function parseItem(item, fn) {
	data = item.match(/-?\d+/g);
	if (data != null && data.length == 3) {
		var acc = {"abs_x": data[0], "abs_y": data[1], "abs_z": data[2], "time": new Date().getTime()};
		fn(acc);
	}
};

/**
 * start delivering those pages
 */
server.listen(WEB_PORT, function() {
	console.log("Started server on port " + WEB_PORT);
});