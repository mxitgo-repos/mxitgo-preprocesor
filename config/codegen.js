/**
 *
 * Generates source code using annotated JavaScript files
 * 
 * It uses special comment lines starting with //! to generate code. For instance,
 * //! if (condition) {
 * some piece of code1
 * //! } else {
 * some other code
 * }
 * 
 * if "condition" is true during generation time, then "some piece of code" is generated,
 * otherwise "some other code".
 * 
 * - all //! lines taken together in a file must make up valid Javascript code.
 * - backward quotes notation can *not* be used in the input files
 * - the code generator expects an object as argument, which will be made available
 *   using a "with" statement, so that the directives can use the fields in this
 *   object without any prefix. (For instance, "condition" could have been a field
 *   in the input object in the above example)
 */

const {
    readFileSync,
    writeFileSync,
    existsSync,
    mkdirSync,
    readdirSync
} = require('fs');

const {
    tmpdir
} = require('os');

const logger = require('./logging');

const { inblue, inyellow, ingreen, incyan, inwhite, inmagenta, inred } = require('./colorize');

const path = require('path');

const { runSystemCommand } = require('./utils');

const readingDirective = 0;
const readingCode = 1;

const jsLineRe = new RegExp('^\\s*//!\\s*(.*)\\s*$');
const jsLineIncludeRe = new RegExp('^\\s*//!\\s*include\\((.*)\\)\\s*$')

const generateModuleCode = (fileName, options) => {
    if (!existsSync(fileName)) {
        throw `no such file: "${fileName}"`
    }
    const isJavascriptFile = fileName.endsWith(".js");
    const macroCode = options ? options.macroCode : "";
    const defaultValueForUndefined = options && options.defaultValueForUndefined ? options.defaultValueForUndefined : {}
    var s = `/*
 * Code generation from ${fileName}
 */

const _getProxy = obj => {
    return new Proxy(obj, {
	get(receiver, name) {
	    let resObj = {}
	    if (name in receiver) {
		resObj = receiver[name]
	    }
            if (typeof resObj !== 'object') {
               return resObj
            }
	    resObj
	}
    })
}

exports.generateCode = (appSpec, missingVariables) => {

  var code = '';
  var $readsConfig = false;
`;
    if (isJavascriptFile) {
        s += ' if (appSpec.config && appSpec.config.includeAppSpecInJavascriptFiles) {\n'
        s += `  code += 'const $__config__ = JSON.parse(\\'' + JSON.stringify(appSpec) + '\\');\\n'
  code += 'with($__config__) {\\n';
`
        s += '}\n'
    }
    s += `
const __tryFixingReferenceError = (err) => {
    if (err instanceof ReferenceError) {
	let msg = String(err)
	//console.log(msg)
	let m = msg.match(/^ReferenceError:\\s*(\\S+)\\s*is\\s+not\\s+defined$/)
	if (m) {
            const vname = m[1]
	    console.log('fixing undefined reference for "' + m[1] + '"')
            if (missingVariables) {
               missingVariables.push(vname)
            }
	    return vname
	} else {
	    throw err
	}
    } else {
	throw err
    }
}
var code0 = code
for(let __i = 0; __i<100; __i++) {
`
    s += `  with(appSpec) {
${macroCode}
  try {
`
    const _getFileLines = fileName => {
        const fileContent = readFileSync(fileName, 'utf-8')
        return fileContent.split("\n");
    }
    var clines = [];
    var includeFileNames = []
    const fileContent = readFileSync(fileName, 'utf-8')
        //console.log(inred(fileContent))
    var lines = fileContent.split("\n");
    // add a directive line at the end to ensure for-loop below
    // never exits in "readingCode" mode
    lines.push(`//! `);
    //lines.push('');
    var userCodeLines = [];
    const _collectUserCodeLines = () => {
        clines.push('if ($readsConfig) {')
        var isFirstLine = true;
        userCodeLines.forEach(userCodeLine => {
            var codeLine = isFirstLine ? "code += `" : "";
            isFirstLine = false;
            codeLine += userCodeLine.light;
            //clines.push(codeLine)
        })
        clines.push('} else {')
        isFirstLine = true;
        userCodeLines.forEach(userCodeLine => {
            var codeLine = isFirstLine ? "code += `" : "";
            isFirstLine = false;
            codeLine += userCodeLine.full;
            clines.push(codeLine)
        })
        clines.push('}')
        userCodeLines = [];
    }
    const _getIncludeFilenameFromPath = includePath => {
        let dirname = path.dirname(fileName)
        return path.resolve(path.join(dirname, includePath))
    }
    const _includeFile = (includeFileName, atIndex) => {
        if (includeFileNames.indexOf(includeFileName) >= 0) {
            console.error(inred(`refusing to include file "${includeFileName}" as it is already beeing included`))
            return false
        }
        includeFileNames.push(includeFileName)
        const includeLines = _getFileLines(includeFileName)
        lines.splice(atIndex, 1, ...includeLines)
        return true
    }
    var mode = readingDirective;
    for (var i = 0;; i++) {
        if (i >= lines.length) break
        var line = lines[i];
        var m = line.match(jsLineRe);
        if (m) {
            var includeLineMatch = line.match(jsLineIncludeRe)
            if (includeLineMatch) {
                let includePath = eval(includeLineMatch[1])
                let fullIncludePath = _getIncludeFilenameFromPath(includePath)
                console.log(inred(`include match: ${fullIncludePath}`))
                _includeFile(fullIncludePath) && i--
                    continue
            }
            var jscode = m[1];
            if (jscode === '(') {
                jscode = '((function () { var code = "";';
            } else if (jscode === ')') {
                jscode = 'return code; })());';
            }
            switch (mode) {
                case readingCode:
                    const endCodeLinesString = '`;';
                    userCodeLines.push({ light: endCodeLinesString, full: endCodeLinesString });
                    _collectUserCodeLines()
                        //--clines.push(endCodeLinesString);
                    mode = readingDirective;
                    clines.push(jscode);
                    break;
                case readingDirective:
                    clines.push(jscode);
                    break;
            }
        } else {
            // not a directive line
            var codeLine = "";
            var userCodeLineEntry = { light: "", full: "" };
            switch (mode) {
                case readingDirective:
                    //--codeLine += "code += `"
                    userCodeLines = []
                    mode = readingCode;
                case readingCode:
                    //--codeLine += _codeLine(line);
                    userCodeLineEntry = { light: _escape(line), full: _fullEscape(line) };
                    break;
            }
            userCodeLines.push(userCodeLineEntry)
                //--clines.push(codeLine);
        }
    }
    // we prevented the for loop to exit in "readingCode" mode
    // because we added a directive line
    //if (mode === readingCode) {
    //	clines.push('`;');
    //}
    clines.push('');
    if (isJavascriptFile) {
        clines.push('if (appSpec.config && appSpec.config.includeAppSpecInJavascriptFiles) {\n')
        clines.push("code += '}'");
        clines.push('}\n')
    }
    s += clines.join("\n");
    s +=
        `
          break
        } catch (err) {
          let varname = __tryFixingReferenceError(err)
          appSpec[varname] = {}
          code = code0
          //throw err
        }
     }
   }
   //console.log(code)
   return code;
}
`
        //console.log(s);
    return s;
}

