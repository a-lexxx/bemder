'use strict';

var chokidar = require('chokidar');
var _ = require('lodash');

/**
 * @param {Object} opts - Options for watcher
 * @param {string} opts.path - path to watch for
 * @param {function} opts.onChange - callback function, called at any fs change event (new file, change, remove, etc.)
 * @param {number} opts.debounce - debouncing time of callback function
 * @param {Array} opts.ignored  - array of file path parts to ignore (defaults: ['node_modules', '.git', '.enb'])
 * @return {Object} Returning watcher
 */
module.exports = function(opts) {

    if (typeof opts.onChange !== 'function') throw new Error('onChange callback should be a function');

    var watcher = chokidar.watch(opts.path || './', {
        ignored: _.union(['node_modules', '.git', '.enb'], opts.ignored),
        persistent: true,
        ignoreInitial: true
    });

    watcher.on('all',
        _.debounce(function(type, cpath) {
            opts.onChange.call(null, cpath);
        }, opts.debounce || 300)
    );

    return watcher;
};
