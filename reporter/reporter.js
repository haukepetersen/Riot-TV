/*
 * Copyright (C) 2013 Freie Universität Berlin
 *
 * This file subject to the terms and conditions of the GLGPLv2 License. See the file LICENSE in the  
 * top level directory for more details.
 */

/**
 * @fileoverview    The riot-tv reporter gathers data about routes and package transmission in riot based
 *					6LowPAN WSNs.
 * 
 * @date			Okt 2013
 * @author          Hauke Petersen <hauke.petersen@fu-berlin.de>
 */

/**
 * Configuration
 */
const DEFAULT_ANCHOR_HOST = 'localhost';		/* address of the anchor */
const DEFAULT_ANCHOR_PORT = 23511;				/* targeted port on the anchor */
const DEFAULT_SERIAL_PORT= '/dev/ttyUSB0';		/* serial port to open */

/**
 * Library imports
 */
var net = require('net');
var	JsonSocket = require('json-socket');
var SerialPort = require('serialport').SerialPort;

/**
 * Global variables
 */
var socket = new JsonSocket(new net.Socket());	/* connection to the anchor */
var isConnected = false;						/* flag signals if the reporter is connected to the anchor */
var serialPort = new SerialPort(DEFAULT_SERIAL_PORT, 
	{'baudrate': 115200, 'databits': 8, 'parity': 'none', 'stopbits': 1},
	false);										/* connection to the sensor node over UART */
var buffer = '';								/* buffer input from serial port */

/**
 * Try to connect
 */
connect();


/**
 * Reporting section
 * (event handlers for the TCP connection)
 */
function connect() {
	if (!isConnected) {
		console.log("SOCKET: Trying to connect to " + DEFAULT_ANCHOR_HOST + ':' + DEFAULT_ANCHOR_PORT);
		socket.connect(DEFAULT_ANCHOR_PORT, DEFAULT_ANCHOR_HOST);
	}
}

socket.on('connect', function() {
	console.log('SOCKET: Reporting live from the RIOT');
	isConnected = true;
});

socket.on('close', function(error) {
	if (!error) {
		console.log('SOCKET: Lost connection to the anchor, will try to call back');
		isConnected = false;
		connect();
	}
});

socket.on('error', function() {
	console.log('SOCKET: Unable to reach the anchor, will try again in 1s');
	setTimeout(connect, 1000);
});

function report(data) {
	if (isConnected) {
		console.log('send ' + data);
		socket.sendMessage(data);
	}
}

/**
 * Research section
 * (event handlers for the serial port)
 */
serialPort.open(function() {
	console.log('SERIAL: Let the journalism begin, covering the RIOT - live');
	serialPort.on('data', onData);
});

/**
 * This function is called once data received on the serial port
 * 
 * @note This function needs to be adapted for the riot output
 * 
 * @param data		The data bytes that were received
 */
function onData(data) {
	for (var i = 0; i < data.length; i++) {
		if (data[i] == 10 && buffer.length > 0) {
			parseLine(buffer, report);
		} else {
			buffer += String.fromCharCode(data[i]);
		}
	}
}

function parseLine(line, cb) {
	var res = undefined;
	var data = line.match(/(m:|p_s:|p_d:).*/g);
	if (data != null) {
		var part = data[0].split(" ");
		switch (part[0]) {
			case "m:":
				res = {
					"hopsrc": part[8],
					"hopdst": part[2],
					"group": "rpl",
					"type": part[5],
					"payload": part[9],
					"time": new Date().getTime()
				};
			break;
			case "p_s:":
				res = {
					"hopsrc": part[5],
					"hopdst": part[2],
					"group": "rpl",
					"type": "parent_select",
					"time": new Date().getTime()
				};
			break;
			case "p_d:":
				res = {
					"hopsrc": part[5],
					"hopdst": part[2],
					"group": "rpl",
					"type": "parent_delete",
					"time": new Date().getTime()
				};
			break;
		}
	}
	if (res != undefined) {
		cb(res);
	}
}

/**
 * Debugging the parser
 */
// var m1 = "m: ID 149 received msg DIO from ID 150 #color6 - Rank 256";
// var m2 = "p_s: ID sn4 selected ID sn7 as parent - some stupid output that concerns no one";
// var m3 = "p_d: ID sn1 deleted ID sn4 as parent";
// var m4 = "m: ID gw received msg TYPE_234 from ID sn1 #color7";

// function res(data) {
// 	report(data);
// 	console.log(data);
// }

// setTimeout(function() {
// 	console.log(m1);
// 	parseLine(m1, res);
// 	console.log(m2);
// 	parseLine(m2, res);
// 	console.log(m3);
// 	parseLine(m3, res);
// 	console.log(m4);
// 	parseLine(m4, res);
// }, 500);

// var data = {
// 	'src': 'node_0',
// 	'dst': 'node_1',
// 	'hopsrc': 'id1',
// 	'hopdst': 'id2',
// 	'group': 'fence',		/* [fence | cam | rpl] */
// 	'type' : 'data',
// 	'payload' : {'some': 'data', 'object': 'with', 'a': 'payload',},
// 	'time' : new Date().toDateString(),
// };