const _codeLine = line => {
    const lightEscaped = _escape(line);
    const fullEscaped = _fullEscape(line);
    return fullEscaped;
}

/**
 * "light" escape function for a code line; this leaves the ${} expressions in
 * place to be interpreted at preprocess time, which means that ${} refers to
 * the config object
 */
const _escape = line => {
    return line
        .replace(/\\n/g, '\\\\n')
        .replace(/`/g, '\\`')
        .replace(/(\$){1,2}({\s*})/g, "$2")
}

const _surroundWithTryCatch = expr => {
    let complexExpr = `(function(){try{return ${expr}}catch(_x){return '<UNDEFINED: ${expr}>'}})()`
    return complexExpr
}

/**
 * "full" escape function; all ${} expression etc are interpreted at runtime, which
 * avoids the "backslashing" of $'s etc. I.e. code can be used as is.
 * In order to use expression to be evaulated during preprocessing time, the special notation
 * $${...} can be used, which this routine makes sure is interpreted accordingly.
 * Note, that no nested "{}" pairs are supported in $${} notation; if anything more sophisticated
 * is needed, this has to go into a separate //! line and referenced within $${}
 */
const _fullEscape = line => {
    const re = new RegExp(/\$(\$\{[^\}]*\})/g)
    const lineParts = line.split(re)
        .map(p => p.replace(/(\$){1,2}({\s*})/g, "$2"))
    var res = ""
        // split works in a way that it the elements with even index are
        // the components of the string, while the elements with odd index
        // represent the split-regex expressions in (...)
    for (var i = 0; i < lineParts.length; i++) {
        let linePart = lineParts[i];
        //let pcode = `(function() {try{return ${linePart}}catch(_x){return 'ERROR'}})()`
        if (i % 2 === 0) {
            res += `\${unescape('${escape(linePart)}')}`
        } else {
            let expr = linePart.substr(2, linePart.length - 3)
            let complexExpr = `(function(){try{return ${expr}}catch(_x){return '<UNDEFINED: ${expr}>'}})()`
                //console.log(complexExpr)
                //res += expr
            res += `\${${complexExpr}}`
        }
    }
    //const eline = escape(line)
    //return `\${unescape('${eline}')}`
    return res;
}

