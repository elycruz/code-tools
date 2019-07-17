const

  chalk = require('chalk'),

  {exec} = require('child_process'),

  {log} = require('./console'),

  execAsIo = (command, options) => new Promise((resolve, reject) => {
    exec(command, options, (msg, stdout, stderr) => {
      if (msg) {
        reject(`exec-error: ${chalk.red(msg)}`);
      }
      if (stderr) {
        log(chalk.yellow(`${stderr}`));
      }
      resolve(stdout);
    });
  });

module.exports = {
  execAsIo
};
