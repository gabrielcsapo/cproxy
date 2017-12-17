const Http = require('http');
const Net = require('net');
const Url = require('url');
const mongoose = require('mongoose');

mongoose.Promise = Promise;

const { log, get } = require('./lib/request');
const { getHostPortFromString } = require('./lib/util');

async function handleDashboard(req, res) {
  const { url } = req;
  const history = await get();

  switch(url) {
    case '/':
    default:
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name=viewport content="width=device-width, initial-scale=1">
            <title>⚡️ cproxy</title>
            <style>
            html, body {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;

              font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
            }

            .main {
              color: #3e3e3e;
              text-align: center;
              width: 100%;
              position: relative;
              display: flex;
              min-height: 100vh;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
            }

            .navbar {
              clear:both;
              display: inline-block;
              width: 100%;
            }
            .navbar .content {
              width: 90%;
              margin: 0 auto;
            }
            .navbar-brand {
              display: inline-block;
            }
            .navbar-brand > * {
              color: #3e3e3e;
              text-decoration: none;
            }
            .navbar-content {
              margin: 1.5em;
              float: right;
            }

            table {
              border: 1px solid #ccc;
              border-collapse: collapse;
              margin: 0;
              padding: 0;
              width: 95%;
              table-layout: fixed;
            }
            table caption {
              font-size: 1.5em;
              margin: .5em 0 .75em;
            }
            table tr {
              background: #f8f8f8;
              border: 1px solid #ddd;
              padding: .35em;
            }
            table td {
              min-height:15px;
            }
            table th,
            table td {
              padding: .625em;
              text-align: center;
            }
            table th {
              font-size: .85em;
              letter-spacing: .1em;
              text-transform: uppercase;
            }
            @media screen and (max-width: 600px) {
              table {
                border: 0;
              }
              table caption {
                font-size: 1.3em;
              }
              table thead {
                border: none;
                clip: rect(0 0 0 0);
                height: 1px;
                margin: -1px;
                overflow: hidden;
                padding: 0;
                position: absolute;
                width: 1px;
              }
              table tr {
                border-bottom: 3px solid #ddd;
                display: block;
                margin-bottom: .625em;
              }
              table td {
                border-bottom: 1px solid #ddd;
                display: block;
                font-size: .8em;
                text-align: right;
              }
              table td:before {
                /*
                * aria-label has no advantage, it won't be read inside a table
                content: attr(aria-label);
                */
                content: attr(data-label);
                float: left;
                font-weight: bold;
                text-transform: uppercase;
              }
              table td:last-child {
                border-bottom: 0;
              }
            }

            #container {
              display: flex;
              min-height: 100vh;
              flex-direction: column;
              margin: 0 auto;
            }
            </style>
          </head>
          <body>
            <div class="navbar">
              <div class="content">
                <h3 class="navbar-brand">
                  <a href="./index.html">
                    ⚡️ cproxy
                  </a>
                </h3>

                <div class="navbar-content">
                  <a class="button" href="https://github.com/gabrielcsapo/cproxy" target="_blank">Source</a>
                </div>
              </div>
            </div>
            <div id="container">
              <div class="main">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Method</th>
                      <th scope="col">Code</th>
                      <th scope="col">Host</th>
                      <th scope="col">Path</th>
                      <th scope="col">Mime</th>
                      <th scope="col">Visited</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${history.map((h) => {
                      return `<tr>
                        <td data-label="id"> ${h._id} </td>
                        <td data-label="Method"> ${h.method} </td>
                        <td data-label="Code"> ${h.statusCode || '' } </td>
                        <td data-label="Host"> ${h.hostname} </td>
                        <td data-label="Path" style="overflow: hidden;display: inline-block;max-width: 100px;"> ${h.path} </td>
                        <td data-label="Mime"> ${h.headers ? h.headers['content-type'] : '' } </td>
                        <td data-label="Mime"> ${h.created_at } </td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </body>
        </html>
      `);
    break;
  }
}

module.exports = async function cproxy(options) {
  const { port=5555, mongo='mongodb://localhost/cproxy' } = options;

  await mongoose.connect(mongo, { useMongoClient: true });

  // start HTTP server with custom request handler callback function
  const server = Http.createServer(function httpUserRequest(req, res) {
    // handle the dashboard traffic
    if(req.headers.host == `localhost:${port}`) {
      return handleDashboard(req, res);
    }

    const hostport = getHostPortFromString(req.headers.host, 80);

    // have to extract the path from the requested URL
    const path = Url.parse(req.url).pathname;

    const options = {
      host: hostport[0],
      port: hostport[1],
      method: req.method,
      path: path,
      agent: req.agent,
      auth: req.auth,
      headers: req.headers
    };

    const proxyRequest = Http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);

      proxyRes.on('data', (chunk) => res.write(chunk));
      proxyRes.on('end', async () => {
        await log({ url: req.url, method: req.method, headers: proxyRes.headers, statusCode: proxyRes.statusCode });

        res.end();
      });
    });

    proxyRequest.on('error', (error) => {
      res.writeHead(500);
      res.write(`<html>
        <body>
          <h1>500 Error</h1>\r\n
          <p>Error was <pre>${error}</pre></p>\r\n
        </body>
      </html>`);
      res.end();
    });

    req.addListener('data', (chunk) => proxyRequest.write(chunk));
    req.addListener('end', () => proxyRequest.end());

  });

  server.listen(port, (error) => {
    if(error) {
      console.error('error when starting cproxy'); // eslint-disable-line
      return process.exit(1);
    }
    console.log(`cproxy started on port ${port}`); // eslint-disable-line
  });

  // add handler for HTTPS (which issues a CONNECT to the proxy)
  server.addListener('connect', (async (req, socketRequest, bodyhead) => {
    const { url, httpVersion, method } = req;
    const hostport = getHostPortFromString(url, 443);

    await log({ url: `https://${hostport[0]}`, method });

    // set up TCP connection
    const proxySocket = new Net.Socket();
    proxySocket.connect(parseInt(hostport[1]), hostport[0], () => {
      proxySocket.write(bodyhead);
      // tell the caller the connection was successfully established
      socketRequest.write('HTTP/' + httpVersion + ' 200 Connection established\r\n\r\n');
    });

    proxySocket.on('data', (chunk) => socketRequest.write(chunk));
    proxySocket.on('end', () => socketRequest.end());
    proxySocket.on('error', () => {
      socketRequest.write('HTTP/' + httpVersion + ' 500 Connection error\r\n\r\n');
      socketRequest.end();
    });
    socketRequest.on('data', (chunk) => proxySocket.write(chunk));
    socketRequest.on('end', () => proxySocket.end());
    socketRequest.on('error', () => proxySocket.end());
  }));
};