const _asJsFile = fname => {
    if (fname.endsWith(".js")) {
        return fname;
    }
    //return fname.replace(/\./g,'_') + ".js";
    return `${fname}.js`
}

const _getMacroCode = fileName => {
    const mfile = path.join(path.dirname(fileName), "_macros.js");
    if (!existsSync(mfile)) {
        return '';
    }
    return readFileSync(mfile, 'utf-8');
}

var _designTimePackageInstallAlreadyRun = false;

const _installDesignTimePackages = (tmpDir, appSpec) => {
    if (_designTimePackageInstallAlreadyRun) return;
    _designTimePackageInstallAlreadyRun = true;
    const packages = appSpec.designTimePackages;
    if (packages && (packages instanceof Array) && packages.length > 0) {
        var cmdLines = [];
        cmdLines.push(`echo installing/checking design-time packages ${packages.map(pkg => ("'" + pkg + "'")).join(",")}...`);
        cmdLines.push(`cd ${tmpDir}`);
        packages.forEach(pkg => {
            //cmdLines.push(`npm view ${pkg} > /dev/null 2>&1`);
            //cmdLines.push('if [ $? -ne 0 ]; then');
            cmdLines.push(`  echo '--> installing design-time package "${pkg}"...'`);
            cmdLines.push(`  npm install --save ${pkg} > /dev/null 2>&1`);
            //cmdLines.push('else');
            //cmdLines.push(`  echo '--> design-time package "${pkg}" already installed'`);
            //cmdLines.push('fi');
            cmdLines.push('');
        });
        cmdLines.push('echo installing/checking design-time packages done.');
        const cmd = cmdLines.join("\n");
        //console.log(cmd);
        runSystemCommand(cmd, { cmdId: 'installDesignTimePackages' })
    }
}

const _getProxy = obj => {
    return new Proxy(obj, {
        get(receiver, name) {
            //console.log(`trying: proxy.${String(name)}...`)
            let resObj = {}
            if (name in receiver) {
                resObj = receiver[name]
            }
            return resObj
        }
    })
}

/**
 * Process a single file and return the resulting output as string.
 * If there is a file called "_macros.js" in the same directory as
 * the file, it is included and its definitions can be used within
 * the special comment lines of the file. The contents of the macro
 * file is included verbatim into the generated function.
 */
const processFile = (fileName, appSpec, options) => {
    options = options ? options : {};
    options.macroCode = _getMacroCode(fileName);
    const moduleCode = generateModuleCode(fileName, options);
    const baseName = path.basename(fileName);
    const subdir = options.subdir ? options.subdir : "appgen-codegen";
    const tmpDir = path.join(tmpdir(), subdir);
    try {
        console.log(`mkdir ${tmpDir}`)
        mkdirSync(tmpDir);
    } catch (err) {}
    const tmpFileName = _asJsFile(path.join(tmpDir, baseName));
    //console.log(inyellow(`moduleCode: ${moduleCode}`))
    writeFileSync(tmpFileName, moduleCode, 'utf-8');
    logger.debug(inblue(`--> temp file for "${fileName}": ${tmpFileName}`));
    var moduleName = tmpFileName.substr(0, tmpFileName.length - 3);
    //console.log(moduleName);
    const appSpecProxy = _getProxy(appSpec)
    _installDesignTimePackages(tmpDir, appSpec);
    const { generateCode } = require(moduleName);
    const missingVariables = []
    const generatedCode = generateCode(appSpec, missingVariables);
    //console.log(ingreen(`generatedCode: ${generatedCode}`))
    if (missingVariables.length > 0) {
        console.log(`the following variables are not defined: ${inred(missingVariables.join(','))}`)
    }
    //if (options.includeMissingVariablesInReturnValue) {
    return { generatedCode, missingVariables }
    //}
    //return generatedCode
}

/*
const codeGenFolder = (folderName, appSpec, options) => {
    const filesInFolder = readdirSync(folderName).filter(fname => fname.match(/^[^_][A-Za-z0-9\.\-_]+$/));
    filesInFolder.forEach(fileName => {
	const fullFileName = path.join(folderName, fileName);
	const code = processFile(fullFileName, appSpec, options);
	const baseName = path.basename(fullFileName);
	const targetFileName = path.join(options.codeDir, "functions", baseName);
	if (!options) options = {};
	options.subdir = "appgen-codegen";
	writeFileSync(targetFileName, processFile(fullFileName, appSpec, options));
	logger.info(`Generated fulfillment code for ${fileName} ==> ${targetFileName}.`);
    });
}

exports.codeGenFolder = codeGenFolder;
*/

exports.preprocessFile = processFile;

if (module === require.main) {
    processFile(process.argv[2], {});
}