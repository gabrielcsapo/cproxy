#!/usr/bin/env node

let program = {};
const cproxy = require('../index');
const args = process.argv.slice(2);

args.forEach((arg, i) => {
  switch (arg) {
    case '-v':
    case '--version':
    case 'version':
      console.log(`v${require('../package.json').version}`); // eslint-disable-line
      process.exit(0);
    break;
    case '-h':
    case '--help':
    case 'help':
      console.log(`` + // eslint-disable-line
        `
  Usage: cproxy [options]

  Commands:
    -h, --help, help             Output usage information
    -v, --version, version       Output the version number

  Options:
    -p, --port [port]            Alters the port that the proxy will listen on
    -m, --mongo [url]         The mongo connect string
`);
      process.exit(0);
    break;
    case '-p':
    case '--port':
      program['port'] = args[i + 1];
    break;
    case '-m':
    case '--mongo':
      program['mongo'] = args[i + 1];
    break;
  }
});

cproxy(program);
