const Http = require('http');
const Net = require('net');
const Url = require('url');

const { log, get } = require('./util/request');

const port = process.env.PORT || 5555;

function getHostPortFromString(hostString, defaultPort) {
  var parsed = Url.parse(`https://${hostString}`);

  var host = parsed.hostname;
  var port = parsed.port || defaultPort;

  return ([host, port]);
}

// start HTTP server with custom request handler callback function
var server = Http.createServer(function httpUserRequest(req, res) {
  var httpVersion = req.httpVersion;
  var hostport = getHostPortFromString(req.headers.host, 80);

  // have to extract the path from the requested URL
  var path = Url.parse(req.url).pathname;

  var options = {
    host: hostport[0],
    port: hostport[1],
    method: req.method,
    path: path,
    agent: req.agent,
    auth: req.auth,
    headers: req.headers
  };

  var proxyRequest = Http.request(options, function(proxyRes) {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);

    proxyRes.on('data', function(chunk) {
      res.write(chunk);
    });

    proxyRes.on('end', function() {
      log({ url: req.url, method: req.method, headers: proxyRes.headers, statusCode: proxyRes.statusCode }, (error) => {
        if(error) console.error(error);
        res.end();
      });
    });
  });

  proxyRequest.on('error', function(error) {
    res.writeHead(500);
    res.write(`<html>
      <body>
        <h1>500 Error</h1>\r\n
        <p>Error was <pre>${error}</pre></p>\r\n
      </body>
    </html>`);
    res.end();
  });

  req.addListener('data', function(chunk) {
    proxyRequest.write(chunk);
  });

  req.addListener('end', function() {
    proxyRequest.end();
  });
}).listen(port, (error) => {
  if(error) {
    console.error('error when starting cproxy');
    return process.exit(1);
  }
  console.log(`cproxy started on port ${port}`);
});

// add handler for HTTPS (which issues a CONNECT to the proxy)
server.addListener('connect', function(req, socketRequest, bodyhead) {
  const { url, httpVersion, method } = req;
  const hostport = getHostPortFromString(url, 443);

  log({ url: `https://${hostport[0]}`, method }, (error) => {
    if(error) console.error(error);

    // set up TCP connection
    var proxySocket = new Net.Socket();
    proxySocket.connect(parseInt(hostport[1]), hostport[0], function() {
      proxySocket.write(bodyhead);
      // tell the caller the connection was successfully established
      socketRequest.write("HTTP/" + httpVersion + " 200 Connection established\r\n\r\n");
    });

    proxySocket.on('data', function(chunk) {
      socketRequest.write(chunk);
    });

    proxySocket.on('end', function() {
      socketRequest.end();
    });

    socketRequest.on('data', function(chunk) {
      proxySocket.write(chunk);
    });

    socketRequest.on('end', function() {
      proxySocket.end();
    });

    proxySocket.on('error', function(err) {
      socketRequest.write("HTTP/" + httpVersion + " 500 Connection error\r\n\r\n");
      socketRequest.end();
    });

    socketRequest.on('error', function(err) {
      proxySocket.end();
    });
  });
});
