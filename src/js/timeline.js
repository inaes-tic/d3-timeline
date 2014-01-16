/*
 *  Timeline - the overall timeline manager
 */


var FILMSTRIP_PADDING = 15;

function Timeline(config) {
    this.init.call(this, config);
}

Timeline.prototype = {
    init: function(config) {
        var self = this;
        self.config = config;

        self.width = config.width;
        self.height = config.height;
        self.layout = config.layout;
        self.shades = config.shades;

        self.callbacks = config.callbacks || {};

        // Setup comparison function
        self.unique_id = config.unique_id;

        if (self.unique_id !== undefined) {
            self.comparator = function(d) {
                return d.get(self.unique_id);
            };
        }

        // Setup data manager
        self.data = new Data(this, config);

        // Select container from config
        self.container = d3.select(config.container);
        if (self.container.empty()) {
            throw new Error("Timeline: No container");
        }

        // Select or insert svg object
        self.svg = self.container.select("svg");
        if (self.svg.empty()) {
            self.svg = self.container.append("svg:svg");
        }
        self.svg
            .attr("id", "Timeline")
            .attr("class", "Timeline")
            .attr("height", self.height)
            .attr("width", self.width);

        // Shades
        self.configure_shades();

        // Insert panels
        self.panels = [];
        var total_span = config.panels.reduce(function(prev, elem) {
            return prev + elem.span;
        }, 0);
        var actual_span = 0;
        for (var i = 0, li = config.panels.length; i < li; ++i) {
            config.panels[i].total_span = total_span;
            config.panels[i].actual_span = actual_span;
            config.panels[i].panel_ord = i;
            if (i < li - 1) {
                config.panels[i].highlight = config.panels[i+1].axis.span;
            }
            self.panels.push(new Panel(this, config.panels[i]));
            actual_span += config.panels[i].span;
        }

        this.start_animation();
    },

    start_animation: function() {
        var self = this;

        this.animate = true;

        // Configure timer for now indicator
        if (self.config.follow) {
            (function follow() {
                var now = self.draw_now_indicator();
                if (self.config.follow) {
                    self.centerTime.call(self, now);
                }
                if (self.animate) {
                    window.requestAnimationFrame(follow);
                }
            })();
        } else {
            (function animate_now_indicator() {
                self.draw_now_indicator();
                if (self.animate) {
                    window.requestAnimationFrame(animate_now_indicator);
                }
            })();
        }
    },

    stop_animation: function() {
        this.animate = false;
    },

    get_max_bounds: function() {
        var span;
        var panel;
        for (var i = 0, li = this.panels.length; i < li; ++i) {
            if (span === undefined || this.panels[i].axis_span > span) {
                span = this.panels[i].axis_span;
                panel = i;
            }
        }
        return {
            start: moment(this.panels[panel].start),
            end: moment(this.panels[panel].end),
        };
    },

    panTime: function(time, smooth) {
        var self = this;
        for (var i = 0, li = self.panels.length; i < li; ++i) {
            self.panels[i].panTime(time, smooth);
        }

        this.callback("panning", [this.get_max_bounds()]);
    },

    centerTime: function(time, smooth) {
        var self = this;
        for (var i = 0, li = self.panels.length; i < li; ++i) {
            self.panels[i].centerTime(time, smooth);
        }

        if (this.dragging_playlist !== undefined) {
            this.drag_move(this.dragging_playlist);
        }

        this.callback("panning", [this.get_max_bounds()]);
    },

    draw_now_indicator: function() {
        var self = this;

        var now = moment();
        for (var i = 0, li = self.panels.length; i < li; ++i) {
            self.panels[i].draw_now_indicator(now);
        }

        return now;
    },

    clear_now_indicator: function() {
        for (var i = 0, li = this.panels.length; i < li; ++i) {
            this.panels[i].clear_now_indicator();
        }
    },

    configure_events: function() {
        for (var i = 0, li = this.panels.length; i < li; ++i) {
            this.panels[i].configure_events();
        }
    },

    release_events: function() {
        for (var i = 0, li = this.panels.length; i < li; ++i) {
            this.panels[i].release_events();
        }
    },

    draw_highlights: function(smooth) {
        for (var i = 0, li = this.panels.length; i < li; ++i) {
            if (i + 1 < li) {
                this.panels[i].draw_highlight(this.panels[i + 1].axis_span, smooth);
            }
        }
    },

    focus_playlist: function(playlist) {
        var self = this;

        // Do not center if following
        if (self.config.follow) {
            return;
        }

        var center = self.get_playlist_central_time(playlist);

        for (var i = 0, li = self.panels.length; i < li; ++i) {
            var panel = self.panels[i];
            var callback;
            if (panel.config.zoomable) {
                callback = _.bind(panel.zoom_playlist, panel, playlist, true);
            }
            panel.centerTime(center, true, callback);
        }

        this.callback("panning", [this.get_max_bounds()]);
    },

    resize: function(width, height, smooth) {
        var self = this;

        self.width = width;
        self.height = height;

        self.smoothify(self.svg, smooth)
            .attr("height", self.height)
            .attr("width", self.width);

        for (var i = 0, li = self.panels.length; i < li; ++i) {
            self.panels[i].resize(smooth);
        }
    },

    redraw: function(smooth, ignore_drag) {
        for (var i = 0, li = this.panels.length; i < li; ++i) {
            this.panels[i].redraw(smooth);
        }

        if (!ignore_drag && this.dragging_playlist !== undefined) {
            this.drag_move(this.dragging_playlist);
        }
    },

    get_playlist_central_time: function(playlist) {
        var start = moment(playlist.get("start"));
        var diff = start.diff(moment(playlist.get("end")));
        return start.subtract("milliseconds", diff / 2);
    },

    configure_shades: function() {
        var self = this;

        if (!self.shades) {
            return false;
        }

        var gross_v = self.svg
            .append("linearGradient")
            .attr("id", "grossFadeToBlack_v")
            .attr("x2", 0)
            .attr("y2", 1);

        var gross_h = self.svg
            .append("linearGradient")
            .attr("id", "grossFadeToBlack_h")
            .attr("x1", 1)
            .attr("x2", 0);

        var thin_h1 = self.svg
            .append("linearGradient")
            .attr("id", "thinFadeToBlack_h1");

        var thin_h2 = self.svg
            .append("linearGradient")
            .attr("id", "thinFadeToBlack_h2")
            .attr("x1", 1)
            .attr("x2", 0);

        var thin_v1 = self.svg
            .append("linearGradient")
            .attr("id", "thinFadeToBlack_v1")
            .attr("x2", 0)
            .attr("y2", 1);

        var thin_v2 = self.svg
            .append("linearGradient")
            .attr("id", "thinFadeToBlack_v2")
            .attr("x2", 0)
            .attr("y2", 0)
            .attr("y1", 1);

        var gross_stops = [[0, 0.4], [0.1, 0.1], [0.5, 0], [0.9, 0.1], [1, 0.4]];
        for (var i = 0, li = gross_stops.length; i < li; ++i) {
            gross_v.append("stop")
                .attr("offset", gross_stops[i][0])
                .attr("stop-color", "#000")
                .attr("stop-opacity", gross_stops[i][1]);
            gross_h.append("stop")
                .attr("offset", gross_stops[i][0])
                .attr("stop-color", "#000")
                .attr("stop-opacity", gross_stops[i][1]);
        }

        var thin_stops = [[0, 0.4], [1, 0]];
        for (var i = 0, li = thin_stops.length; i < li; ++i) {
            thin_h1.append("stop")
                .attr("offset", thin_stops[i][0])
                .attr("stop-color", "#000")
                .attr("stop-opacity", thin_stops[i][1]);
            thin_h2.append("stop")
                .attr("offset", thin_stops[i][0])
                .attr("stop-color", "#000")
                .attr("stop-opacity", thin_stops[i][1]);
            thin_v1.append("stop")
                .attr("offset", thin_stops[i][0])
                .attr("stop-color", "#000")
                .attr("stop-opacity", thin_stops[i][1]);
            thin_v2.append("stop")
                .attr("offset", thin_stops[i][0])
                .attr("stop-color", "#000")
                .attr("stop-opacity", thin_stops[i][1]);
        }
    },

    smoothify: function(elem, smooth) {
        var target = elem;
        if (smooth) {
            target = target.transition().duration(500);
        }
        return target;
    },

    drag_get_time: function(plist) {
        var time;
        for (var i = 0, li = this.panels.length; i < li; ++i) {
            time = time || this.panels[i].drag_get_time(plist);
        }
        return time;
    },

    drag_move: function(plist, panel) {
        var draw = false;
        var occurrence;

        // Get drag position time
        var time = this.drag_get_time(plist);

        if (time) {
            this.dragging_playlist = plist;

            // Setup temporal occurrence
            occurrence = {
                name: plist.get("name"),
                start: time,
                end: time + plist.get("duration"),
                get: function(key) { return this[key]; },
                set: function(key, value) { this[key] = value; },
            };

            if (event.ctrlKey) {
                // Call external push down
                this.data.update(this.callback("fix_overlap", [occurrence]));
                this.redraw(this.config.smooth_drag, true);
                this.data.update(this.callback("restore_overlap"));
            } else {
                // Call external revert
                this.data.update(this.callback("restore_overlap"));
                this.redraw(this.config.smooth_drag, true);
            }
        } else {
            // Call external revert
            this.data.update(this.callback("restore_overlap"));
            this.redraw(this.config.smooth_drag, true);
        }

        var tmp_draw;
        for (var i = 0, li = this.panels.length; i < li; ++i) {
            draw |= this.panels[i].drag_move(plist, occurrence);
        }

        // True if something has been drawn
        return draw;
    },

    drag_clear: function() {
        for (var i = 0, li = this.panels.length; i < li; ++i) {
            this.panels[i].drag_clear();
        }
        this.dragging_playlist = undefined;

        // Call external revert
        this.data.update(this.callback("restore_overlap"));
        this.redraw(this.config.smooth_drag, true);
    },

    drag_end: function(plist, panel) {
        var create = false;
        var time = this.drag_get_time(plist);
        for (var i = 0, li = this.panels.length; i < li; ++i) {
            create = create || this.panels[i].drag_end(plist, time);
        }

        return (create ? time : undefined);
    },

    bind_callback: function(name, callback) {
        return this.callbacks[name] = callback;
    },

    callback: function(name, args) {
        if (this.callbacks[name]) {
            return this.callbacks[name].apply(this, args);
        }
    },

    unbind_all: function() {
        this.callbacks = {};
    },
};

Timeline.HORIZONTAL = 0;
Timeline.VERTICAL = 1;

