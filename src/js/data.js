/*
 *  Data - the overall data manager
 */

function Data() {
    this.init.apply(this, arguments);
};

Data.prototype = {
    init: function(timeline, config) {
        var self = this;
        self.timeline = timeline;

        self.filter_bounds = {};
    },

    update: function(data, fetched_bounds) {
        this.data = data;
        this.fetched_bounds = fetched_bounds || this.fetched_bounds;

        // Filter data
        this.cache_filtered_data(true);
    },

    cache_filtered_data: function(force_filter) {
        var self = this;

        var filter_bounds = self.timeline.get_max_bounds();

        if (force_filter || filter_bounds.start != self.filter_bounds.start || filter_bounds.end != self.filter_bounds.end) {
            self.filter_bounds = filter_bounds;

            self.filtered_data = self.data.filter(function(elem) {
                return (
                    elem.get("start") < self.filter_bounds.end &&
                    elem.get("end") > self.filter_bounds.start
                );
            });

            this.update_empty_spaces();
            this.update_start_places();
        }

        return self.filtered_data;
    },

    update_empty_spaces: function() {
        var self = this;

        var start_list = [];
        var end_list = [];

        for (var i = 0, li = self.filtered_data.length; i < li; ++i) {
            var pl = self.filtered_data[i];
            var tmp_start = pl.get("start");

            var is_end = _.indexOf(end_list, tmp_start, true);
            if (is_end > -1) {
                end_list.splice(is_end, 1);
            } else {
                start_list.splice(_.sortedIndex(start_list, tmp_start), 0, tmp_start);
            }

            var tmp_end = pl.get("end");
            var tmp_diff_end = Math.abs(tmp_end - time);

            var is_start = _.indexOf(start_list, tmp_end, true);
            if (is_start > -1) {
                start_list.splice(is_start, 1);
            } else {
                end_list.splice(_.sortedIndex(end_list, tmp_end), 0, tmp_end);
            }
        }

        self.empty_spaces = [];
        var carry = -Infinity;
        for (var i = 0, li = start_list.length; i < li; ++i) {
            self.empty_spaces.push({
                start: carry,
                end: start_list[i],
                duration: start_list[i] - carry,
                get: function(key) { return this[key]; },
            });
            carry = end_list[i];
        }
        self.empty_spaces.push({
            start: carry,
            end: Infinity,
            duration: Infinity - carry,
            get: function(key) { return this[key]; },
        });
    },

    update_start_places: function() {
        var self = this;

        self.start_places = self.filtered_data.map(function(elem) {
            return elem.get("start");
        });
    },
};
