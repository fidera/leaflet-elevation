import 'leaflet-i18n';
import * as _        from './utils';
import * as D3       from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	let opts = this.options;
	let time = {};

	this._timeFactor = opts.timeFactor;

	/**
	 * Common AVG speeds:
	 * ----------------------
	 *  slow walk = 1.8  km/h
	 *  walking   = 3.6  km/h
	 *  running   = 10.8 km/h
	 *  cycling   = 18   km/h
	 *  driving   = 72   km/h
	 * ----------------------
	 */
	this._timeAVGSpeed = (opts.timeAVGSpeed || 3.6) * (opts.speedFactor || 1);

	if (!opts.timeFormat) {
		opts.timeFormat = (time) => new Date(time).toLocaleString().replaceAll('/', '-').replaceAll(',', ' ');
	} else if (opts.timeFormat == 'time') {
		opts.timeFormat = (time) => new Date(time).toLocaleTimeString();
	} else if (opts.timeFormat == 'date') {
		opts.timeFormat = (time) => new Date(time).toLocaleDateString();
	}

	opts.xTimeFormat = opts.xTimeFormat || ((t) => _.formatTime(t).split("'")[0]);

	if (opts.time && opts.time != "summary" && !L.Browser.mobile) {

		this.on("elechart_axis", function() {

		time.y = this._chart._y;

		time.x = D3.Scale({
			data : this._data,
			range: [0, this._width()],
			attr : "duration",
			min  : 0,
			// max        : +1,
			// forceBounds: opts.forceAxisBounds
			// scale      : 'scaleTime'
		});

		time.axis = D3.Axis({
			axis      : "x",
			position  : "top",
			width     : this._width(),
			height    : 0,
			scale     : time.x,
			ticks     : this.options.xTicks * 1.5,
			label     : 't',
			labelY    : -10,
			labelX    : this._width(),
			name      : "time",
			tickFormat: (d) => (d == 0 ? '' : opts.xTimeFormat(d))
		});

		this._chart._axis
			.call(time.axis)
			.call(g => {
				let axis = g.select(".x.axis.time");
				axis.select(".domain").remove();
				axis.selectAll("text")
				.attr('opacity', 0.65)
				.style('font-family', 'Monospace')
				.style('font-size', '110%');
				axis.selectAll(".tick line")
					.attr('y2', this._height())
					.attr('stroke-dasharray', 2)
					.attr('opacity', 0.75);
				}
			)

		});

	}

	this.on('elepoint_added', function(e) {
		let data = this._data;
		let i    = e.index;

		// Add missing timestamps (see: options.timeAVGSpeed)
		if (!e.point.meta || !e.point.meta.time) {
			e.point.meta = e.point.meta || {};
			let delta = (data[i].dist - data[i > 0 ? i - 1 : i].dist);
			let speed = this._timeAVGSpeed;
			e.point.meta.time = new Date(
				(
					i > 0
						? data[i - 1].time.getTime() + ((( delta / speed) * this._timeFactor) * 1000)
						: Date.now()
				)
			);
		}

		let time = e.point.meta.time;

		// Handle timezone offset
		if (time.getTime() - time.getTimezoneOffset() * 60 * 1000 === 0) {
			time = 0;
		}

		data[i].time = time;

		let currT    = data[i].time;
		let prevT    = i > 0 ? data[i - 1].time : currT;

		let deltaT   = Math.abs(currT - prevT);
		let duration = (this.track_info.time || 0) + deltaT;

		data[i].duration     = duration;

		this.track_info.time = duration;
	});

	if (!this.options.time) return;

	this.on("elechart_change", function(e) {
		let chart = this._chart;
		let item  = e.data;

		if (chart._focuslabel) {
			if (item.time) {
				if (!chart._focuslabelTime || !chart._focuslabelTime.property('isConnected')) {
					chart._focuslabelTime = chart._focuslabel.select('text')
						.insert("svg:tspan", ".mouse-focus-label-x")
						.attr("class", "mouse-focus-label-time")
						.attr("dy", "1.5em");
				}
				chart._focuslabelTime.text(this.options.timeFormat(item.time));
			}
		}
	});

	this.on("elechart_summary", function() {
		this.track_info.time = this.track_info.time || 0;

		this._summary
			.append("tottime", L._("Total Time: "), _.formatTime(this.track_info.time))
	});

});
