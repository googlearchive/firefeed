
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
  this._spinner = new Spinner();
  this._firefeed = new Firefeed("http://firefeed.firebaseio-staging.com/");

  // Setup history callbacks.
  var self = this;
  History.Adapter.bind(window, "statechange", function() {
    var state = History.getState();
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
  var hash = (idx > 0) ? url.slice(idx + 1) : "";

  console.log("Handling " + url + " -> " + hash);
  switch (hash) {
    case "profile":
      // Extract user ID.
      idx = hash.indexOf("=");
      var uid = (idx > 0) ? hash.slice(idx + 1) : "";
      if (uid == "" && !this._loggedIn) {
        this.render404({}, "", "/?404");
      } else {
        this.renderProfile(uid);
        History.pushState({}, "", "?profile=" + uid);
      }
      break;
    case "timeline":
    default:
      if (this._loggedIn) {
        this.renderTimeline(this._loggedIn);
        History.pushState({}, "", "/?timeline");
      } else {
        this.renderHome();
        History.pushState({}, "", "/");
      }
      break;
  }
};

FirefeedUI.prototype._postHandler = function(e) {
  var sparkText = $("#spark-input");
  var sparkButton = $("#spark-button");
  var containerEl = $("#spark-button-div");
  var message = $("<div>", { class: "msg" }).html("Posting...");

  var self = this;
  e.preventDefault();
  sparkButton.replaceWith(message);
  self._spinner.spin(containerEl.get(0));
  self._firefeed.post(sparkText.val(), function(err, done) {
    if (!err) {
      message.html("Posted!").css("background", "#008000");
      sparkText.val("");
    } else {
      message.html("Posting failed!").css("background", "#FF6347");
    }
    self._spinner.stop();
    message.css("visibility", "visible");
    message.fadeOut(1500, function() {
      message.replaceWith(sparkButton);
      sparkButton.click(self._postHandler.bind(self));
    });
  });
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

FirefeedUI.prototype.render404 == function() {

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
  var loginButton = $("#login-button");
  loginButton.click(function(e) {
    e.preventDefault();
    loginButton.css("visibility", "hidden");
    self._spinner.spin($("#login-div").get(0));
    self._firefeed.login(false, function(err, info) {
      if (err) {
        self._spinner.stop();
        loginButton.css("visibility", "visible");
        console.log(err);
      } else {
        History.pushState({info: info}, "", "/?timeline");
      }
    });
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
  var charCount = $("#c-count");
  var sparkText = $("#spark-input");
  $("#spark-button").css("visibility", "hidden");
  function _textAreaHandler() {
    var text = sparkText.val();
    charCount.text("" + (self._limit - text.length));
    if (text.length > self._limit) {
      charCount.css("color", "#FF6347");
      $("#spark-button").css("visibility", "hidden");
    } else if (text.length == 0) {
      $("#spark-button").css("visibility", "hidden");
    } else {
      charCount.css("color", "#999");
      $("#spark-button").css("visibility", "visible");
    }
  };
  charCount.text(self._limit);
  sparkText.keyup(_textAreaHandler);
  sparkText.blur(_textAreaHandler);

  // Attach post spark button.
  $("#spark-button").click(self._postHandler.bind(self));

  // Attach new spark event handler, capped.
  self._firefeed.onNewSpark(5, function(sparkId, spark) {
    spark.sparkId = sparkId;
    var sparkEl = $(Mustache.to_html($("#tmpl-spark").html(), spark)).hide();
    $("#spark-list").prepend(sparkEl);
    sparkEl.slideDown("slow");
  }, function(sparkId) {
    $("#spark-" + sparkId).slideToggle("slow", function() {
      $(this).remove();
    });
  });

  // Attach suggested user event.
  self._firefeed.onNewSuggestedUser(function(userid, info) {
    info.id = userid;
    $(Mustache.to_html($("#tmpl-suggested-user").html(), info)).
      appendTo("#suggested-users");
    var button = $("#followBtn-" + userid);
    // Fade out the suggested user if they were followed successfully.
    button.click(function(e) {
      e.preventDefault();
      button.remove();
      self._firefeed.follow(userid, function(err, done) {
        // TODO FIXME: Check for errors!
        $("#followBox-" + userid).fadeOut(1500);
      });
    });
  });
};

FirefeedUI.prototype.renderProfile = function(uid) {
  $("#header").html($("#tmpl-page-header").html());
  $("#logout-button").click(this.logout.bind(this));

  // Render profile page body.
  var self = this;
  self._firefeed.getUserInfo(uid, function(info) {
    var content = Mustache.to_html($("#tmpl-profile-content").html(), info);
    var body = Mustache.to_html($("#tmpl-content").html(), {
      classes: "cf", content: content
    });
    $("#body").html(body);
  });
};