
const fs = require('fs'),
	path = require('path'),
	bemxjst = require('bem-xjst'),
	mkdir = require('mkdirp'),
	bemhtml = bemxjst.bemhtml,
	bemtree = bemxjst.bemtree,
	forker = require('child_process').execFile;

var blocksDir = 'blocks/**',
	views,
	filesRegex = /(.+)\.(bemhtml|bemtree)\.js$/i,
	watcher = 'chokidar',
	watcherOpts =  [ blocksDir, '--silent', '--initial', '-c', 'enb make' ];


watchThemAll();

module.exports.render = function(name, options, calabock){
	var view, waiter = [],
		vname = path.dirname(name),
		base = path.basename(name).replace(/\.(bemhtml|bemtree)\.js/i, ''),
		bhtmlFile = base + '.bemhtml.js',
		btreeFile = base + '.bemtree.js';

	// view = views[vname];
	// if (view == null) {
	// 	view = views[vname] = {
	// 		btTmpl : 
	// 	};
	// }
	
	console.log( 'name %s => %s:%s', name, bhtmlFile, btreeFile );
	var bTree = require(path.join(vname, btreeFile)).BEMTREE,
		bHtml = require(path.join(vname, bhtmlFile)).BEMHTML,
		bemjson = bTree.apply({
			block: 'root',
			data: options
		}),
		html;
	console.log( 'bemjson', JSON.stringify(bemjson, null, 2) );
	// } else {
	// 	bemjson = options;
	// }
	// if (view.tmpl) {
		html = bHtml.apply(bemjson);
		console.log( 'html:\n', html );
	// } else {
		// html = bemjson;
	// }
	calabock(null, html);
}

function precompileViews(dir) {
	return new Promise((resolv, reject)=>{
		views = {};
		fs.readdir(dir, (err, files)=>{
			if (err) throw err;
			files.forEach(f => { 
				console.log( 'compiling file ', f );
				var name, res = filesRegex.exec(f);
				if (res != null) {
					name = res[1];
					if (views[name] == null) views[name] = {};
					views[name][res[2]] = path.join(dir, res[0]);
				}
			});
			console.log( 'views', views );
			Object.keys(views).forEach(view=>{
				var view = views[key];
				if (view['bemhtml']) {
					view.tmpl = bemhtml.compile( fs.readFileSync(view['bemhtml'], 'utf8') );
				}
				if (view['bemtree']) {
					view.btTmpl = bemtree.compile(fs.readFileSync(view['bemtree'], 'utf8'));
				}
			})
			resolv(views);
		})	
	})
	
}


function watchThemAll() {
	var enbd = '.enb',
		makef = path.join(enbd, 'make.js'),
		src = path.join(path.dirname(module.filename), '/.enb/make.js')
	mkdir.sync(enbd);
	if ( !fs.existsSync( makef )) {
		console.log( 'enb conf does not exist', src, makef );
		fs.createReadStream(src).pipe(fs.createWriteStream( makef ));
	}
	console.log( 'Watching for ',  watcherOpts[0]);
	forker(watcher, watcherOpts, { }, (error, stdout, stderr)=>{
        // врядли сюда что-то попадёт в нормальной ситуации
        console.log( 'Error', error, stderr, stdout );
    });
}

// 
