/*
 * Copyright (C) 2013 Freie Universität Berlin
 *
 * This file subject to the terms and conditions of the GLGPLv2 License. See the file LICENSE in the  
 * top level directory for more details.
 */

/**
 * @fileoverview    The riot-tv reporter gathers data about routes and package transmission in riot based
 * 					6LowPAN WSNs.
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
})

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
})

/**
 * This function is called once data received on the serial port
 * 
 * @note This function needs to be adapted for the riot output
 * 
 * @param data		The data bytes that were received
 */
var lastchar = '';
function onData(data) {
	for (var i = 0; i < data.length; i++) {
		if (data[i] == 10 && buffer.length > 0) {
			var res = {'type': '','data': buffer,};
			report(res);
			buffer = '';
		} else {
			buffer += String.fromCharCode(data[i]);
		}
	}
}


var data = {
	'src': 'node_0',
	'dst': 'node_1',
	'group': 'fence',		/* [fence | cam | rpl] */
	'type' : 'data',
	'payload' : {'some': 'data', 'object': 'with', 'some': 'payload',},
	'time' : new Date().toDateString(),
};