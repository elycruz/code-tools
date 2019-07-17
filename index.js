#!/usr/bin/env node

/**
 * Our tools entry point (note our program runs via `yargs`'s interface so
 * A little understanding of yargs may be required to understand what were doing here docs link below).
 * @script index.js
 * @see yargs docs: http://yargs.js.org/ | http://yargs.js.org/docs/
 */

const

  chalk = require('chalk'),

  {error} = require('./utils/console'),

  validateCmdName = name => name && /^[a-z][a-z\-_\d]{1,55}$/.test(name),

  BUMP_COMMAND = 'bump',
  RELEASE_COMMAND = 'release',
  RC_COMMAND = 'rc',

  HELP_COMMAND = '--help',
  H_COMMAND = '-h',
  VERSION_COMMAND = '--version',
  V_COMMAND = '-v',

  optionsAsCommands = [
    HELP_COMMAND,
    H_COMMAND,
    VERSION_COMMAND,
    V_COMMAND
  ],

  allowedCommands = [
    BUMP_COMMAND,
    RELEASE_COMMAND,
    RC_COMMAND,
  ]
    .concat(optionsAsCommands),

  // @see yargs docs: http://yargs.js.org/ | http://yargs.js.org/docs/
  run = cmd => {

    // Resolve command(s) to run
    const commandAllowed = allowedCommands.includes(cmd),
      isNonCommandAction = optionsAsCommands.some(x => cmd === x);

    // If command and not one of '--help' '--version' etc.
    if (!validateCmdName(cmd) && !isNonCommandAction) {
      error(`${chalk.magenta(cmd)} is malformed.  Try one of:\n` +
        `"${allowedCommands.join('", "')}"\n`);
    }

    // If command not listed as allowed
    if (!commandAllowed) {
      error(`Command ${chalk.magenta(cmd)} not found.  ` +
        `Use one of:\n` +
        `"${allowedCommands.join('" , "')}"\n`);
    }

    // Run command(s)
    return require('yargs')
    // .usage('$0 <cmd> [...options]') //
      .alias('h', 'help')             // --help is available but not '-h' hence why setting it.
      .alias('v', 'version')          // --version is available but not '-v' "".
      .commandDir('./cmds')
      .help()                         // "help" side-effect - Sets up '--help' command.
      .fail(error)                    // Catch command errors and forward them to terminal
      .argv                           // Return parsed `argv` (in case we want to chain other actions with this one)
      ;
  };

run(process.argv[2]); // process.argv: [node binary, executable's filepath, command, et. al.].

process.on('uncaughtException', error);
