const Url = require('url');

module.exports.getHostPortFromString = function getHostPortFromString(hostString, defaultPort) {
  const parsed = Url.parse(`https://${hostString}`);

  const host = parsed.hostname;
  const port = parsed.port || defaultPort;

  return ([host, port]);
};
