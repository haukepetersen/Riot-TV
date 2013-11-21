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

/**
 * Some global variables
 */
var graph = undefined;
var socket = undefined;
var isConnected = false;
var activeNodes = {};
var consoleNodes = {};

/**
 * Pre-Defined coloring for the visulization
 */
var colors = {
	'color0':  '#004CFF',		// blue (fast) fading arrow (-> send DIO)
	'color1':  '#FFCC00',		// orange (fast) fading arrow (-> send TVO upwards: TRAIL request)
	'color2':  '#54E600',		// green (fast) fading arrow (-> send TVO downwards: TRAIL reply)
	'color3':  '#FFCC00',		// orange fading (-> send TVO-ACK)
	'color4':  '#2EE600',		// 
	'color5':  '#2EE600',		// 
	'color6':  '#004CFF',		// blue fading arrow (-> receive DIO: accept)
	'color7':  '#004CFF',		// blue fading arrow (-> receive DIO: ignore since TRAIL verification pending)
	'color8':  '#FFCC00',		// orange fading arrow (-> receive TVO upwards)
	'color9':  '#54E600',		// green fading arrow (-> receive TVO downwards)
	'color10': '#FFCC00',		// orange fading arrow (-> receive TVO Duplicate)
	'color11': '#FFCC00',		// orange fading (-> receive TVO-ACK)
	'color12': '#2EE600',		// 
	'color13': '#2EE600',		// 
	'color14': '#2EE600',		// 
	'color15': '#009DFF',		// thin bright blue line (-> selected parent)
	'color20': '#536236',		// light green -> camera traffic
	'color30': '#54E600',		// event traffic
};

/**
 * Pre-Defined fading intervals for the visualization
 */
var fading = {					// fading speed in ms
	'superfast': 50,
	'fast': 500,
	'normal': 2000,
	'slow': 5000,
};

/**
 * Bootstrap the whole javascript klim-bim only after the page was fully loaded
 */
$(document).ready(function() {
	initUi();
	initGraph();
	initSocket();	
});

/**
 * Initialize the GUI elements.
 */
function initUi() {
	$("body").keypress(function(event) {
		if (event.which == 94) {
			consoleToggle();
			return false;
		}
	});
	$("#console-send").button().click(consoleSend);
	$("#console-input").keypress(function(event) {
		if (event.which == 13) {
			consoleSend();
		}
	});
	$("#console-showhide").click(consoleToggle);
	$(".console-nodeselector").click(consoleNodeSelect);
	$(".ui-slider").slider();
	$("#radio").buttonset().click(function() {
		graph.glow('node_5');
	});
};

function consoleSend() {
	socket.emit('console', {'dst': Object.keys(activeNodes), 'data': $("#console-input").val()});
	$("#console-input").val('');
};

function consoleToggle() {
	var button = $("#console-showhide");
	if (button.hasClass("show")) {
		$("#console").slideDown();
	} else {
		$("#console").slideUp();
		$("#console-input").focus();
	}
	button.toggleClass("show");
	button.toggleClass("hide");
};

function consoleAddNode(data) {
	// see if node already in list, if yes, replace
	if (consoleNodes[data.id]) {
		consoleRemoveNode(data);
	}
	// insert new nde
	var nodelist = $("#console-sidebar");
	var item = $('<div class="console-nodeselector passive">' + data.id + '<br /><span class="id">' + data.id + '</span>');
	item.click(consoleNodeSelect);
	nodelist.append(item);
	consoleNodes[data.id] = {'id': data.id, 'info': data.info, 'element': item};
}

function consoleRemoveNode(data) {
	var node = consoleNodes[data.id];
	if (node) {
		node.element.remove();
		delete activeNodes[node.id];
		delete node;
	}
}

function consoleNodeSelect() {
	var id = $(this).find(".id").first().text();
	if ($(this).hasClass('active')) {
		delete activeNodes[id];
	} else {
		activeNodes[id] = 'active';
	}
	$(this).toggleClass('active');
	$(this).toggleClass('passive');
};

function consoleReceive(data) {
	var out = $("#console-output");
	var string = new Date(data.time).toLocaleString() + " [" + data.node + "] " + data.data + "\n";
	out.val(out.val() + string);
	out.scrollTop(out[0].scrollHeight - out.height());
};

