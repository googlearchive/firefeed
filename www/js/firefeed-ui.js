
var __ff_ui;
$(function() {
  // Load the Facebook SDK, then initialize FirefeedUI;
  window.fbAsyncInit = function() {
    FB.init({
      appId      : "104907529680402",
      channelUrl : "channel.html"
    });
    __ff_ui = new FirefeedUI();
  };
  (function(d, debug){
    var js, id = "facebook-jssdk", ref = d.getElementsByTagName("script")[0];
    if (d.getElementById(id)) {return;}
    js = d.createElement("script"); js.id = id; js.async = true;
    js.src = "//connect.facebook.net/en_US/all" + (debug ? "/debug" : "") + ".js";
    ref.parentNode.insertBefore(js, ref);
  }(document, /*debug*/ false));
});

function FirefeedUI() {
  this._limit = 120;
  this._loggedIn = false;
  this._firefeed = new Firefeed("http://firefeed.firebaseio-staging.com/");

  // Setup history callbacks.
  var self = this;
  History.Adapter.bind(window, "statechange", function() {
    var state = History.getState();
    console.log("Got statechange");
    console.log(state);
    if (state.data && state.data.info) {
      self._loggedIn = state.data.info;
    }
    self._pageController(state.url);
  });

  // Figure out if the user is logged in or not, with silent login.
  self.login(function(info) {
    self._loggedIn = info;
    self._pageController(window.location.href);
  });
}

FirefeedUI.prototype._pageController = function(url) {
  // Extract sub page from URL, if any.
  var idx = url.indexOf("?");
  var hash = (idx > 0) ? window.location.href.slice(idx + 1) : "";

  console.log("Handling " + url + " -> " + hash);
  console.log(this._loggedIn);

  switch (hash) {
    case "timeline":
    default:
      if (this._loggedIn) {
        this.renderTimeline(this._loggedIn);
      } else {
        this.renderHome();
        History.pushState({}, "", "/");
      }
      break;
  }
};

FirefeedUI.prototype.login = function(cb) {
  // Try silent login in case the user is already logged in.
  var self = this;
  self._firefeed.login(true, function(err, info) {
    if (!err && info) {
      cb(info);
    } else {
      cb(false);
    }
  });
};

FirefeedUI.prototype.logout = function(e) {
  this._firefeed.logout();
  this._loggedIn = false;
  History.pushState({}, "", "/");
  e.preventDefault();
};

FirefeedUI.prototype.renderHome = function() {
  $("#header").html($("#tmpl-index-header").html());

  // Preload animation.
  var path = "img/curl-animate.gif";
  var img = new Image();
  img.src = path;

  // Steup curl on hover.
  $(".ribbon-curl").find("img").hover(function() {
    $(this).attr("src", path);
  }, function() {
    $(this).attr("src", "img/curl-static.gif");
  });

  var body = Mustache.to_html($("#tmpl-content").html(), {
    classes: "cf home", content: $("#tmpl-index-content").html()
  });
  $("#body").html(body);

  var self = this;
  $("#login-button").click(function(e) {
    self._firefeed.login(false, function(err, info) {
      if (err) {
        console.log("Error logging in: " + err);
      } else {
        History.pushState({info: info}, "", "/?timeline");
      }
    });
    e.preventDefault();
  });
};

FirefeedUI.prototype.renderTimeline = function(info) {
  $("#header").html($("#tmpl-page-header").html());
  $("#logout-button").click(this.logout.bind(this));

  // Render body.
  var content = Mustache.to_html($("#tmpl-timeline-content").html(), info);
  var body = Mustache.to_html($("#tmpl-content").html(), {
    classes: "cf", content: content
  });
  $("#body").html(body);

  // Attach textarea handlers.
  var self = this;
  function _textAreaHandler() {
    var textarea = $("#spark-input");
    var text = textarea.val();

    $("#c-count").text("" + (self._limit - text.length));
    if (text.length > self._limit) {
      $("#c-count").css("color", "red");
    } else {
      $("#c-count").css("color", "#999");
    }
  };
  $("#c-count").text(self._limit);
  $("#spark-input").keyup(_textAreaHandler);
  $("#spark-input").blur(_textAreaHandler);

  // Attach suggested user event.
  self._firefeed.onNewSuggestedUser(function(userid, info) {
    info.id = userid;
    $(Mustache.to_html($("#tmpl-suggested-user").html(), info)).
      appendTo("#suggested-users");
  });
};
