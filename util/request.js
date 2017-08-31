const Url = require('url');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// TODO: make this configurable
mongoose.connect('mongodb://localhost/cproxy', { useMongoClient: true });

const RequestSchema = new Schema({
  hostname: String,
  path: String,
  headers: Object,
  method: String,
  statusCode: Number,
  data: String
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

const Request = mongoose.model('Request', RequestSchema);

module.exports.log = function log({ url, headers, method, statusCode, data }, callback) {
  let endpoint = Url.parse(url);

  const { hostname, path } = endpoint;

  Request.create({
    hostname,
    path,
    headers,
    method,
    statusCode,
    data,
  }, (error) => {
    if(error) return callback(error);
    return callback();
  })
}