/**
 * Setup a websocket connection to the anchor for receiving events and register event handlers.
 */
function initSocket() {
	socket = io.connect();
	socket.on('connect', function() {
		socket.emit('status', '{online: true}');
		isConnected = true;
	});
	socket.on('connect_failed', function() {
		console.log('Connection to localhost failed');
	});
	socket.on('error', function(error) {
		console.log('Error: ' + error);
	});
	socket.on('update', onUpdate);
	socket.on('init', onInit);
	socket.on('console', consoleReceive);
	socket.on('online', consoleAddNode);
	socket.on('offline', consoleRemoveNode);
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
		defaultEdgeType : 'line'			// curve or line
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
	if (data) {
		data.nodes.forEach(function(n) {
			graph.addNode(n.id, n.params);
		});
		data.edges.forEach(function(e) {
			graph.addEdge(e.id, e.src, e.dst, e.params);
		});
		graph.draw(2, 2, 2);
	}
};

function onUpdate(data) {
	var id = data.hopsrc +'_' + data.hopdst;

	// graph.glow(data.hopdst);
	// graph.vibrate(data.hopsrc);
	switch (data.group) {
		case 'rpl':
		switch (data.type) {
			case 'parent_select':
				event_ps(data);
			break;
			case 'parent_delete':
				event_pd(data);
			break;
			default:
				event_m(data);
			break;
		}
		break;
		case 'cam':
			data.payload = "#color20";
			event_m(data);
		break;
		case 'evt':
			data.payload = "#color30";
			event_m(data);
		break;
	}
	
	if (data.group == "rpl") {
	}
};

function event_m(evt) {
	var id = evt.hopsrc + "_" + evt.hopdst + "-" + evt.payload;
	switch (evt.payload) {
		case "#color0":
			graph.fadeLink(evt.hopsrc, evt.hopdst, id, colors.color0, fading.fast, 30, 0);
		break;
		case "#color1":
			graph.fadeLink(evt.hopsrc, evt.hopdst, id, colors.color1, fading.fast, 30, 0);
		break;
		case "#color2":
			graph.fadeLink(evt.hopsrc, evt.hopdst, id, colors.color2, fading.fast, 30, 0);
		break;
		case "#color3":
			graph.fadeLink(evt.hopsrc, evt.hopdst, id, colors.color3, fading.normal, 30, 0);
		break;
		case "#color6":
			graph.fadeLink(evt.hopsrc, evt.hopdst, id, colors.color6, fading.normal, 30, 0);
		break;
		case "#color7":
			graph.fadeLink(evt.hopsrc, evt.hopdst, id, colors.color7, fading.normal, 30, 0);
		break;
		case "#color8":
			graph.fadeLink(evt.hopsrc, evt.hopdst, id, colors.color8, fading.normal, 30, 0);
		break;
		case "#color9":
			graph.fadeLink(evt.hopsrc, evt.hopdst, id, colors.color9, fading.normal, 30, 0);
		break;
		case "#color10":
			graph.fadeLink(evt.hopsrc, evt.hopdst, id, colors.color10, fading.normal, 30, 0);
		break;
		case "#color11":
			graph.fadeLink(evt.hopsrc, evt.hopdst, id, colors.color11, fading.normal, 30, 0);
		break;
		case "#color15":
			graph.fadeLink(evt.hopsrc, evt.hopdst, id, colors.color15, fading.normal, 30, 0);
		break;
		case "#color20":
			graph.fadeLink(evt.hopsrc, evt.hopdst, id, colors.color20, fading.normal, 30, 0);
		break;
		case "#color30":
			graph.fadeLink(evt.hopsrc, evt.hopdst, id, colors.color30, fading.normal, 30, 0);
		break;
	}
};

function event_ps(evt) {
	var id = evt.hopsrc + "_" + evt.hopdst + "-" + evt.type;
	graph.showLink(evt.hopsrc, evt.hopdst, id, colors.color15, fading.fast, 5);
};

function event_pd(evt) {
	var id = evt.hopsrc + "_" + evt.hopdst + "-" + evt.type;
	graph.hideLink(id, fading.superfast);
}