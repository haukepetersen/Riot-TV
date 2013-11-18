/**
 * New node file
 */

(function() {

	var Change = function(sigma) {

		var self = this;

		this.options = {
			'updateInterval' : 25,
			'glow' : {
				'speed' : 10,
				'growFactor' : 2,
				'repeat' : 2,
				'size' : 10,
			},
			'vibrate' : {
				'slowBy' : 2,
				'intensity' : 0.01,
				'repeat': 15,
			},
			'showLink': {
				'duration': 2500,
				'startWidth': 30,
				'endWidth': 1,
			},
			'fadeLink': {
				'duration': 1000,
				'startWidth': 30,
				'endWidth': 1,
			},
			'color' : {
				'step' : 3.0,
				'speed' : 1
			},
		};

		/**
		 * list of active changes / animations
		 * 
		 * Animations have the format: {node: node_id, params: {object with
		 * params}, function: executing function}
		 */
		var changes = [];

		var interval = false;

		this.activate = function() {
			interval = setInterval(change, self.options.updateInterval);
		};

		this.deactivate = function() {
			if (interval) {
				clearInterval(interval);
			}
		};

		this.highlight = function(nodeId) {
			sigma.graph.nodes.forEach(function(n) {
				console.log(n);
			});
		};

		this.glow = function(nodeId, params) {
			var node = self.getNode(nodeId);
			if (node) {
				if (!params) {
					params = {};
				}
				var change = {
					'node' : node,
					'params' : params,
					'fn' : doGlow
				};
				changes.push(change);
			}
		};
		
		this.vibrate = function(nodeId, params) {
			var node = self.getNode(nodeId);
			if (node) {
				if (!params) {
					params = {};
				}
				var change = {
					'node': node,
					'params': params,
					'fn': doVibrate
				};
				changes.push(change);
			}
		};
		
		this.showLink = function(edge) {
			var change = {
					'edge': edge,
					'params': {},
					'fn': doShowLink,
			};
			changes.push(change);
		};

		function change() {
			for (var i = 0; i < changes.length; i++) {
				changes[i].fn(i);
			}
			sigma.draw(2, 2, 2); // refresh the graph
			cleanUp();
		};

		/**
		 * Get node
		 */
		this.getNode = function (id) {
			for (var i = 0; i < sigma.graph.nodes.length; i++) {
				var n = sigma.graph.nodes[i];
				if (n.id == id) {
					return n;
				}
			}
		};

		/**
		 * Get edge
		 */
		this.getEdge = function(id) {
			for (var i = 0; i < sigma.graph.edges.length; i++) {
				var e = sigma.graph.edges[i];
				if (e.id == id) {
					return e;
				}
			}
		};

		/**
		 * Glow a node (periodically inflate and deflate it)
		 * 
		 * Parameters are 1. repeat: Count down until it reaches zero 2. size: A
		 * nodes initial size (that is restored after the effect
		 */
		function doGlow(changeId) {
			var opts = self.options.glow;
			var params = changes[changeId].params;
			var node = changes[changeId].node;

			if (!params.state) {
				params.state = 0;
				params.repeat = opts.repeat;
				params.size = opts.size;
				params.maxSize = params.size * opts.growFactor;
			}

			params.state += opts.speed;
			if (params.state >= 180) {
				params.repeat -= 1;
				if (params.repeat == 0) {
					node.size = params.size;
					changes[changeId].toRemove = true;
					return;
				} else {
					params.state = opts.speed;
				}
			}
			node.size = Math.sin(params.state * Math.PI / 180)
					* (params.maxSize - params.size) + params.size;
		};

		/**
		 * Vibrate
		 */
		function doVibrate(changeId) {
			var opts = self.options.vibrate;
			var params = changes[changeId].params;
			var node = changes[changeId].node;
			if (!params.state) {
				params.state = opts.intensity;
				params.pos = node.x;
				params.size = node.size;
				params.count = 0;
			}
			++params.count;
			if (params.count >= opts.slowBy * opts.repeat) {
				node.x = params.pos;
				changes[changeId].toRemove = true;
				return;
			}
			if (params.count % opts.slowBy == 0) {
				params.state *= -1;
				node.x = params.pos + (node.size * params.state);
			}
		};

		/**
		 * Show a link, will fade from size 0 to the given width and the link will stay visible
		 */
		this.showLink = function(edge, color, time, width) {
			self.fadeLink(edge, color, time, 0, width);
		};

		/**
		 * Hide a link, will fade from the current size to 0 in time ms and will be hidden afterwards
		 */
		this.hideLink = function(edge, time) {
			if (edge.hidden == 0) {
				self.fadeLink(edge, edge.color, time, edge.size, 0);
			}
		};

		/** 
		 * Fade a link from a given size to another given size.
		 */
		this.fadeLink = function(edge, color, time, startWidth, endWidth) {
			var change = {
				'edge': edge,
				'params': {
					'color': color,
					'duration': time,
					'startWidth': startWidth,
					'endWidth': endWidth},
				'fn': doFadeLink
			};
			changes.push(change);
		}

		/**
		 * Out an edge
		 */
		function doFadeLink(changeId) {
			var params = changes[changeId].params;
			var edge = changes[changeId].edge;
			if (!params.step) {
				params.duration = params.duration / self.options.updateInterval;
				params.step = (params.startWidth - params.endWidth) / params.duration;
				edge.size = params.startWidth;
				edge.color = params.color;
				edge.hidden = 0;
			}
			--params.duration;
			edge.size -= params.step;
			if (params.duration <= 0) {
				changes[changeId].toRemove = true;
				if (params.endWidth == 0) {
					edge.hidden = 1;
				}
			}
		};

		/**
		 * Change a color from one to another
		 */
		function smoothColor(changeId) {
			var opts = self.options.color;
			var params = changes[changeId].params;
			var node = changes[changeId].node;
			if (!params.state) {
				params.state = 0;
				params.step = 0;
			}
			++params.step;
			if (params.step % opts.speed == 0) {
				params.state += opts.step;
				node.color = "hsv(" + params.state + "%, 50%, 100%)";
				// console.log('hsv(' + params.state + '%, 100%, 100%)');
			}
			if (params.state >= 100) {
				changes[changeId].toRemove = true;
			}
		}

		/**
		 * Color a node
		 */
		function color(nodeId, color) {
			getNode(nodeId).color = color;
		};

		/**
		 * Remove changes that are not applicable anymore
		 */
		function cleanUp() {
			for (var i = changes.length - 1; i >= 0; i--) {
				if (changes[i].toRemove) {
					changes.splice(i, 1);
				}
			}
		};

	};

	sigma.publicPrototype.activateChange = function() {
		if (!this.change) {
			this.change = new Change(this._core);
		}
		this.change.activate();
	};

	sigma.publicPrototype.deactivateChange = function() {
		if (this.change) {
			this.change.deactivate();
		}
	};

	sigma.publicPrototype.glow = function(nodeId, params) {
		if (this.change) {
			this.change.glow(nodeId, params);
		}
	};
	
	sigma.publicPrototype.vibrate = function(nodeId, params) {
		if (this.change) {
			this.change.vibrate(nodeId, params);
		}
	};
	
	sigma.publicPrototype.showLink = function(src, dst, id, color, time, width) {
		if (this.change) {
			var edge = this.change.getEdge(id);
			if (edge == null) {
				this.addEdge(id, src, dst);
				edge = this.change.getEdge(id);
			}
			this.change.showLink(edge, color, time, width);
		}
	};

	sigma.publicPrototype.hideLink = function(id, time) {
		if (this.change) {
			var edge = this.change.getEdge(id);
			if (edge != null) {
				this.change.hideLink(edge, time);
			}
		}
	}

	sigma.publicPrototype.fadeLink = function(src, dst, id, color, time, startWidth, endWidth) {
		if (this.change) {
			var edge = this.change.getEdge(id);
			if (edge == null) {
				this.addEdge(id, src, dst);
				edge = this.change.getEdge(id);
			}
			this.change.fadeLink(edge, color, time, startWidth, endWidth);
		}
	};

	sigma.publicPrototype.isEdge = function(id) {
		return this.change.getEdge(id) != undefined;
	};

	sigma.publicPrototype.getEdge = function(id) {
		if (this.change) {
			return this.change.getEdge(id);
		} else {
			return null;
		}
	};

})();