const path = require('path');
const clearModule = require('clear-module');
const isBinaryFile = require('isbinaryfile');
const logger = require('./logging');

const { existsSync, lstatSync, mkdirSync, writeFileSync, statSync, chmodSync } = require('fs');
const { isAbsolute, resolve, sep } = require('path');
const { inyellow, incyan, ingreen } = require('./colorize');
const { preprocessFile } = require('./codegen');


exports.preprocess = async(config, appSpec, options) => {

    if (!config) {
        throw "config argument is missing from preprocess()"
    }

    if (!appSpec) {
        throw "appSpec argument is missing from preprocess()"
    }

    var aAppSpec = [];
    var inputFolder = config;
    var ainputFolder = [];
    var codeDir = [];

    for (var i = 0; i < config.length; i++) {
        aAppSpec.push(appSpec[i])
        aAppSpec[i].config = config[i];
    }

    let typeInputFolder = config.filter(function(data) {
        return typeof data.inputFolder !== 'string';
    })

    if (typeInputFolder.length !== 0) {
        throw "please specify an inputFolder in the config"
    }

    clearModule.all();

    for (var i = 0; i < inputFolder.length; i++) {
        ainputFolder.push(inputFolder[i].inputFolder.startsWith('/') ? inputFolder[i].inputFolder : `./${inputFolder[i].inputFolder}`)
    }

    for (var i = 0; i < appSpec.length; i++) {
        codeDir.push(await getCodeDir(appSpec[i]));
    }

    for (var i = 0; i < codeDir.length; i++) {
        codeGenFolder(ainputFolder[i], [], appSpec[i], {
            codeDir: codeDir[i],
            isDryRun: config[i].isDryRun
        });
    }

}

const codeGenFolder = (folderName, subFolders, appSpec, options) => {
    const fullFolderName = path.join.apply(undefined, [folderName].concat(subFolders));
    const filesInFolder = fullFolderName.split('\\')[1]
    if (!options) options = {};
    options.subdir = "appgen-codegen" + (subFolders.length > 0 ? "-" : "") + subFolders.join('-');
    var isDryRun = !!options.isDryRun;

    if (lstatSync(fullFolderName).isDirectory()) {
        logger.info(ingreen(`...found directory in code-templates: ${fullFolderName}`));
        const newSubFolders = subFolders.concat([filesInFolder]);
        codeGenFolder(folderName, newSubFolders, appSpec, options);
    } else {
        let isBinary = isBinaryFile.isBinaryFileSync(fullFolderName)
        const baseName = path.basename(fullFolderName);
        var pathArgsForFolder = [options.codeDir.split('/')[0]];
        var code = ''

        if (!isBinary) {

            logger.info(inyellow(`...preprocessing file "${fullFolderName}"`));

            let { generatedCode, missingVariables } = preprocessFile(fullFolderName, appSpec, options);

            if (appSpec.config.missingVariables) {
                appSpec.config.missingVariables.splice(0, 0, ...missingVariables)
            }
            code = generatedCode
        }

        pathArgsForFolder = pathArgsForFolder.concat(subFolders);
        const targetFolder = path.join(...pathArgsForFolder);

        try {
            if (!existsSync(targetFolder) || !lstatSync(targetFolder).isDirectory()) {
                logger.info(ingreen(`mkdir -p ${targetFolder}`));
            }
            if (!options.isDryRun) {
                mkdirRecursiveSync(targetFolder);
            }
        } catch (_err) {
            const errMsg = String(_err);
            if (errMsg.indexOf('EEXIST') < 0) {
                logger.error(_err);
            }
        }

        const pathArgs = pathArgsForFolder.concat([baseName]);
        const targetFileName = options.codeDir; //'CopyFiles\\index.js'

        const _copyFileMode = (srcFile, trgFile) => {
            try {
                let stats = statSync(srcFile)
                chmodSync(trgFile, stats.mode)
                let modeStr = '0' + (stats.mode & parseInt('777', 8)).toString(8);
                console.log(`==> mode of "${inyellow(path.basename(trgFile))}" set to "${incyan(modeStr)}"`)
            } catch (err) {
                console.error(`could not set file mode for "${trgFile}" (ignored)`)
            }
        }

        if (!isDryRun) {
            if (isBinary) {
                copyFileSync(fullFolderName, targetFileName)
                console.log(incyan(`...copying binary file: ${fullFolderName} ==> ${targetFileName}`))
            } else {
                writeFileSync(targetFileName, code); //'CopyFiles\\index.js'
                _copyFileMode(fullFolderName, targetFileName) //'Files\\data\\br\\index.js' , 'CopyFiles\\index.js'
            }
        }
        logger.info(`Generated code for ${filesInFolder} ==> ${targetFileName}.`);
    }
}

const mkdirRecursiveSync = function(targetDir, { isRelativeToScript = false } = {}) {

    const initDir = isAbsolute(targetDir) ? sep : '';
    const baseDir = isRelativeToScript ? __dirname : '.';

    return targetDir.split(sep).reduce((parentDir, childDir) => {
        const curDir = resolve(baseDir, parentDir, childDir);
        try {
            mkdirSync(curDir);
        } catch (err) {
            if (err.code === 'EEXIST') {
                return curDir;
            }

            if (err.code === 'ENOENT') {
                throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`);
            }

            const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;

            if (!caughtErr || caughtErr && targetDir === curDir) {
                throw err;
            }
        }
        return curDir;
    }, initDir);
}

const getCodeDir = async(appSpec) => {
    const id = appSpec.id;
    const fff = await _getOutputFolder(appSpec);
    return id ? path.join(fff, id) : fff;
}

const _getOutputFolder = appSpec => {

    if (typeof appSpec.outputFolder === 'string') {
        return appSpec.outputFolder
    }

    if (typeof appSpec.config.outputFolder === 'string') {
        return appSpec.config.outputFolder
    }
    throw "outputFolder is missing in config"
};