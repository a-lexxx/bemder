
const path = require('path'),
	fs = require('mz/fs'),
	enbMake = require('./enb');

// var blocksDir = 'blocks/**',
// 	views,
// 	filesRegex = /(.+)\.(bemhtml|bemtree)\.js$/i,
// 	watcher = 'chokidar',
// 	watcherOpts =  [ blocksDir, '--silent', '--initial', '-c', 'enb make' ];

const del = '\n' + '-'.repeat(40) + '\n';
const debug = false;
function _d(){
	if (debug)
		console.log.apply(console, arguments);
}
// watchThemAll();

var buildDir =  path.join(process.cwd(), '.enb/tmp/build');


module.exports.render = function(name, options, calabock){
	var view, waiter = [],
		vname = path.dirname(name),
		base = path.basename(name).replace(/\.bem(html|tree|decl)\.js/i, ''),
		bhtmlFile = path.join(buildDir, base + '.bemhtml.js'),
		btreeFile = path.join(buildDir, base + '.bemtree.js'),
		bemjson, html, decl;
		
	_d( 'name', name, base, vname, btreeFile); //, del, this, del, options);

	enbMake({bundleName: base, levels: ['blocks'], buildDir})
		.then( (cdecl) => {
			decl = cdecl;
			var rootRender = options.enbRoot ? options.enbRoot : 
				( ( (decl) && (decl[0]) && (decl[0].block)) ? decl[0].block : 'root');
			delete require.cache[ btreeFile ];
			var bTree = require( btreeFile );

			if (bTree.BEMTREE) bTree = bTree.BEMTREE;
			bemjson = bTree.apply({
				block: rootRender,
				data: options
			});
		}).catch((e)=>{ 
			if ((e.code == "MODULE_NOT_FOUND") || (e.syscall == 'open') ) {	// мы тут если файла bemtree нe существует
				bemjson = decl;
			} else throw e;					// всё остальное пробрасываем дальше
		}).then(()=>{
			_d( 'bemjson', JSON.stringify(bemjson, null, 2) );
			delete require.cache[ bhtmlFile ];
			var bHtml = require( bhtmlFile );
			if (bHtml.BEMHTML) bTree = bHtml.BEMHTML;

			html = bHtml.apply(bemjson);

		}).catch((e)=>{
			if ((e.code == "MODULE_NOT_FOUND") || (e.syscall == 'open')) {	// мы тут если файла bemtree нe существует
				html = bemjson;
			} else throw e;					// всё остальное пробрасываем дальше
		}).then(()=>{
			_d( 'html:\n', html );
			calabock(null, html);
		})
		.catch( e => {
			calabock(e, null);
		})
}



// function precompileViews(dir) {
// 	return new Promise((resolv, reject)=>{
// 		views = {};
// 		fs.readdir(dir, (err, files)=>{
// 			if (err) throw err;
// 			files.forEach(f => { 
// 				console.log( 'compiling file ', f );
// 				var name, res = filesRegex.exec(f);
// 				if (res != null) {
// 					name = res[1];
// 					if (views[name] == null) views[name] = {};
// 					views[name][res[2]] = path.join(dir, res[0]);
// 				}
// 			});
// 			console.log( 'views', views );
// 			Object.keys(views).forEach(view=>{
// 				var view = views[key];
// 				if (view['bemhtml']) {
// 					view.tmpl = bemhtml.compile( fs.readFileSync(view['bemhtml'], 'utf8') );
// 				}
// 				if (view['bemtree']) {
// 					view.btTmpl = bemtree.compile(fs.readFileSync(view['bemtree'], 'utf8'));
// 				}
// 			})
// 			resolv(views);
// 		})	
// 	})
	
// }


// function watchThemAll() {
// 	var enbd = '.enb',
// 		makef = path.join(enbd, 'make.js'),
// 		src = path.join(path.dirname(module.filename), '/.enb/make.js')
// 	mkdir.sync(enbd);
// 	if ( !fs.existsSync( makef )) {
// 		console.log( 'enb conf does not exist', src, makef );
// 		fs.createReadStream(src).pipe(fs.createWriteStream( makef ));
// 	}
// 	console.log( 'Watching for ',  watcherOpts[0]);
// 	forker(watcher, watcherOpts, { }, (error, stdout, stderr)=>{
//         // врядли сюда что-то попадёт в нормальной ситуации
//         console.log( 'Error', error, stderr, stdout );
//     });
// }

// 
