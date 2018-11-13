// General utilities
const log = require('fancy-log');

const colorSupport = require('color-support');
const color = require('cli-color');

const colors = {};
if (colorSupport.level > 0) {
    colors.success = color.greenBright;
    colors.info = color.white;
    colors.debug = color.blackBright;
    colors.warn = color.yellow;
    colors.error = color.red;
} else {
    let dummy = msg => msg;
    colors.success = dummy;
    colors.info = dummy;
    colors.debug = dummy;
    colors.warn = dummy;
    colors.error = dummy;
}

module.exports = {
    log,
    colors,
};