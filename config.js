var config = {
  // Twitter API (Proxy) URL
  baseUrl: 'http://localhost:7890',

  debug: false,
  title: 'Paris Web fait le buzz sur Twitter !',

  search: 'from:@parisweb OR @parisweb OR from:@coulissespw OR @coulissespw OR #parisweb OR #parisweb2014 OR #parisweb14',
  // list: 'fullfrontalconf/delegates11', // optional, just comment it out if you don't want it

  timings: {
    showNextScheduleEarlyBy: '10m', // show the next schedule 10 minutes after the previous starts
    defaultNoticeHoldTime: '10s',
    defaultNoticeInterval: '5m',
    initialNoticeDelay: '15m',
    showTweetsEvery: '3s'
  }
};

// allows reuse in the node script
if (typeof exports !== 'undefined') {
  module.exports = config;
}
