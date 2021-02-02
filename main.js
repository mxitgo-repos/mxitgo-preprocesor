const { preprocess } = require('./config/config.js')

const config = [{
    inputFolder: 'Files/index.js',
    outputFolder: 'CopyFiles/index.js'
}, {
    inputFolder: 'Files/main.js',
    outputFolder: 'CopyFiles/main.js'
}]

var dev = {
    fileDowloadURL: 'http://ec2-34-216-179-253.us-west-2.compute.amazonaws.com:8080/',
    gitHubApiURL: 'http://ec2-34-216-179-253.us-west-2.compute.amazonaws.com:1337/proxy/'
}

var prd = {
    fileDowloadURL: 'http://bauschvh.s3-website-us-east-1.amazonaws.com/',
    gitHubApiURL: 'https://6mweslf4u5.execute-api.us-east-1.amazonaws.com/dev/proxy/'
}

if (process.argv[2] === 'dev') {
    var appSpec = [{
        env: dev,
        app: process.argv[3],
        generatedMessage: 'This code is generated!'
    }, {
        env: dev,
        app: process.argv[3],
        generatedMessage: 'This code is generated!'
    }]
} else {
    var appSpec = [{
        env: prd,
        app: process.argv[3],
        generatedMessage: 'This code is generated!'
    }, {
        env: prd,
        app: process.argv[3],
        generatedMessage: 'This code is generated!'
    }]
}


preprocess(config, appSpec);