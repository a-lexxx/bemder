'use strict';

var chokidar = require('chokidar');
var _ = require('lodash');

function getDiff(dst, src, retval) {
	var d;
	if (src != null){
		if (!(src instanceof Array)) src = [ src ];
		d = _.difference( _.compact( src ), dst);
		if (d.length) 
			return d;
	}
	return null;
}

module.exports = function({
		path = './',
		ignored = ['node_modules', '.git', '.enb'],
		onChange,
		options
} = {}) {


	options = Object.assign({
		debug: false,
		debounce: 200
	}, options);

	if (typeof onChange != 'function') throw new Error('onChange callback should be a function');

	var changeHandler = _.debounce (function (type, cpath){
		onChange.call(null, cpath);
	}, options.debounce);

	var watcher = chokidar.watch(path, {
		ignored,
		persistent: true,
		ignoreInitial: true
	});
	
	watcher.on('all', changeHandler);
	
}