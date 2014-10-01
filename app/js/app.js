if (-1 === window.location.search.indexOf('nodebug')) {
  window.debugTime = parseTime(window.location.hash.slice(1) || '0915');
}

/************************************************
 SCHEDULES MANAGEMENT
 ************************************************/

function Schedule(container) {
  this.$container = $(container);
  this.$schedule = this.$container.children('div');
  this.lastDue = null;
  this.schedule = schedule = {};
  this.$schedule.each(function() {
    schedule[this.getAttribute('data-time')] = $(this);
  });
  this.times = Object.keys(this.schedule).sort();
  if (!this.times.length) {
    return;
  }

  // click on the schedule to move forward (for testing)
  this.$container.click(this.showNext.bind(this));

  this.$schedule.hide();
  this.checkNext();
}

$.extend(Schedule.prototype, {
  checkNext: function checkNext() {
    this.showSchedule(this.findNextSchedule(config.timings.showNextScheduleEarlyBy || 0));
  },

  findNextSchedule: function findNextSchedule(delayM, after) {
    var t = after ? parseTime(after) : window.debugTime || (new Date()).getTime();
    var s, parsed;

    for (var i = this.times.length - 1; i >= 0; i--) {
      s = this.times[i];
      if (parseTime(s) - delayM <= t) {
        break;
      }
    }
    return s;
  },

  showNext: function showNext() {
    this.showSchedule(this.findNextSchedule(0, this.lastDue));
  },

  showSchedule: function showSchedule(due) {
    if (due === this.lastDue) {
      return;
    }

    this.lastDue = due;
    if (this.active) {
      this.active.animate({ opacity: 0 });
    }
    (this.active = this.schedule[due]).css({ opacity: 0 }).show().animate({ opacity: 1 });
    this.$container.attr('data-time', due);
  }
});

var schedules = [], scheduleTimer;

function checkSchedules() {
  schedules.forEach(function(s) { s.checkNext(); });
}

function initSchedules() {
  if (scheduleTimer) {
    clearInterval(scheduleTimer);
  }
  schedules = [];
  $('.schedule').each(function(i, container) {
    schedules.push(new Schedule(container));
  });

  scheduleTimer = setInterval(checkSchedules, 5000);
}

function nextDue() {
  clearInterval(scheduleTimer);
  schedules.forEach(function(s) { s.showNext(); });
}

/************************************************
 "NOTICES" (SPONSOR PANELS, ANNOUNCEMENTS…)
 ************************************************/

function initNotices() {
  var $notices = $('#notices > div');
  var current = 0, length = $notices.length;

  if (!$notices.length) {
    return;
  }

  var interval = config.timings.defaultNoticeInterval || 60000;
  var initialDelay = config.timings.initialNoticeDelay || interval;
  var hold = config.timings.defaultNoticeHoldTime || 10000;

  var weAreOffline = false === navigator.onLine;
  $(window).on('online offline', function() {
    weAreOffline = false === navigator.onLine;
  });

  setTimeout(show, weAreOffline ? 0 : initialDelay);

  function show() {
    var $previous = $notices.filter('.show');
    $previous.removeClass('show');

    if ($previous.length) {
      current++;
      if (!weAreOffline) {
        setTimeout(show, interval);
        return;
      }
    }

    var $current = $notices.eq(current % length).addClass('show');
    var customTiming = $current.attr('data-hold-time');

    if (customTiming) {
      customTiming = parseTiming(customTiming);
    }

    setTimeout(show, customTiming || hold);
  }
}

/************************************************
 MICRO-TEMPLATING
 ************************************************/

