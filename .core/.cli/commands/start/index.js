const path = require('path');
const chalk = require('chalk');
const fs = require('fs-extra');
const process = require('process');
const gulpConfig = require('../../../gulp.config');
const { spawn, spawnSync } = require('child_process');

const NAME = 'start';
const DESC = 'Start the Metro & Gulp watchers';

// prettier-ignore
const HELP = () => console.log(`
Example:
  $ arcli start
`);

const runCommand = (
    cmd,
    args = [],
    { stdin = 'ignore', stdout = 'inherit', stderr = 'inherit' } = {},
) => spawn(cmd, args, { stdio: [stdin, stdout, stderr] });

const ACTION = async ({ opt, props }) => {
    const { target } = opt;

    const crossEnvModulePath = path.resolve(
        path.dirname(require.resolve('cross-env')),
        '..',
    );
    const crossEnvPackage = require(path.resolve(
        crossEnvModulePath,
        'package.json',
    ));
    const crossEnvBin = path.resolve(
        crossEnvModulePath,
        crossEnvPackage.bin['cross-env'],
    );

    const commands = {};

    const done = cmd => {
        delete commands[cmd];

        const keys = Object.keys(commands);
        if (keys.length === 0) process.exit();

        const next = commands[keys.shift()];
        if (next) next.kill();
    };

    const onClose = name => code => {
        if (code !== 0 && code !== 1) console.log('Error executing', name);
        done(name);
    };

    // Delete the manifest file
    const manifestfile = gulpConfig.manifestFile;
    fs.removeSync(manifestfile);

    // Run the gulp watch
    commands.watch = runCommand('node', [
        crossEnvBin,
        'NODE_ENV=development',
        'gulp',
    ]).on('close', onClose('watch'));

    let started = false;

    // Wait for the manifest file to be recreated
    // before we try to run react-native
    const ival = setInterval(() => {
        if (fs.existsSync(manifestfile)) {
            clearInterval(ival);
            commands.start = runCommand(
                'node',
                [crossEnvBin, 'react-native', 'start', '--reset-cache'],
                { stdin: 'inherit' },
            ).on('close', onClose('start'));

            if (target) {
                const targetDevice = String(`run-${target}`).toLowerCase();

                setTimeout(() => {
                    runCommand(
                        'node',
                        [crossEnvBin, 'react-native', targetDevice],
                        {
                            stdin: 'inherit',
                        },
                    );
                }, 5000);
            }
        }
    }, 2000);
};

const COMMAND = ({ program, props }) =>
    program
        .command(NAME)
        .description(DESC)
        .action(opt => ACTION({ opt, props }))
        .option('-t, --target [target]', 'Target device')
        .on('--help', HELP);

module.exports = {
    COMMAND,
    NAME,
};