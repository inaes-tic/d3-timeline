module.exports = function(grunt) {
    grunt.initConfig({

        src: {
            js: ["src/js/timeline.js", "src/js/data.js", "src/js/panel.js"],
            less: ["src/less/main.less"],
        },

        indent: {
            release: {
                src: "<%= src.js %>",
                dest: "build-tmp/",
                options: {
                    style: "space",
                    size: 4,
                    change: 1,
                },
            },
        },

        less: {
            development: {
                options: {
                    paths: ["src/css"]
                },
                files: {
                    "d3-timeline.css": "src/less/timeline.less"
                },
            },
            production: {
                options: {
                    paths: ["src/css"],
                    cleancss: true
                },
                files: {
                    "d3-timeline.css": "src/less/timeline.less"
                },
            },
        },

        concat: {
            release: {
                src: ["LICENSE", "src/js/start.js", "build-tmp/timeline.js", "build-tmp/data.js", "build-tmp/panel.js", "src/js/end.js"],
                dest: "d3-timeline.js",
                nonull: true,
            },
        },

        uglify: {
            options: {
                report: "min",
            },
            release: {
                files: {
                    "d3-timeline.min.js": ["d3-timeline.js"],
                },
            },
        },

        clean: {
            build: {
                src: "build-tmp/",
            },
        },
    });

    // Load indent task
    grunt.loadNpmTasks('grunt-indent');

    // Load concat task
    grunt.loadNpmTasks("grunt-contrib-less");

    // Load concat task
    grunt.loadNpmTasks("grunt-contrib-concat");

    // Load uglify task
    grunt.loadNpmTasks('grunt-contrib-uglify');

    // Load clean task
    grunt.loadNpmTasks('grunt-contrib-clean');

    // Default task.
    grunt.registerTask("default", ["indent", "less:development", "concat", "uglify", "clean"]);

};
