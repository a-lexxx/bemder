'use strict';

const path = require('path'),
	assert = require('assert'),
	gulp = require('gulp'),
	read = require('gulp-read'),
	concat = require('gulp-concat'),
	uglify = require('gulp-uglify'),
	rename = require('gulp-rename2'),
	bemhtml = require('gulp-bem-xjst'),
	makeGulpFilter = require('gulp-filter'),
	postcss = require('gulp-postcss'),
	src = require('gulp-enb-src'),
	fs = require('mz/fs'),
	watcherBuilder = require('./watcher'),
	crypto = require('crypto');

function genIdx(...a){
	return crypto.createHash('md5').update( JSON.stringify(a)).digest('hex');
}

function textEscapeForRE(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&').replace(/\n|\r|\n\r|\r\n/g, '');
}

const autoprefixer = require('autoprefixer');
var cssProcessors = [ autoprefixer({browsers: ['ie >= 10', 'last 2 versions', 'opera 12.1', '> 2%']}) ];

const globalLevels = [
	{ path: 'libs/bem-core/common.blocks', check: false },
	{ path: 'libs/bem-core/desktop.blocks', check: false },
	{ path: 'libs/bem-components/common.blocks', check: false },
	{ path: 'libs/bem-components/desktop.blocks', check: false },
	{ path: 'libs/bem-components/design/common.blocks', check: false },
	{ path: 'libs/bem-components/design/desktop.blocks', check: false }
].filter( p => {
	var stat;
	try {
		stat = fs.statSync(p.path);
		return stat.isDirectory();
	} catch (e){ };
	return false;
} );

var debug = true;
var log = (!debug) ? ( )=>{ } : function(){ console.log.apply(console, arguments) };


const projectRootDir = path.dirname(process.mainModule.filename);
const defaultBundleDir = path.join(projectRootDir, 'views' );
var watcher, 
	goodCache = { },
	promiseChain = null,
	waiters = 0;
	
var config = {
	'css' : { ext:[ '.css' ]},
	'js'  : { ext:[ '.js', '.vanilla.js', '.browser.js' ], exclude: [ '.bemtree.js', '.bemhtml.js' ]},
	'bemtree': { ext: [ '.bemtree', '.bemtree.js' ]},
	'bemhtml': { ext: [ '.bemhtml', '.bemhtml.js' ]}
}


var extensions = Array.prototype.concat.apply([], Object.values(config).map(c=>c.ext));
log( 'extensions', extensions );


Object.values(config).forEach(v => {
	if (!v.ext) return ;
	v.re  = new RegExp( '.*('+v.ext.map(textEscapeForRE).join('|')+')$' );
	if (v.exclude) v.excludeRe = new RegExp( '.*('+v.exclude.map(textEscapeForRE).join('|')+')$' );
	log( 'Filter by ', v.re );
	if (v.excludeRe) log( 'Excluding ', v.excludeRe );
})

module.exports = buildBundle;

function buildBundle( { 
		bundleName = 'index',
		staticDir = 'static', 
		bundleDir = defaultBundleDir,
		buildDir = '.enb/tmp/build',
		levels = []
	} = {}) {

	levels = globalLevels.concat(levels);
	var curConfHash = genIdx(levels, bundleDir, buildDir, staticDir, bundleName);
	
	var declName = path.join(bundleDir, bundleName+'.bemdecl.js');
	delete require.cache[declName];
	var decl = require( declName ).blocks;

	if (watcher == null) {
		watcher = watcherBuilder({ 
			path: levels.concat([bundleDir]).map(p => ((typeof p == 'string') ? p : p.path)), 
			options: {debug: true}, 
			onChange: function(args){
				log(`FS event: ${type} ${cpath} => invalidate cache`);
				goodCache = { };
			} }
		);
	} else {

		if (goodCache[curConfHash] === true) {
			return new Promise(
				(resolve, rej) => {
					resolve(decl) 
				}
			);
		}

		if ( waiters > 0 ) {
			waiters++;
			return (promiseChain = promiseChain.then(() => {
				return doBuildBundle();
			}))
		}
	}

	waiters++;
	return (promiseChain = doBuildBundle( ));


	function doBuildBundle() {

		if (goodCache[curConfHash] === true) {
			return new Promise(
				(resolve, rej) => {
					resolve(decl) 
				}
			);
		}

		var promo = new Promise( (resolve, reject) => {
			try {
			
				var original_write;

				if (debug) {
					log( 'decl', decl );
				} else {
					original_write = process.stdout.write;
					process.stdout.write = function(string, encoding, fd) {	};
				}
				
				var inputFiles = src({
					levels,
					decl,
					tech : 'css', // ?
					extensions,
					root: projectRootDir
				});
			
				// if (debug)
				// 	stLog('all', inputFiles)

		
				var unfilteredFiles = enbMakeTech('bemtree', inputFiles, bundleName+'.bemtree.js', buildDir, function(stream){
					return stream
						.pipe( bemhtml({}, 'bemtree'))
						.pipe( rename((p, f)=>{ return bundleName+'.bemtree.js'}))
				});

				unfilteredFiles = enbMakeTech('css', unfilteredFiles, bundleName+'.min.css', staticDir, function(stream){
					return stream.pipe( postcss(cssProcessors) );
				});

				unfilteredFiles = enbMakeTech('bemhtml', unfilteredFiles, bundleName+'.bemhtml.js', buildDir, function(stream){
					return stream
						.pipe( bemhtml({}, 'bemhtml'))
						.pipe( rename((p, f)=>{ return bundleName+'.bemhtml.js'}))
				});	

				unfilteredFiles = enbMakeTech('js', unfilteredFiles, bundleName+'.min.js', staticDir, function(stream){
					return stream.pipe( uglify() );
				});


				unfilteredFiles.on('finish', (cb)=>{
					if (!debug)
						process.stdout.write = original_write;
					goodCache[curConfHash] = true;
					waiters--;
					resolve(decl);
					// resolve(decl);
				})
			} catch (e){
				if (!debug)
					process.stdout.write = original_write;
				console.log( 'e', e );
				waiters--;
				reject(e);
			}	
		})
		
		return promo;
	}
}

	
function stLog(descr, st) {
	st.on('data', (f)=>{
		log( descr,  f.relative );
	});
}

function enbMakeTech( type, inStream, fileName, dst, pipeline) {
	var conf = config[type],
		filt = makeGulpFilter( 
			f => {
				if (conf.excludeRe && conf.excludeRe.test(f.path)) return false; 
				return conf.re.test(f.path)
			},
			{restore: true}
		);
	var one = inStream
		.pipe( filt )
		.pipe( read() );
	if (debug) stLog( ''+type,  one);
	var two = pipeline( one.pipe( concat(fileName)) )
		.pipe( gulp.dest(dst));
	cacheCleaner(path.join(dst, fileName), two);
	if (debug) 
		stLog( ''+type+' => ', two );
	return two.pipe( filt.restore );
}


function cacheCleaner( file, stream){
	var count = 0;
	stream.on('finish', ()=>{
		if (count == 0) {
			fs.access(file)
				.then(()=>{
					log( 'Empty output => cleaning cache file', file );
					return fs.unlink(file);
				}).catch((e)=>{})
		}
	});
	stream.on('data', ()=>{	count++; });
}
