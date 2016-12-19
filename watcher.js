'use strict';

var chokidar = require('chokidar');
var _ = require('lodash');

/**
 * @param  {Object} Options for watcher
 *      path     {String} path to watch for
 *      onChange {Function} callback function, called at any fs change event (new file, change, remove, etc.)
 *      debounce {Number} debouncing time of callback function
 *      ignored  {Array} array of strings to ignore
 * @return {Object} Returning watcher
 */
module.exports = function(opts) {

    if (typeof opts.onChange !== 'function') throw new Error('onChange callback should be a function');

    var watcher = chokidar.watch(opts.path || './', {
        ignored: _.union([ 'node_modules', '.git', '.enb' ], opts.ignored),
        persistent: true,
        ignoreInitial: true
    });

    watcher.on('all',
        _.debounce(function(type, cpath) {
            opts.onChange.call(null, cpath);
        }, opts.debounce || 200)
    );

    return watcher;
}
