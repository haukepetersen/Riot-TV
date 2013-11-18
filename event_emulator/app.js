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
 * configuration
 */
const REDIS_HOST = 'localhost'
const REDIS_PORT = 6379
const REDIS_CHANNEL = 'input'

// send on publish channel: input, text: id
// remote ssh server: 193.174.152.185:6379
// ssh tunnel: ssh -L 6379:localhost:6379 redis@193.174.152.185, pw redis

/**
 * requirements and globals
 */
var redis = require('node-redis');
var client = redis.createClient(REDIS_PORT, REDIS_HOST);
console.log("connecting to " + REDIS_HOST + ":" + REDIS_PORT);



var time = Math.round((new Date()).getTime() / 1000);
var eventData = {
	'type': 'Alarm',
 	'oid': 'fence01_' + time,
 	'causes': [],
 	'description': 'A monstertruck drove over the fence',
 	'source': 'fnode_023',
 	'severity': 'severe',
 	'timestamp': time
};
//console.log(eventData);


client.on('error', function(error) {
	console.log("Unable to connect to redis server");
});

client.on('connect', function() {
	console.log("Connected to REDIS");
	client.hmset(eventData.oid, 'payload', JSON.stringify(eventData), 'subject', 'safest', 'unmarshaller', 'de.fraunhofer.fokus.safest.model.SafestEntityUnmarshaller', function() {
		console.log("HMSET done");
	});
	client.publish(REDIS_CHANNEL, eventData.oid);
	console.log("Data send and published: " + JSON.stringify(eventData));
});

//console.log("json: " + JSON.stringify(eventData));

// JSON.stringify(eventData)
