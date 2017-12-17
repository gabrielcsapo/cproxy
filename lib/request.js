const Url = require('url');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

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

module.exports.log = async function log({ url, headers, method, statusCode, data }) {
  let endpoint = Url.parse(url);

  const { hostname, path } = endpoint;

  return await Request.create({
    hostname,
    path,
    headers,
    method,
    statusCode,
    data,
  });
};

module.exports.get = async function get() {
  return await Request.find({}).limit(30).sort({ created_at: -1 });
};
