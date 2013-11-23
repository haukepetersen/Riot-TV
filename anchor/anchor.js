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
const APP_PORT = 12345;
const BACKEND_PORT = 23511;
const APP_DIR = __dirname + '/app';
const ROOT_DIR = __dirname + '/root';
const LAYOUT_DIR = __dirname + '/data';
const DEFAULT_LAYOUT = LAYOUT_DIR + '/layout.json';

// redis configuration
// send on publish channel: input, text: id
// remote ssh server: 193.174.152.185:6379
// ssh tunnel: ssh -L 6379:localhost:6379 redis@193.174.152.185, pw redis
const REDIS_HOST = 'localhost';
const REDIS_PORT = 6379;
const REDIS_CHANNEL = 'input';
const REDIS_MSG_CRIT = "Intrusion Alert";
const REDIS_MSG_EVT  = "Warning, possible security breach";

/**
 * include packages
 */
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var fs = require('fs');
var redis = require('node-redis');
var redisClient = redis.createClient(REDIS_PORT, REDIS_HOST);

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
	if (layout != null) {
		var layoutfile = LAYOUT_DIR + "/" + layout + ".json";
		// try to read layout file
		fs.readFile(layoutfile, 'utf8', function (err, data) {
			if (err) {
				// console.log('INFO:   Unable to locate layout: ' + layoutfile);
				// console.log('INFO:   Fallback to default layout: ' + DEFAULT_LAYOUT);
				loadDefaultLayout();
				return;
			} 
			graphData = JSON.parse(data);
		});
	} else {
		loadDefaultLayout();
	}
};

function loadDefaultLayout() {
	fs.readFile(DEFAULT_LAYOUT, 'utf8', function(err, data) {
		if (err) {
			console.log('ERROR:   While opening default layout: ' + err);
			return;
		}
		graphData = JSON.parse(data);
	});
};

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
				reporters[id].socket.sendMessage({'data': data.data});

			}
		});
	});
	socket.emit('init', graphData);
	for (rep in reporters) {
		publish('online', {'id': rep, 'station': reporters[rep].station, 'info': {}});
	}
});

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
	var id = basicSocket.remoteAddress + ":" + basicSocket.remotePort;
	reporters[id] = {'socket': sock};
	// publish reporter to frontend
	publish('online', {'id': id, 'info': {}});		// TODO: send more information as node id etc from condig file

	sock.on('message', function(data) {
		if (data.type == 'raw') {
			data.node = id;
			publish('console', data);
			scanRawData(data);
		} else {
			publish('update', data);
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

function startBackend(port) {
	serverSocket.listen(port, function() {
		console.log('SOCKET: Backend socket started at port ' + port);
	});
};


/**
 * Setup and handle the redis connection
 */
redisClient.on('error', function(error) {
	// console.log("REDIS:  Unable to connect to server at " + REDIS_HOST + ":" + REDIS_PORT);
});

redisClient.on('connect', function() {
	console.log("REDIS:  Connection established");
});

/**
 * Send and publish a report to Redis
 */
function redisSend(eventData) {
	redisClient.hmset(eventData.oid, 
		'payload', JSON.stringify(eventData), 
		'subject', 'safest', 
		'unmarshaller', 'de.fraunhofer.fokus.safest.model.SafestEntityUnmarshaller', 
		function() {
			console.log("REDIS:  Put event into database");
	});
	redisClient.publish(REDIS_CHANNEL, eventData.oid);
	//console.log("REDIS:  Data send and published: " + JSON.stringify(eventData));
};

/**
 * Report detected events to the Redis database and tell the visualization about the traffic
 */
function reportToRedis(event, nodeid) {
	var eventData = undefined;
	var time = Math.round((new Date()).getTime() / 1000);
	if (event == "crit") {
		eventData = {
			'type': 'Alarm',
		 	'oid': 'fence01_' + time,
		 	'causes': [],
		 	'description': REDIS_MSG_CRIT,
		 	'source': 'fnode_023',
		 	'severity': 'extreme',
		 	'timestamp': time
		};
	} else if (event == "evt") {
		eventData = {
			'type': 'Alarm',
		 	'oid': 'fence01_' + time,
		 	'causes': [],
		 	'description': REDIS_MSG_CRIT,
		 	'source': 'fnode_023',
		 	'severity': 'moderate',
		 	'timestamp': time
		};
	} else {
		return;
	}
	redisSend(eventData);
	// visualize
	var vis = {"hopsrc": "gw", "hopdst": "redis", "group": "evt", "type": event, "payload": {},	"time": time};
	publish('update', vis);
};


/*
// dummy update packages
 setInterval(function() {
 	var src = 'sn' + Math.floor(Math.random() * 10);
 	var dst = 'sn' + Math.floor(Math.random() * 10);
 	var data = {'hopsrc': src, 'hopdst': dst, 'type': 'event', 'data': {}, 'time': 1234565,};
 	publish('update', data);
 }, 2500);
 */


/**
 * parse new incoming messages and see if they contain anything of interest
 */



/**
 * Scan all incoming data send by the reporters for interesting messages
 * 
 * Recognized formats are:
 * - m: ID X received msg TYPE from ID Y #color
 * - p_s: ID X selected ID Y as parent
 * - p_d: ID X deleted ID Y as parent
 * - d: ID X received event EID
 * - i: ID X ignores ID Y		- no output for the future when messages from Y to X are send
 * - r: ID X selected rank N 	- rank in paranthesis behind node name in graph

 * TODO
 * - station: name 				- group reporters into their tv stations
 * 
 * @param line		The string that was received (without trailing \n)
 */
function scanRawData(data) {
	// parse line and forward event object
	var res = undefined;
	var find = data.data.match(/(m:|p_s:|p_d:|d:|r:|i:|station:).*/g);
	if (find != null) {
		console.log("VIS: Interesting String found: " + find[0]);
		var part = find[0].split(" ");
		switch (part[0]) {
			case "m:": 			// message between two nodes
				if (part.length >= 10) {
					res = {
						"hopsrc": part[8],
						"hopdst": part[2],
						"group": "rpl",
						"type": part[5],
						"payload": part[9],
						"time": data.time
					};
					publish('update', res);
				}
			break;
			case "p_s:": 		// when a RPL parent is selected
				if (part.length >= 5) {
					res = {
						"hopsrc": part[5],
						"hopdst": part[2],
						"group": "rpl",
						"type": "parent_select",
						"time": data.time
					};
					publish('update', res);
				}
			break;
			case "p_d:": 		// when a RPL paren is droped
				if (part.length >= 5) {
					res = {
						"hopsrc": part[5],
						"hopdst": part[2],
						"group": "rpl",
						"type": "parent_delete",
						"time": data.time
					};
					publish('update', res);
				}
			break;
			case "d:": 			// when a UDP packet (event) is received
				if (part.length >= 6) {
					reportToRedis(part[5], part[2]);
				}
			break;
			case "r:":
				if (part.length >= 6) {
					publish('rank', {'id': part[2], 'rank': part[5]});
				}
			break;
			case "i:":
				if (part.length >= 6) {
					publish('ignore', {'id': part[2], 'ignores': part[5]});
				}
			case "station:":
				if (part.length >= 2) {
					publish('stationSet', {'id': data.node, 'station': part[1]});
				}
			break;
		}
	}
};

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

/**
 * Bootstrap and start the application
 */
startBackend(BACKEND_PORT);
server.listen(APP_PORT, function() {
	console.info('WEBSERVER: Running at http://127.0.0.1:' + APP_PORT + '/');
});
