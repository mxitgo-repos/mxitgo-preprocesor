const logger = require('./logging');
const {
    readFileSync,
    writeFileSync,
    existsSync,
    mkdirSync,
    readdirSync,
    chmodSync,
    readlinkSync,
    lstatSync
} = require('fs');
const { tmpdir } = require('os');
const { join, isAbsolute, resolve, sep, basename, dirname } = require('path');
const { spawn } = require('child_process');
const { inblack, inblue, inyellow, ingreen, incyan, inwhite, inmagenta } = require('./colorize');


exports.stripComments = text => {
    const lines = text.split("\n");
    var newLines = [];
    lines.forEach(line => {
        var index = line.lastIndexOf('//');
        if (index < 0) {
            newLines.push(line);
            return;
        }
        if (index > 0 && line[index - 1] === ':') {
            newLines.push(line);
            return;
        }
        var newLine = line.substr(0, index);
        newLines.push(newLine);
    });
    return newLines.join("\n");
};

/**
 * merges defaultObj into obj
 */
exports.merge = (obj, defaultObj) => {
    if (!defaultObj) return obj;
    if (typeof defaultObj !== 'object' || typeof obj !== 'object') {
        return obj;
    }
    for (var prop in defaultObj) {
        if (typeof obj[prop] === 'undefined') {
            obj[prop] = defaultObj[prop];
        }
    }
    return obj;
};

/**
 * returns the value of the field in obj, the value of which returns
 * true for the matchFun, where field is one of fieldNames. Default matchFun
 * checks for !== undefined
 */
exports.getFirstMatchingField = (obj, fieldNames, matchFun) => {
    if ((typeof matchFun) !== "function") {
        matchFun = (value => ((typeof value) !== "undefined"));
    }
    if (typeof obj !== "object") {
        return null;
    }
    for (var i = 0; i < fieldNames.length; i++) {
        var fname = fieldNames[i];
        var value = obj[fname];
        if (!matchFun(value)) continue;
        return value;
    }
    return null;
};


exports.runSystemCommand = (cmd, options) => {
    const cmdId = (options && options.cmdId) ? options.cmdId : "command";
    const cmdFile = join(tmpdir(), `tmp-${cmdId}.sh`);
    console.log(cmdFile);
    const script = `#!/bin/sh
${cmd}
`;
    writeFileSync(cmdFile, script, 'utf-8');
    chmodSync(cmdFile, '0755');
    spawn(cmdFile, [], { stdio: 'inherit' });
}

exports.userConfirmOperation = function(message, callback) {
    const prompt = require('prompt');
    var schema = {
        properties: {
            answer: {
                description: ingreen(message),
                pattern: /^(y(es)?|no?)$/,
                message: 'please answer yes or no',
                required: true
            }
        }
    };
    prompt.message = "*** ";
    prompt.delimiter = "";
    prompt.start();
    prompt.get(schema, (err, config) => {
        if (err) return;
        if (config.answer.startsWith('n')) {
            console.log(inblack("ok, nothing done."));
            return;
        }
        if (typeof callback === "function") {
            callback.call();
        }
    });
};



exports.mkdirRecursiveSync = function(targetDir, { isRelativeToScript = false } = {}) {
    const initDir = isAbsolute(targetDir) ? sep : '';
    const baseDir = isRelativeToScript ? __dirname : '.';

    return targetDir.split(sep).reduce((parentDir, childDir) => {
        const curDir = resolve(baseDir, parentDir, childDir);
        try {
            mkdirSync(curDir);
        } catch (err) {
            if (err.code === 'EEXIST') { // curDir already exists!
                return curDir;
            }

            // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
            if (err.code === 'ENOENT') { // Throw the original parentDir error on curDir `ENOENT` failure.
                throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`);
            }

            const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;
            if (!caughtErr || caughtErr && targetDir === curDir) {
                throw err; // Throw if it's just the last created dir.
            }
        }

        return curDir;
    }, initDir);
}

/**
 * replaces '~' or '$HOME' in value with the value of the $HOME environment variable
 */
exports.replaceDollarHome = value => {
    const homePattern = ['$HOME', '~'];
    if (typeof value !== 'string') return value;
    homePattern.forEach(pat => {
        var index = value.indexOf(pat);
        if (index >= 0) {
            return value.replace(pat, process.env.HOME);
        }
    })
}


/**
 *
 */
//exports.guessProjectId = keyFile => {
//    const fileName = exports.replaceDollarHome(basename(keyFile));
//    console.log(fileName);
//}

exports.toCamelCase = id => {
    const parts = id.toLowerCase().split(/_+([A-Za-z])/);
    var res = "";
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            res += parts[i];
        } else {
            res += parts[i].toUpperCase()
        }
    }
    return res;
}

// --------------------------------------------------------------------------------

exports.resolveLink = fileName => {
    const _resolveLink = (fname) => {
        if (lstatSync(fname).isSymbolicLink()) {
            const resolved = readlinkSync(fname, 'utf-8');
            if (isAbsolute(resolved)) {
                return resolved
            }
            const dname = dirname(fname)
            const fname1 = join(dname, resolved)
            return _resolveLink(fname1)
        }
        return fname;
    }
    if (lstatSync(fileName).isSymbolicLink()) {
        //logger.info(inmagenta(`found symnbolic link ${fileName}`))
        const resolved = _resolveLink(fileName)
        logger.info(inmagenta(`-> resolved to ${resolved}`))
        return resolved
    }
    return fileName;
}

// --------------------------------------------------------------------------------

if (module === require.main) {
    console.log(exports.resolveLink(process.argv[2]));
}