'use stricts'

const {
    inred,
    ingreen,
    inblue,
    incyan,
    inyellow,
    inwhite,
    inmagenta
} = require('./colorize');

const winston = require('winston');
const logger = winston.createLogger({
    transports: [
        new winston.transports.Console({
            level: 'debug'
        }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

const logLevels = ['debug', 'info', 'warn', 'error'];

logLevels.forEach(level => {
    exports[level] = function(msg) {
        if (level === 'error') {
            msg = inred(msg);
        }
        console.log(msg);
    };
})