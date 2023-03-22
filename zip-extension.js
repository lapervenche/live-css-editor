#!/usr/bin/env node
/* eslint-env node */

var fs = require('fs'),
    cpFile = require('cp-file'),
    del = require('del'),
    archiver = require('archiver'),
    chalk = require('chalk');

var processCommand = process.title + ' ' + require('path').relative(__dirname, process.argv[1]);
console.log(chalk.gray([
    '',
    'Format:   ' + processCommand + ' [chrome/edge/firefox/opera]',
    'Examples: ' + processCommand,
    '          ' + processCommand + ' chrome',
    '          ' + processCommand + ' edge',
    ''
].join('\n')));

var whichBrowser = process.argv[2] || 'chrome';

var zipFileName = null;
switch (whichBrowser) {
    case 'chrome':  zipFileName = 'extension-chrome.zip';  break;
    case 'edge':    zipFileName = 'extension-edge.zip';    break;
    case 'firefox': zipFileName = 'extension-firefox.zip'; break;
    case 'opera':   zipFileName = 'extension-opera.zip';   break;
    default:
        console.log(chalk.red('Error: Please pass a supported browser name as parameter (or no parameters)'));
        process.exit(1);
}

if (fs.readFileSync(__dirname + '/extension-dist/manifest.json', 'utf8') !== fs.readFileSync(__dirname + '/extension-dist/manifest-chrome.json', 'utf8')) {
    console.log(chalk.yellow('Warning: extension-dist/manifest.json & extension-dist/manifest-chrome.json do not match.\nThey must have same contents before zipping the extension with this script. Exiting.'));
    process.exit(1);
}

// create a file to stream archive data to.
var output = fs.createWriteStream(__dirname + '/' + zipFileName);
var archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
});

var warnUserToCheckManifestFile = function (e) {
    console.log(chalk.yellow('\nWarning: Due to this error, the file extension-dist/manifest.json might have been modified/deleted. Please check manually.\n'));
    throw e;
};

// listen for all archive data to be written
output.on('close', function() {
    try {
        del.sync(['extension-dist/manifest.json']);
        cpFile.sync('extension-dist/manifest-chrome.json', 'extension-dist/manifest.json', {overwrite: false});

        console.log(chalk.green('The extension has been zipped as: ' + zipFileName + ' (' + archive.pointer() + ' bytes)'));
    } catch (e) {
        warnUserToCheckManifestFile(e);
    }
});

// good practice to catch error explicitly
archive.on('error', function(e) {
    console.log(chalk.red('Error: An unexpected error occurred in zipping the extension.'));
    warnUserToCheckManifestFile(e);
});

// pipe archive data to the file
archive.pipe(output);

try {
    del.sync(['extension-dist/manifest.json']);
    cpFile.sync(
        'extension-dist/' +
            (function () {
                switch (whichBrowser) {
                    case 'chrome':  return 'manifest-chrome.json';
                    case 'edge':    return 'manifest-edge.json';
                    case 'firefox': return 'manifest-firefox.json';
                    case 'opera':   return 'manifest-opera.json';
                    default:        return 'manifest-chrome.json';
                }
            }()),
        'extension-dist/manifest.json',
        {overwrite: false}
    );

    archive.glob('**/*', {
        cwd: __dirname + '/extension-dist',
        ignore: (function () {
            var pathsToIgnore = [
                // 'manifest-generator.js',
                'manifest-chrome.json',
                'manifest-edge.json',
                'manifest-firefox.json',
                'manifest-opera.json',
                'manifest-puppeteer.json'
                // 'ui-images/**/*.*',     // Exclude files in "ui-images" folder
                // 'ui-images'             // Avoid "ui-images" folder from getting created
            ];
            if (whichBrowser !== 'opera') {
                pathsToIgnore.push('scripts/3rdparty/sass/**');
            }
            return pathsToIgnore;
        }())
    }, {});

    // finalize the archive (ie we are done appending files but streams have to finish yet)
    archive.finalize();
} catch (e) {
    warnUserToCheckManifestFile(e);
}
