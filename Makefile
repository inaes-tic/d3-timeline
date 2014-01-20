# Tiny, Quick and Dirty Makefile
GENERATED_FILES = d3-timeline.js \
                  d3-timeline.css \
                  d3-timeline.min.js \

.PHONY: clean all

all: d3-timeline.js

d3-timeline.js:
	node_modules/.bin/grunt

clean:
	rm -f -- $(GENERATED_FILES)
