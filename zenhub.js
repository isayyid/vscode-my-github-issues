const request = require('request-promise-native');

function callServer(host, apiKey, params, endpoint) {
  const uri = "https://" + host + '/p1' + endpoint.path
    .replace(':repo_id', params.repo_id)
    .replace(':issue_number', params.issue_number)
    .replace(':epic_id', params.epic_id)
    .replace(':release_id', params.release_id)
  ;

  return request({
      headers: {
        'x-authentication-token': apiKey
      },
      uri: uri,
      json: true,
      method: endpoint.method,
      body: params.body,
  });
}

function ZenHub(host, apiKey) {
  this.apiKey = apiKey;
  this.host = host;
};

ZenHub.prototype = {
  getBoard: function(params) {
    return callServer(this.host, this.apiKey, params, {
        method: 'GET',
        path: '/repositories/:repo_id/board',
      });
  },
  getEpicData: function(params) {
    return callServer(this.host, this.apiKey, params, {
        method: 'GET',
        path: '/repositories/:repo_id/epics/:epic_id',
      });
  }
}

module.exports = ZenHub;
