'use strict';

const path = require('path'),
	assert = require('assert'),
	gulp = require('gulp'),
	read = require('gulp-read'),
	concat = require('gulp-concat'),
	uglify = require('gulp-uglify'),
	rename = require('gulp-rename2'),
	bemhtml = require('gulp-bem-xjst'),
	filter = require('gulp-filter'),
	postcss = require('gulp-postcss'),
	src = require('gulp-enb-src'),
	fs = require('mz/fs');



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
const projectRootDir = path.dirname(process.mainModule.filename);
const defaultBundleDir = path.join(projectRootDir, 'views' );
	
var config = {
	'css' : { ext:[ '.css' ]},
	'js'  : { ext:[ '.js', '.vanilla.js', '.browser.js' ], exclude: [ '.bemtree.js', '.bemhtml.js' ]},
	'bemtree': { ext: [ '.bemtree', '.bemtree.js' ]},
	'bemhtml': { ext: [ '.bemhtml', '.bemhtml.js' ]}
}


var extensions = Array.prototype.concat.apply([], Object.values(config).map(c=>c.ext));
if (debug) console.log( 'extensions', extensions );


module.exports = buildBundle;

function buildBundle( { 
		bundleName = 'index',
		staticDir = 'static', 
		bundleDir = defaultBundleDir,
		buildDir = '.enb/tmp/build',
		levels = []
	} = {}) {
	try {

		Object.values(config).forEach(v => {
			if (!v.ext) return ;
			var re, nre;
			re  = new RegExp( '.*('+v.ext.join('|')+')$' );
			if (v.exclude) nre = new RegExp( '.*('+v.exclude.join('|')+')$' );
			if (debug) console.log( 'Filter by ',  re );
			if (debug && nre) console.log( 'Excluding ', nre );
			v.filter = filter( 
				f => {
					if (nre && nre.test(f.path)) return false; 
					return re.test(f.path)
				},
				{restore: true}
			);
		})

		var original_write;
		levels = globalLevels.concat(levels);
		var declName = path.join(bundleDir, bundleName+'.bemdecl.js');
		delete require.cache[declName];
		var decl = require( declName ).blocks;

		if (debug) {
			console.log( 'decl', decl );
		} else {
			original_write = process.stdout.write;
			process.stdout.write = function(string, encoding, fd) {	};
		}
		
		var inputFiles = src({
			levels,
			decl,
			tech : 'js',
			extensions,
			root: projectRootDir
		});
		
			
		// if (debug)
			// stLog('all', inputFiles)

		return new Promise( (response, reject) => {
			try {
				var unfilteredFiles = enbMakeType('bemtree', inputFiles, bundleName+'.bemtree.js', buildDir, function(stream){
					return stream
						.pipe( bemhtml({}, 'bemtree'))
						.pipe( rename((p, f)=>{ return bundleName+'.bemtree.js'}))

				});

				unfilteredFiles = enbMakeType('bemhtml', unfilteredFiles, bundleName+'.bemhtml.js', buildDir, function(stream){
					return stream
						.pipe( bemhtml({}, 'bemhtml'))
						.pipe( rename((p, f)=>{ return bundleName+'.bemhtml.js'}))
				});	

				unfilteredFiles = enbMakeType('js', unfilteredFiles, bundleName+'.min.js', staticDir, function(stream){
					return stream.pipe( uglify() );
				});

				unfilteredFiles = enbMakeType('css', unfilteredFiles, bundleName+'.min.css', staticDir, function(stream){
					return stream.pipe( postcss(cssProcessors) );
				});

				unfilteredFiles.on('finish', (cb)=>{
					if (!debug)
						process.stdout.write = original_write;
					response(decl);
				})
			} catch (e){
				if (!debug)
					process.stdout.write = original_write;
				console.log( 'e', e );
			}	
		})
	} catch (e){
		if (!debug)
			process.stdout.write = original_write;
		console.log( 'Error', e, s.stack);
	}
	
}
	 	

	
function stLog(descr, st) {
	st.on('data', (f)=>{
		console.log( descr,  f.relative );
	});
}

function enbMakeType( type, inStream, fileName, dst, pipeline) {
	var one = inStream
		.pipe( config[type].filter )
		.pipe( read() );
	if (debug) stLog( ''+type,  one);
	var two = pipeline( one.pipe( concat(fileName)) )
		.pipe( gulp.dest(dst));
	chechCleaner(path.join(dst, fileName), two);
	if (debug) 
		stLog( ''+type+' => ', two );
	return two.pipe( config[type].filter.restore );
}


function chechCleaner( file, stream){
	var count = 0;
	stream.on('finish', ()=>{
		if (count == 0) {
			fs.access(file)
				.then(()=>{
					if (debug) 
						console.log( 'Empty output => cleaning cache file', file );
					return fs.unlink(file);
				}).catch((e)=>{})
		}
	});
	stream.on('data', ()=>{	count++; });
}
