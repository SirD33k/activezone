const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Only try to create logs directory in non-serverless environments
// Vercel has read-only filesystem
const logsDir = path.join(__dirname, '../../logs');
let fileLoggingEnabled = false;

try {
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
    fileLoggingEnabled = true;
} catch (error) {
    // Running in serverless/read-only filesystem - file logging disabled
    console.log('File logging disabled (read-only filesystem)');
}

const transports = [];

// Add file transports only if filesystem is writable
if (fileLoggingEnabled) {
    transports.push(
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error',
            maxsize: 5 * 1024 * 1024,
            maxFiles: 5
        }),
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5 * 1024 * 1024,
            maxFiles: 5
        })
    );
}

// Always add console transport for serverless visibility
transports.push(new winston.transports.Console({
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
    )
}));

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
            let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
            if (Object.keys(meta).length > 0) {
                log += ` ${JSON.stringify(meta)}`;
            }
            if (stack) {
                log += `\n${stack}`;
            }
            return log;
        })
    ),
    transports
});

module.exports = logger;
