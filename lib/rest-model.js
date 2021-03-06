// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-connector-rest
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var debug = require('debug')('loopback:connector:rest');
var request = require('request');
var g = require('strong-globalize')();

/**
 * @class RestConnector
*/
module.exports = RestResource;

/**
 * @constructor
 * Build a REST resource client for CRUD operations
 * @param {string} pluralModelName The model name
 * @param {string} baseUrl The base URL
 * @param {function} [requestFunc] Custom request with defaults
 * @returns {RestResource}
 */
function RestResource(pluralModelName, baseUrl, requestFunc) {
  if (!this instanceof RestResource) {
    return new RestResource(pluralModelName, baseUrl, requestFunc);
  }
  if (baseUrl.charAt(baseUrl.length - 1) === '/') {
    this._url = baseUrl + pluralModelName;
  } else {
    this._url = baseUrl + '/' + pluralModelName;
  }
  this.request = requestFunc || request;
}

RestResource.prototype._req = function(obj) {
  if (debug.enabled) {
    debug('Request: %j', obj);
  }
  return obj;
};

/**
 * @private
 * Wrap the callback so that it takes (err, result, response)
 * @param {function} cb The callback function
 * @returns {*}
 */
function wrap(cb) {
  var callback = cb;
  if (cb) {
    callback = function(err, response, body) {
      // FIXME: [rfeng] We need to have a better error mapping
      if (!err && response && response.statusCode >= 400) {
        var errObj = new Error();
        errObj.message = 'HTTP code: ' + response.statusCode;
        errObj.statusCode = response.statusCode;
        if (body) {
          errObj.body = body;
        }
        if (response.headers) {
          errObj.headers = response.headers;
        }
        return cb(errObj, null, response);
      } else {
        return cb(err, body, response);
      }
    };
  }
  return callback;
}

/**
 * Map the create operation to HTTP POST /{model}
 * @param {object} body The HTTP body
 * @param {object} options Loopback contexts options object
 * @param {function} [cb] The callback function
 */
RestResource.prototype.create = function(body, options, cb) {
  this._request(
    this._req({
      method: 'POST',
      uri: this._url,
      json: true,
      body: body,
      headers: {
        options: options && JSON.stringify(options),
      },
    }),
    wrap(cb)
  );
};

/**
 * Map the update operation to POST /{model}/{id}
 * @param {*} id The id value
 * @param {object} body The HTTP body
 * @param {object} options Loopback contexts options object
 * @param {function} [cb] The callback function
 */
RestResource.prototype.update = function(id, body, options, cb) {
  this._request(
    this._req({
      method: 'PUT',
      uri: this._url + '/' + id,
      json: true,
      body: body,
      headers: {
        options: options && JSON.stringify(options),
      },
    }),
    wrap(cb)
  );
};

/**
 * Map the delete operation to POST /{model}/{id}
 * @param {*} id The id value
 * @param {object} options Loopback contexts options object
 * @param {function} [cb] The callback function
 */
RestResource.prototype.delete = function(id, options, cb) {
  this._request(
    this._req({
      method: 'DELETE',
      uri: this._url + '/' + id,
      json: true,
      headers: {
        options: options && JSON.stringify(options),
      },
    }),
    wrap(cb)
  );
};

/**
 * Map the delete operation to POST /{model}
 * @param {*} id The id value
 * @param {object} options Loopback contexts options object
 * @param {function} [cb] The callback function
 */
RestResource.prototype.deleteAll = function(options, cb) {
  this._request(
    this._req({
      method: 'DELETE',
      uri: this._url,
      json: true,
      headers: {
        options: options && JSON.stringify(options),
      },
    }),
    wrap(cb)
  );
};

/**
 * Map the find operation to GET /{model}/{id}
 * @param {*} id The id value
 * @param {object} options Loopback contexts options object
 * @param {function} [cb] The callback function
 */
RestResource.prototype.find = function(id, filter, options, cb) {
  this._request(
    this._req({
      method: 'GET',
      uri: this._url + (id ? '/' + id : ''),
      json: true,
      qs: {filter: filter},
      headers: {
        options: options && JSON.stringify(options),
      },
    }),
    wrap(cb)
  );
};

/**
 * Map the all/query operation to GET /{model}
 * @param {object} q query string
 * @param {object} options Loopback contexts options object
 * @param {function} [cb] callback with (err, results)
 */
RestResource.prototype.all = RestResource.prototype.query = function(q, options, cb) {
  q = q || {};
  if (!cb && typeof options === 'function') {
    cb = options;
    q = {};
  }
  this._request(
    this._req({
      method: 'GET',
      uri: this._url,
      json: true,
      qs: {filter: q},
      headers: {
        options: options && JSON.stringify(options),
      },
    }),
    wrap(cb)
  );
};

var RequestBuilder = require('./rest-builder');
var requestFunc = this.request;

RestResource.prototype._request = RequestBuilder.prototype._request;

function defineFunctions() {
  var spec = require('./rest-crud.json');

  var functions = {};
  spec.operations.forEach(function(op) {
    if (!op.template) {
      throw new Error(g.f('The operation template is missing: %j', op));
    }
    var builder = RequestBuilder.compile(op.template, requestFunc);
    builder.debug(spec.debug);

    // Bind all the functions to the template
    var functions = op.functions;
    if (functions) {
      for (var f in functions) {
        if (spec.debug) {
          g.log('Mixing in method: %s %s', f, functions[f]);
        }
        var fn = builder.operation(functions[f]);
        functions[f] = fn;
      }
    }
  });
  return functions;
}

