
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
  this._firefeed = new Firefeed("http://firefeed.firebaseio.com/");

  // Figure out if the user is logged in or not, with silent login.
  var self = this;
  self.login(function(info) {
    self._loggedIn = info;
    self._pageController(window.location.href);
  });
}

FirefeedUI.prototype._pageController = function(url) {
  // Extract sub page from URL, if any.
  var idx = url.indexOf("?");
  var hash = (idx > 0) ? url.slice(idx + 1) : "";
  var value = hash.split("=");

  switch (value[0]) {
    case "profile":
      if (!value[1]) {
        this.render404({}, "", "/?404");
      } else {
        this.renderProfile(value[1]);
      }
      break;
    case "status":
      if (!value[1]) {
        this.render404({}, "", "/?404");
      } else {
        this.renderStatus(value[1]);
      }
      break;
    case "timeline":
    default:
      if (this._loggedIn) {
        this.renderTimeline(this._loggedIn);
      } else {
        this.renderHome();
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
    $("#c-count").val(self._limit);
    message.css("visibility", "visible");
    message.fadeOut(1500, function() {
      message.replaceWith(sparkButton);
      sparkButton.click(self._postHandler.bind(self));
    });
  });
};

FirefeedUI.prototype._handleNewSpark = function(limit, func) {
  var self = this;
  func(
    limit,
    function(sparkId, spark) {
      spark.sparkId = sparkId;
      spark.friendlyTimestamp = self._formatDate(
        new Date(spark.timestamp || 0)
      );
      var sparkEl = $(Mustache.to_html($("#tmpl-spark").html(), spark)).hide();
      $("#spark-list").prepend(sparkEl);
      sparkEl.slideDown("slow");
    }, function(sparkId) {
      $("#spark-" + sparkId).slideToggle("slow", function() {
        $(this).remove();
      });
    }
  );
};

FirefeedUI.prototype._formatDate = function(date) {
  var localeDate = date.toLocaleString();
  return localeDate.substr(0, localeDate.indexOf(' GMT'));
};

FirefeedUI.prototype._editableHandler = function(id, value) {
  if (id == "inputLocation") {
    this._firefeed.setProfileField("location", value);
  }
  if (id == "inputBio") {
    this._firefeed.setProfileField("bio", value);
  }
  return true;
}

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
  if (e) {
    e.preventDefault();
  }
  this._firefeed.logout();
  this._loggedIn = false;
  this.renderHome();
};

FirefeedUI.prototype.render404 == function() {
  // TODO: Add 404 page.
  this.renderHome();
};

FirefeedUI.prototype.renderHome = function(e) {
  if (e) {
    e.preventDefault();
  }
  if (this._loggedIn) {
    this.renderTimeline(this._loggedIn);
    return;
  }

  $("#header").html($("#tmpl-index-header").html());

  // Preload animation.
  var path = "img/curl-animate.gif";
  var img = new Image();
  img.src = path;

  // Setup curl on hover.
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
        self.renderTimeline(info);
      }
    });
  });

  $("#about-link").remove();
};

FirefeedUI.prototype.renderTimeline = function(info) {
  $("#header").html($("#tmpl-page-header").html());
  $("#top-logo").click(this.renderHome.bind(this));
  $("#logout-button").click(this.logout.bind(this));

  // Render placeholders for location / bio if not filled in.
  info.location = info.location || "Your Location...";
  info.bio = info.bio || "Your Bio...";

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

  // Attach new spark event handler, capped to 10 for now.
  self._handleNewSpark(
    10, self._firefeed.onNewSpark.bind(self._firefeed)
  );

  // Get some "suggested" users.
  self._firefeed.getSuggestedUsers(function(userid, info) {
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

  // Make profile fields editable.
  $(".editable").editable(function(value, settings) {
    self._editableHandler($(this).attr("id"), value);
    return value;
  });
};

FirefeedUI.prototype.renderProfile = function(uid) {
  var self = this;
  $("#header").html($("#tmpl-page-header").html());
  $("#top-logo").click(this.renderHome.bind(this));
  if (self._loggedIn) {
    $("#logout-button").click(self.logout.bind(self));
  } else {
    $("#logout-button").remove();
  }

  // Render profile page body.
  self._firefeed.getUserInfo(uid, function(info) {
    var content = Mustache.to_html($("#tmpl-profile-content").html(), info);
    var body = Mustache.to_html($("#tmpl-content").html(), {
      classes: "cf", content: content
    });
    $("#body").html(body);
  });

  // Render this user's tweets. Capped to 5 for now.
  self._handleNewSpark(
    5, self._firefeed.onNewSparkFor.bind(self._firefeed, uid)
  );
};

FirefeedUI.prototype.renderStatus = function(id) {
  $("#header").html($("#tmpl-page-header").html());
  $("#top-logo").click(this.renderHome.bind(this));
  $("#logout-button").click(this.logout.bind(this));

  // Render spark page body.
  var self = this;
  self._firefeed.getSpark(id, function(info) {
    if (info !== null && info.author) {
      self._firefeed.getUserInfo(info.author, function(authorInfo) {
        for (var key in authorInfo) {
          info[key] = authorInfo[key];
        }
        info.friendlyTimestamp = self._formatDate(
          new Date(info.timestamp || 0)
        );
        var content = Mustache.to_html($("#tmpl-spark-content").html(), info);
        var body = Mustache.to_html($("#tmpl-content").html(), {
          classes: "cf", content: content
        });
        $("#body").html(body);
      });
    }
  });
};
