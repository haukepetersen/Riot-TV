/*
 * Copyright (C) 2013 Freie Universität Berlin
 *
 * This file subject to the terms and conditions of the GLGPLv2 License. See the file LICENSE in the  
 * top level directory for more details.
 */

/**
 * @fileoverview    Basic functionality for RIOT TV
 *
 * @author          Hauke Petersen <hauke.petersen@fu-berlin.de>
 */
const GRAPH_PANE = '#tvscreen';

var socket = undefined;
var graph = undefined;

$(document).ready(function() {
	console.log('hello jquery');

	initUi();
	initGraph();
	initSocket();
	
});

/**
 * Initialize the GUI elements.
 */
function initUi() {
	$("button").button().click(function() {
		var node = $("#colorset-node").val();
		var color = $("#colorset-color").val();
		graph.colorNode(node, color);
	});
	$(".ui-slider").slider();
	$("#radio").buttonset().click(function() {
		graph.glow('node_5');
	});
};

/**
 * Setup a websocket connection to the anchor for receiving events and register event handlers.
 */
function initSocket() {
	socket = io.connect();
	socket.on('connect', function() {
		console.log('Connected to socket.io server');
		socket.emit('status', '{online: true}');
	});
	socket.on('connect_failed', function() {
		console.log('Connection to localhost failed');
	});
	socket.on('error', function(error) {
		console.log('Error: ' + error);
	});
	socket.on('update', onUpdate);
	socket.on('init', onInit);
};

/**
 * Initialize the display graph.
 */
function initGraph() {
	graph = sigma.init($(GRAPH_PANE).get(0));
	graph.drawingProperties({
		defaultLabelColor : '#fff',
		defaultLabelSize : 14,
		defaultLabelBGColor : '#fff',
		defaultLabelHoverColor : '#000',
		labelThreshold : 6,
		defaultEdgeType : 'curve'			// curve or line
	}).graphProperties({
//		minNodeSize : 0.5,
		maxNodeSize : 20,
//		minEdgeSize : 1,
//		maxEdgeSize : 1
	}).mouseProperties({
//		maxRatio : 1,
	});
	graph.activateChange();
};


function onInit(data) {
	console.log('onInit');
	console.log(data);
	data.nodes.forEach(function(n) {
		graph.addNode(n.id, n.params);
	});
	data.edges.forEach(function(e) {
		graph.addEdge(e.id, e.src, e.dst, e.params);
	});
	graph.draw(2, 2, 2);
};

function onUpdate(data) {
	if (data.hopsrc != data.hopdst) {
		var id = data.hopsrc +'_' + data.hopdst;
	
		graph.glow(data.hopdst);
		graph.vibrate(data.hopsrc);
		graph.showLink(data.hopdst, data.hopsrc);
		//	var edge = graph.getEdge(id);
		//	if (edge == undefined) {
		//		graph.addEdge(data.src + data.dst, data.src, data.dst, {'color': '#fff',});
		//	} else {
		//		graph.accountEdge(edge);
		//	}
		//	graph.draw(2, 2, 2);
	}
};