// Simple JavaScript Templating
// John Resig - http://ejohn.org/ - MIT Licensed
(function(){
  var cache = {};

  this.tmpl = function tmpl(str, data){
    // Figure out if we're getting a template, or if we need to
    // load the template - and be sure to cache the result.
    var fn = !/\W/.test(str) ?
      cache[str] = cache[str] ||
        tmpl(document.getElementById(str).innerHTML) :

      // Generate a reusable function that will serve as a template
      // generator (and which will be cached).
      new Function("obj",
        "var p=[],print=function(){p.push.apply(p,arguments);};" +

        // Introduce the data as local variables using with(){}
        "with(obj){p.push('" +

        // Convert the template into pure JavaScript
        str
          .replace(/[\r\t\n]/g, " ")
          .split("<%").join("\t")
          .replace(/((^|%>)[^\t]*)'/g, "$1\r")
          .replace(/\t=(.*?)%>/g, "',$1,'")
          .split("\t").join("');")
          .split("%>").join("p.push('")
          .split("\r").join("\\'")
      + "');}return p.join('');");

    // Provide some basic currying to the user
    return data ? fn( data ) : fn;
  };
})();

/************************************************
 TWITTER INTERFACE
 ************************************************/

twitterlib.cache(true);

// Tweet Queue
function Queue(delay, callback) {
  var q = [],
      timer = null,
      processed = {},
      empty = null,
      ignoreRT = twitterlib.filter.format('-"RT @"'); // if you want to reuse this queue, ditch this reference

  function process() {
    var item = null;
    if (q.length) {
      callback(q.shift());
    } else {
      this.stop(); // don't like this, should change to prototype eventually
      setTimeout(empty, 5000);
    }
    return this;
  }

  return {
    push: function (item) {
      var i;
      if (!(item instanceof Array)) {
        item = [item];
      }

      if (timer == null && q.length === 0) {
        this.start();
      }

      for (i = 0; i < item.length; i++) {
        if (!processed[item[i].id_str] && twitterlib.filter.match(item[i], ignoreRT)) {
          processed[item[i].id_str] = true;
          q.push(item[i]);
        }
      }

      // resort the q
      q = q.sort(function (a, b) {
        return a.id_str > b.id_str ? 1 : -1;
      });

      return this;
    },
    start: function () {
      if (timer == null) {
        timer = setInterval(process, delay);
      }
      return this;
    },
    stop: function () {
      clearInterval(timer);
      timer = null;
      return this;
    },
    toggle: function () {
      return this[timer == null ? 'start' : 'stop']();
    },
    empty: function (fn) {
      empty = fn;
      return this;
    },
    q: q,
    next: process
  };
} //.start();

var photoServiceURLs = new RegExp('(flickr|instagr.am)'),
    photoURLs = new RegExp('(.jpg|.jpeg|.png|.gif)$'),
    tweetTemplate = tmpl('tweet_template');



// blocker
//
// Test text against a set of criteria. Add text, regexs or a function
// to match against, and then use blocker.test('some text') to find a
// match. blocker.test will return true if the text is ok, and false
// if it finds a match (ie, text is not ok).
//
// If you add a callback function it should return true if the text is ok.
//
// For example:
//
//    // Block anything containing @twitter
//    blocker.block('@twitter');
//
//    // Block anything that's entirely lowercase & spaces
//    blocker.block(/^[a-z\s]*$/);
//
//    // Block the text if it's 'I hate the twitterwall!'
//    blocker.block(function (test) {
//      return (test !== 'I hate the twitterwall!');
//    });
//
//    . . .
//
//    // Test your text
//    var textIsOk = blocker.test('Some Text');
//
var blocker = (function () {
  var callbacks = [];

  return {
    block: function (checker) {
      // Callback should return true if the text is clean,
      // false if it should be blocked.

      var cb = function (text) { return true; };

      if (typeof checker === "string") {
        cb = function (text) {
          return (text.toLowerCase().indexOf(checker) === -1);
        };
      }

      else if (({}).toString.call(checker) === '[object RegExp]') {
        cb = function (text) {
          return (text.match(checker) === null);
        };
      }

      else if (typeof checker === "function") {
        cb = checker;
      }

      return callbacks.push(cb) && cb;
    },
    test: function (text) {
      return callbacks.every(function (cb) {
        return cb(text);
      });
    }
  };
}());

function getInstagram(id, url) {
  window['embed' + id] = function (data) {
    if (data.type == 'photo') {
      var el = document.getElementById('pic' + id);
      if (el) {
        el.src = data.url;
      }
    }
  };
  var script = document.createElement('script');
  script.src = 'http://api.instagram.com/oembed?url=' + url + '&callback=embed' + id;
  document.body.appendChild(script);
}

function getFlickr(id, url) {
  var apikey = '18702ea1538bc199e2c7e1d57270cd37',
  photoId = url.split('/').pop();

  if (url.indexOf('flic.kr') !== -1) { // short url - decode first
    var num = url.split('/').pop(),
        decoded = 0,
        multi = 1,
        digit = null,
        alphabet = '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'.split('');
    while (num.length > 0) {
      digit = num.substring(num.length-1);
      decoded += multi * alphabet.indexOf(digit);
      multi = multi * alphabet.length;
      num = num.substring(0, num.length -1);
    }
    photoId = decoded;
  }
  var flickrURL = 'http://api.flickr.com/services/rest/?method=flickr.photos.getInfo&api_key=18702ea1538bc199e2c7e1d57270cd37&photo_id=' + photoId + '&format=json&jsoncallback=embed' + id;

  window['embed' + id] = function (data) {
    if (data.photo) {
      var photo = data.photo,
          el = $('.embed' + id);
        if (el) {
          $(el).replaceWith('<img class="pic" src="http://farm' + photo.farm + '.static.flickr.com/' + photo.server + '/' + photo.id + '_' + photo.secret + '.jpg">');
      }
    }
  };
  var script = document.createElement('script');
  script.src = flickrURL;
  document.body.appendChild(script);

}

var twitterQueue;

function initTwitter() {
  // Use the baseUrl from the config to setup twitterlib. This allows it to
  // run from a proxy, not Twitter's API (which doesn't support from-browser
  // requests).
  twitterlib.baseUrl = config.baseUrl;

  if (config.debug) {
    twitterlib.debug({
      'list': '../history/data/list%page%.json?callback=callback',
      'search': '../history/data/search%page%.json?callback=callback'
    });
  }

  // Element cache
  var $tweets = $('#tweets');

  // start a new queue and on the callback, render the tweet and animate it down
  twitterQueue = new Queue(config.timings.showTweetsEvery || 3000, function (item) {
    // 1. stuff a new p tag, and animate it up - to force content down (with text:visibility:hidden)
    // 2. drop effect from top of page
    // 3. once effect complete, remove animated el, and show text to fake effect

    var tweetText = twitterlib.expandLinks(item),
        tweetIsOk = blocker.test(tweetText);

    if (!tweetIsOk) {
      return twitterQueue.next();
    }

    var tweet = $(renderTweet(item)),
        tweetClone = tweet.clone().hide().css({ visibility: 'hidden' }).prependTo($tweets).slideDown(1000);

    tweet.css({ top: -200, position: 'absolute' }).prependTo($tweets).animate({
      top: 0
    }, 1000, function () {
      tweetClone.css({ visibility: 'visible' });
      $(this).remove();
    });

    // remove elements that aren't visible
    $tweets.find('p:below(' + window.innerHeight + ')').remove();
  }).empty(runTweets);

  // space pauses twitter feed
  $(window).keydown(function (event) {
    if (event.which === 32) {
      twitterQueue.toggle();
    }
  });

  runTweets();
}

function loadImage(id, url) {
  return;
  //  http://www.oohembed.com/oohembed
  window['embed' + id] = function (data) {
    if (data.type == 'photo') {
      var el = document.getElementById('pic' + id);
      if (el) {
        el.src = data.url;
      }
    }
  };
  var script = document.createElement('script');
  script.src = 'http://www.oohembed.com/oohembed?url=' + url + '&callback=embed' + id;
  document.body.appendChild(script);
}

function renderTweet(data) {
  var embeds = [];

  if (data.entities && data.entities.urls && data.entities.urls.length) {
    data.entities.urls.forEach(function (urldata) {
      var url = urldata.expanded_url;
      if (url.indexOf('yfrog.com') !== -1) {
        embeds.push('<img class="pic" src="' + url + ':iphone" />');
      } else if (url.indexOf('twitpic.com') !== -1) {
        embeds.push('<img class="pic" src="' + url.replace(/twitpic\.com/, 'twitpic.com/show/large') + '" />');
      } else if (url.indexOf('instagr.am') !== -1) {
        if (url.split('').pop() !== '/') {
          url += '/';
        }
        embeds.push('<img class="pic" id="pic' + data.id_str + '" src="' + url + 'media">');
        //getInstagram(data.id_str, url);
      } else if (url.indexOf('lockerz') !== -1) {
        embeds.push('<img class="pic" src="http://api.plixi.com/api/tpapi.svc/imagefromurl?url=' + url + '" />');
      } else if (url.indexOf('flic.kr') !== -1 || url.indexOf('flickr') !== -1) {
        getFlickr(data.id_str, url);
        embeds.push('<span class="embed' + data.id_str + '"></span>');
      } else if (photoURLs.test(url)) {
        embeds.push('<img class="pic" src="' + url + '" />');
      } else if (photoServiceURLs.test(url)) {
        loadImage(data.id_str, url);
        embeds.push('<img class="pic embed' + data.id_str + '" src="data:image/gif;base64,R0lGODlhAQABAIABAP///wAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" />');
      }
    });
  }

  var html = tweetTemplate({
    id: data.id_str,
    screen_name: data.user.screen_name,
    name: data.user.name,
    profile_image_url: data.user.profile_image_url,
    created_at: data.created_at,
    nice_date: moment(data.created_at).format('dddd D MMMM à HH:MM'),
    embeds: embeds,
    tweet: twitterlib.ify.clean(twitterlib.expandLinks(data))
  });

  // since_id is a global tracker to ensure we only hit Twitter for *new* tweets
  since_id = data.id;

  return html;
}

function runTweets() {
  var since_id = 1;
  $(document.body).addClass('run');

  var options = { since: since_id };

  var tweets = twitterlib.search(config.search, options, passToQueue);
  if (config.list) tweets.list(config.list, options, passToQueue);

  function passToQueue(data, options) {
    if (data.length) {
      twitterQueue.push(data.reverse());
    }
  }
}

/************************************************
 CLOCK / SCHEDULE DEBUG TRIGGER
 ************************************************/

function initClock() {
  var clock = $('#clock');
  if (window.debugTime) {
    var nextTime = (window.debugTime || 0) + 6 * 60 * 1000;
    updateDebugClock(window.debugTime, nextTime);
    clock.on('click', function() {
      window.debugTime = nextTime;
      updateDebugClock(window.debugTime, nextTime);
      nextTime += 6 * 60 * 1000;
      checkSchedules();
    });
  } else {
    updateClock();
    setInterval(updateClock, 1000);
  }

  function pad2(d) {
    return (d < 10 ? '0' : '') + d;
  }

  function formatTime(time, sep) {
    var now = new Date(time);
    return pad2(now.getHours()) + sep + pad2(now.getMinutes());
  }

  function updateClock() {
    clock.text(formatTime(Date.now(), ':'));
  }

  function updateDebugClock() {
    clock.text(formatTime(window.debugTime, ':')).attr('href', '#' + formatTime(nextTime, ''));
  }
}

/************************************************
 UTILITIES
 ************************************************/

// selector to find elements below the fold
$.extend($.expr[':'], {
  below: function (a, i, m) {
    var y = m[3];
    return $(a).offset().top > y;
  }
});

function parseTime(t) {
  // var parts = t.split(/[:\s]/g),
  //     hour = parts[0] | 0,
  //     min = parts[1] | 0;

  // if (parts[2] == 'PM' && hour != 12) hour += 12;

  var d = new Date();
  d.setHours(t.substr(0, 2));
  d.setMinutes(t.substr(2, 2));

  return d.getTime();
}

function parseTiming(t) {
  (t+'').replace(/.*?([hms]+).*/, function (all, match) {
    var n = all.replace(new RegExp(match), '') * 1;

    if (match === 'ms') {
      // do nothing
    } else if (match === 's') {
      n *= 1000;
    } else if (match === 'm') {
      n *= 60 * 1000;
    } else if (match === 'h') {
      n *= 60 * 60 * 1000;
    }

    t = n;
  });

  return t;
}

/************************************************
 TWITTERWALL ENTRY POINT
 ************************************************/

function init() {
  if (config.timings) {
    for (var key in config.timings) {
      // convert string times to milliseconds
      config.timings[key] = parseTiming(config.timings[key]);
    }
  }

  if (config.title) {
    document.title = config.title;
  }

  moment.lang('fr');
  initSchedules();
  initNotices();
  initClock();
  initTwitter();
}

init();
