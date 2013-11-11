/*
 * Copyright (C) 2013 Freie Universität Berlin
 *
 * This file subject to the terms and conditions of the GLGPLv2 License. See the file LICENSE in the  
 * top level directory for more details.
 */

 /**
  * define some environment varialbes
  */
const FOO = "Hello Me";

/**
 * require some depencies
 */
var mod = require('./module');
var smo = require('smoothie');
var lina = require('sylvester');
var $ = require('jquery-browserify');
//var TimeSeries = smo.TimeSeries;

var charts = {'abs': null, 'res': null};
var pause = false;
var streams = {'x': new smo.TimeSeries(), 'y': new smo.TimeSeries(), 'z': new smo.TimeSeries(), 'res': new smo.TimeSeries()};


$(function() {

	makeChart();

	connectSocket();

	$("#start-stop").click(function() {
		if (pause) {
			chart.start();
			pause = false;
		} else {
			chart.stop();
			pause = true;
		}
	});

	$("#normal").text("foobar");
	onData({abs_x: 13, abs_y: 129, abx_z: 11});
});


function makeChart() {
	charts.abs = new smo.SmoothieChart({
		millisPerPixel:10,
		grid:{fillStyle:'#202020',strokeStyle:'#2b2b2b', verticalSections:10, sharpLines: false},
		labels:{precision:1},
		maxValue:550,
		minValue:-550,
		horizontalLines:[
			{color:'#ffffff',lineWidth:1,value:0},
			{color:'#880000',lineWidth:2,value:3333},
			{color:'#880000',lineWidth:2,value:-3333}
		]
	});
	charts.res = new smo.SmoothieChart({
		millisPerPixel:10,
		grid:{fillStyle:'#202020',strokeStyle:'#2b2b2b', verticalSections:10, sharpLines: false},
		labels:{precision:1},
		maxValue:1000,
		minValue:-50,
		horizontalLines:[
			{color:'#ffffff',lineWidth:1,value:0},
			{color:'#880000',lineWidth:2,value:3333},
			{color:'#880000',lineWidth:2,value:-3333}
		]
	});

	charts.abs.addTimeSeries(streams.x, {lineWidth:1.0,strokeStyle:'#00ff00'});
	charts.abs.addTimeSeries(streams.y, {lineWidth:1.0,strokeStyle:'#ff0000'});
	charts.abs.addTimeSeries(streams.z, {lineWidth:1.0,strokeStyle:'#0000ff'});
	charts.res.addTimeSeries(streams.res, {lineWidth:1.0, strokeStyle: '#0066aa'});
	canvas = $("#acc_chart").get(0);
	charts.abs.streamTo(canvas, 0);
	charts.res.streamTo($("#res_chart").get(0));
};

function connectSocket() {
	var socket = io.connect();
	socket.on('new data', onData);
};

var i = 0;
var sum = 0;

function onData(data) {
	var x = data.abs_x;
	var y = data.abs_y;
	var z = data.abs_z;
	streams.x.append(data.time, data.abs_x);
	streams.y.append(data.time, data.abs_y);
	streams.z.append(data.time, data.abs_z);
	var a = $V([x, y, z]);
	var res = a.modulus();
	if (i == 10) {
		i = 0; 
		$("#normal").text("Length of acc vector: " + (sum / 10));
		sum = 0;
	} else {
		i++;
		sum += res;
	}
	streams.res.append(data.time, res);
};