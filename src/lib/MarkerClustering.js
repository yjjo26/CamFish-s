/**
 * Marker Clustering for Naver Maps v3
 * Based on Naver Maps API v3 Examples
 */

var MarkerClustering = function (options) {
	console.log("[MarkerClustering] Initializing. Options:", options);
	var naver = window.naver;
	if (!naver) {
		console.error("[MarkerClustering] window.naver is missing!");
		return;
	}

	// Defines standard options
	this._map = null; // Initialize as null so setMap triggers change
	this._markers = options.markers || [];
	this._gridSize = options.gridSize || 60;
	this._averageCenter = options.averageCenter || false;
	this._minClusterSize = options.minClusterSize || 2;
	this._icons = options.icons || [];
	this._indexGenerator = options.indexGenerator || function (count) {
		var index = 0;

		if (count >= 10 && count < 100) {
			index = 1;
		} else if (count >= 100 && count < 500) {
			index = 2;
		} else if (count >= 500 && count < 1000) {
			index = 3;
		} else if (count >= 1000) {
			index = 4;
		}

		return index;
	};

	this._clusters = [];

	// Attach to map if provided
	if (options.map) {
		this.setMap(options.map);
	}
};

MarkerClustering.prototype.setMap = function (map) {
	var oldMap = this._map;

	if (map !== oldMap) {
		this._map = map;
		this._onMapChanged(oldMap, map);
	}
};

MarkerClustering.prototype.getMap = function () {
	return this._map;
};

MarkerClustering.prototype.setMarkers = function (markers) {
	this._markers = markers;
	this._recluster();
};

MarkerClustering.prototype.getMarkers = function () {
	return this._markers;
};

// Internal Methods

MarkerClustering.prototype._onMapChanged = function (oldMap, newMap) {
	if (newMap) {
		this._bindMapEvents();
		this._recluster();
	} else {
		this._unbindMapEvents();
		this._clearClusters();
	}
};

MarkerClustering.prototype._bindMapEvents = function () {
	var map = this._map;
	var that = this;

	this._idleHandler = naver.maps.Event.addListener(map, 'idle', function () {
		that._recluster();
	});
};

MarkerClustering.prototype._unbindMapEvents = function () {
	naver.maps.Event.removeListener(this._idleHandler);
};

MarkerClustering.prototype._recluster = function () {
	this._clearClusters();

	if (!this._map) return;

	var map = this._map;
	var bounds = map.getBounds();
	var markers = this._markers;

	console.log(`[MarkerClustering] _recluster called. Markers: ${markers.length}`);

	// Defines a grid based on map projection
	var projection = map.getProjection();
	if (!projection) {
		console.error("[MarkerClustering] Map projection is null!");
		return;
	}
	var mapZoom = map.getZoom();

	// Iterate markers and group them
	var clusters = {};

	for (var i = 0, ii = markers.length; i < ii; i++) {
		var marker = markers[i];

		// Skip if marker is not visible (optional optimization)
		// if (!bounds.hasLatLng(marker.getPosition())) continue;

		var position = marker.getPosition();
		var point = projection.fromCoordToOffset(position);

		var gridX = Math.floor(point.x / this._gridSize);
		var gridY = Math.floor(point.y / this._gridSize);

		var key = gridX + '-' + gridY;

		if (!clusters[key]) {
			clusters[key] = [];
		}

		clusters[key].push(marker);
	}

	// Create cluster objects
	for (var key in clusters) {
		if (clusters[key].length >= this._minClusterSize) {
			this._createCluster(clusters[key]);
		} else {
			// If strictly below minClusterSize, show individual markers
			// Logic handled mainly by specific implementations, but here we just show them
			for (var m = 0; m < clusters[key].length; m++) {
				clusters[key][m].setMap(map);
			}
		}
	}
};

MarkerClustering.prototype._createCluster = function (markers) {
	var map = this._map;
	var center;

	if (this._averageCenter) {
		var latSum = 0;
		var lngSum = 0;
		for (var i = 0; i < markers.length; i++) {
			latSum += markers[i].getPosition().lat();
			lngSum += markers[i].getPosition().lng();
		}
		center = new naver.maps.LatLng(latSum / markers.length, lngSum / markers.length);
	} else {
		center = markers[0].getPosition();
	}

	var count = markers.length;
	var index = this._indexGenerator(count);
	// Safety check: clamp index to icons length
	if (this._icons.length > 0 && index >= this._icons.length) {
		index = this._icons.length - 1;
	}
	var icon = this._icons[index] || this._icons[0]; // Fallback to first icon

	var clusterMarker = new naver.maps.Marker({
		position: center,
		map: map,
		icon: {
			content: icon.content.replace('${count}', count),
			size: icon.size,
			anchor: icon.anchor
		}
	});

	// Hide individual markers
	for (var i = 0; i < markers.length; i++) {
		markers[i].setMap(null);
	}

	this._clusters.push(clusterMarker);
	console.log(`[MarkerClustering] Cluster created at ${center} with count ${count}`);

	// Click to zoom
	naver.maps.Event.addListener(clusterMarker, 'click', function () {
		var currentZoom = map.getZoom();
		var nextZoom = currentZoom + 1; // Or calculate bounds to fit
		map.setZoom(nextZoom);
		map.setCenter(center);
	});
};

MarkerClustering.prototype._clearClusters = function () {
	for (var i = 0; i < this._clusters.length; i++) {
		this._clusters[i].setMap(null);
	}
	this._clusters = [];
};

export default MarkerClustering;
