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
var stats = {};					// object saves status information about nodes, as parent, rank and message counter
var ignoreList = {};			// a list containing ignored edges, events on those will not be displayed
// keep track of reporters and stations
var reporters = {};
var activeReporters = {};
var stations = {};
var activeStation;

// show a popup when hovering graph nodes
var popUp;

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
	$(".console-nodeselector").click(reporterSelect);
	$("#console-sc-attack").button().click(consoleScAttack);
	$("#console-sc-trail").button().click(consoleScTrail);
	$(".console-station").click(stationSelect);
	stationsInit();
};

function consoleSend() {
	socket.emit('console', {'dst': Object.keys(activeReporters), 'data': $("#console-input").val()});
	$("#console-input").val('');
};

function consoleScAttack() {
	socket.emit('console', {'dst': Object.keys(activeReporters), 'data': 'attack'});
}

function consoleScTrail() {
	socket.emit('console', {'dst': Object.keys(activeReporters), 'data': 'trail'});
}

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

/**
 * Manage reporters and stations
 */
function stationsInit() {
	stationAdd('all', 'All');
	stations['all'].dom.addClass('active');
	activeStation = stations.all;
	stationUpdate();
}

/**
 * @brief	Add a new station to the console
 */
function stationAdd(id, name) {
	var item = $('<div class="console-station">' + name + '</div>');
	item.click(stationSelect);
	$("#console-stations").append(item);
	stations[id] = {'name': name, 'dom': item, 'reps': {}};
};

function stationUpdate() {
	for (rid in reporters) {
		reporters[rid].dom.hide();
	}
	for (rid in activeStation.reps) {
		reporters[rid].dom.show();
	}
	// finally see if any active reporter is in an inactive group
	for (rid in activeReporters) {
		if (!activeStation.reps[rid]) {
			reporters[rid].dom.toggleClass('active');
			delete activeReporters[rid];
		}
	}
};

/**
 * @param data: Object{id: , station: ,}
 */
function stationAssign(data) {
	var id = data.station.toLowerCase();
	if (!stations[id]) {
		stationAdd(id, data.station);
	}
	for (sid in stations) {
		if (sid != 'all') {
			delete stations[sid].reps[data.id];
		}
	}
	stations[id].reps[data.id] = reporters[data.id];
	stationUpdate();
};

function stationSelect() {
	var id = $(this).text().toLowerCase();
	activeStation.dom.removeClass('active');
	$(this).addClass('active');
	activeStation = stations[id];
	stationUpdate();
}

function reporterAdd(data) {
	// see if reporter already in list, if yes, replace
	if (reporters[data.id]) {
		reporterRemove(data);
	}
	// insert new reporter into dom
	var domParent = $("#console-reporters");
	var item = $('<div class="console-nodeselector">' + data.id + '<br /><span class="id">' + data.id + '</span>');
	item.click(reporterSelect);
	domParent.append(item);
	reporters[data.id] = {'id': data.id, 'name': data.name, 'dom': item};
	// add node to stations
	stations.all.reps[data.id] = reporters[data.id];
	if (data.station) {
		stationAssign(data);
	}
	stationUpdate();
};

function reporterRemove(data) {
	var reporter = reporters[data.id];
	if (reporter) {
		reporter.dom.remove();
		for (sid in stations) {
			delete stations[sid].reps[data.id];
			delete activeStation.reps[data.id];
		}
		delete activeReporters[data.id];
		delete reporters[data.id];
	}
};

function reporterSelect() {
	var id = $(this).find(".id").first().text();
	if ($(this).hasClass('active')) {
		delete activeReporters[id];
	} else {
		activeReporters[id] = 'active';
	}
	$(this).toggleClass('active');
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
	socket.on('stationSet', stationAssign);
	socket.on('online', reporterAdd);
	socket.on('offline', reporterRemove);
	socket.on('rank', onRank);
	socket.on('ignore', onIgnore);
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
		defaultEdgeType : 'line',			// curve or line
      	defaultEdgeArrow: 'target'
	}).graphProperties({
		minNodeSize : 10,
		maxNodeSize : 15,
//		minEdgeSize : 1,
//		maxEdgeSize : 1
	}).mouseProperties({
//		maxRatio : 1,
	});
	graph.activateChange();
	//graph.activateFishEye();

	graph.bind('overnodes', showNodeInfo);
	graph.bind('outnodes', hideNodeInfo);
};

function showNodeInfo(evt) {
	popUp && popUp.remove();

	// make html tag
	var node;
      graph.iterNodes(function(n){
        node = n;
      },[evt.content[0]]);
	var data = stats[node.id];
	var html = '<div class="popup"><ul>';
	html += '<li>Rank: ' + data.rank + '</li>';
	html += '<li>Parent: ' + data.parent + '</li>';
	html += '<li>Root: ' + data.root + '</li>';
	html += '<li>Send: ' + data.send + '</li>';
	html += '<li>Received: ' + data.rec + '</li>';
	html += '</ul></div>';

	popUp = $(html).attr('id', 'popup' + graph.getID()
		).css({
			'left': node.displayX - 5,
			'top': node.displayY + 9,
			'z-index': -0
		});
	$(GRAPH_PANE).append(popUp);
};

function hideNodeInfo(evt) {
      popUp && popUp.remove();
      popUp = false;
};



function onInit(data) {
	if (data) {
		data.nodes.forEach(function(n) {
			stats[n.id] = {'rank': '-', 'parent': '-', 'root': '-', 'send': 0, 'rec': 0};
			graph.addNode(n.id, n.params);
		});
		data.edges.forEach(function(e) {
			graph.addEdge(e.id, e.src, e.dst, e.params);
		});
		graph.draw(2, 2, 2);
	}
};

/**
 * @brief 	Set the rank for the given node
 * 
 * @param Object {'id': ... , 'rank': ...}
 */
function onRank(data) {
	graph.setRank(data.id, data.rank);
	stats[data.id].rank = data.rank;
};

/**
 * @brief	Add an ignore entry for a given edge
 *
 * @param Object {'id': ... , 'ignores': ...}
 */
function onIgnore(data) {
	var id = data.ignores + "_" + data.id;
	ignoreList[id] = true;
};

/**
 * @brief	This method is called everytime an update to the displaying graph is required.
 *
 * @param data 		Object {'hopsrc': ..., 'hopdst': ..., group: , type: , and more}
 */
function onUpdate(data) {
	// hack to emulate the gw on 'sn16':
	if (data.hopsrc == 'sn16') {
		data.hopsrc = 'gw';
	} else if (data.hopdst == 'sn16') {
		data.hopdst = 'gw';
	}
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
	// check if the edge in question is on the ignore list
	//var ignoretest = evt.hopsrc + "_" + evt.hopdst;
	var ignoretest = evt.hopdst + "_" + evt.hopsrc;
	if (ignoreList[ignoretest]) {
		return;
	}
	stats[evt.hopsrc].send ++;
	stats[evt.hopdst].rec ++;

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
	var id = evt.hopdst + "_" + evt.hopsrc + "-parent";
	stats[evt.hopdst].parent = evt.hopsrc;
	graph.showLink(evt.hopdst, evt.hopsrc, id, colors.color15, fading.fast, 5);
};

function event_pd(evt) {
	var id = evt.hopdst + "_" + evt.hopsrc + "-parent";
	stats[evt.hopdst].parent = '-';
	graph.hideLink(id, fading.fast);
}
