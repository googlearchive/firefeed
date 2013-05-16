
var __ff_ui;
$(function() {
  __ff_ui = new FirefeedUI();
});

function FirefeedUI() {
  this._limit = 141;
  this._loggedIn = false;
  this._spinner = new Spinner();
  this._firefeed = new Firefeed("https://firefeed.firebaseIO.com/");
  this._unload = null;

  // Setup page navigation.
  this._setupHandlers();

  // Setup History listener.
  var self = this;
  window.History.Adapter.bind(window, "statechange", function() {
    self._pageController(window.History.getState().hash, false);
  });

  self._firefeed.onLoginStateChange(function(error, user) {
    self.onLoginStateChange(error, user);
  });
}

FirefeedUI.prototype._setupHandlers = function() {
  var self = this;
  $(document).on("click", "a.profile-link", function(e) {
    e.preventDefault();
    self._go($(this).attr("href"));
  });
  $(document).on("click", "a.spark-link", function(e) {
    e.preventDefault();
    self._go($(this).attr("href"));
  });
  $(document).on("click", "#search-button", function(e) {
    e.preventDefault();
    self._go("/?search");
  });
  $(document).on("click", "#top-logo", function(e) {
    e.preventDefault();
    self._go("/");
  });
  $(document).on("click", "#logout-button", function(e) {
    e.preventDefault();
    self.logout();
  });
};

FirefeedUI.prototype._go = function(url) {
  window.History.pushState(null, null, url);
};

FirefeedUI.prototype._pageController = function(url) {
  // Extract sub page from URL, if any.
  var idx = url.indexOf("?");
  var hash = (idx > 0) ? url.slice(idx + 1) : "";
  var value = hash.split("=");

  this._unload && this._unload();

  switch (value[0]) {
    case "profile":
      if (!value[1]) {
        this._unload = this.render404();
      } else {
        this._unload = this.renderProfile(value[1]);
      }
      break;
    case "spark":
      if (!value[1]) {
        this._unload = this.render404();
      } else {
        this._unload = this.renderSpark(value[1]);
      }
      break;
    case "search":
      this._unload = this.renderSearch();
      break;
    default:
      if (this._loggedIn) {
        this._unload = this.renderTimeline(this._loggedIn);
      } else {
        this._unload = this.renderHome();
      }
      break;
  }
};

FirefeedUI.prototype._postHandler = function(e) {
  var sparkText = $("#spark-input");
  var sparkButton = $("#spark-button");
  var containerEl = $("#spark-button-div");
  var message = $("<div>").addClass("msg").html("Posting...");

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

FirefeedUI.prototype._handleNewSpark = function(listId, limit, func) {
  var self = this;
  func(
    limit,
    function(sparkId, spark) {
      spark.content = spark.content.substring(0, self._limit);
      spark.sparkId = sparkId;
      spark.friendlyTimestamp = self._formatDate(
        new Date(spark.timestamp || 0)
      );
      var sparkEl = $(Mustache.to_html($("#tmpl-spark").html(), spark)).hide();
      $("#" + listId).prepend(sparkEl);
      sparkEl.slideDown("slow");
    }, function(sparkId) {
      setTimeout(function() {
        $("#spark-" + sparkId).stop().slideToggle("slow", function() {
          $(this).remove();
        });
      }, 100);
    }
  );
};

FirefeedUI.prototype._formatDate = function(date) {
  var localeDate = date.toLocaleString();
  // Remove GMT offset if it's there.
  var gmtIndex = localeDate.indexOf(' GMT');
  if (gmtIndex > 0) {
    localeDate = localeDate.substr(0, gmtIndex);
  }
  return localeDate;
};

FirefeedUI.prototype._editableHandler = function(id, value) {
  if (id == "inputLocation") {
    this._firefeed.setProfileField("location", value);
  }
  if (id == "inputBio") {
    this._firefeed.setProfileField("bio", value);
  }
  return true;
};

FirefeedUI.prototype.onLoginStateChange = function(error, info) {
  this._spinner.stop();
  this._loggedIn = info;
  $("#header").html(Mustache.to_html($("#tmpl-page-header").html(), {user: this._loggedIn}));
  if (info) {
    this.renderTimeline(info);
  } else {
    this.renderHome();
  }
};

FirefeedUI.prototype.logout = function(e) {
  if (e) {
    e.preventDefault();
  }
  this._firefeed.logout();
  this._loggedIn = false;
  this.renderHome();
};

FirefeedUI.prototype.render404 = function() {
  // TODO: Add 404 page.
  this.renderHome();
};

FirefeedUI.prototype.goHome = function() {
  this._go("/");
};

FirefeedUI.prototype.renderHome = function(e) {
  if (e) {
    e.preventDefault();
  }
  if (this._loggedIn) {
    return this.renderTimeline(this._loggedIn);
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
    self._firefeed.login('facebook');
  });

  $("#about-link").remove();

  // Attach handler to display the latest 5 sparks.
  self._handleNewSpark(
    "spark-index-list", 5,
    self._firefeed.onLatestSpark.bind(self._firefeed)
  );
  return function() { self._firefeed.unload(); };
};

FirefeedUI.prototype.renderSearch = function() {
  var self = this;
  $("#header").html(Mustache.to_html($("#tmpl-page-header").html(), {user: self._loggedIn}));
  // Render body.
  var content = Mustache.to_html($("#tmpl-search-content").html());
  var body = Mustache.to_html($("#tmpl-content").html(), {
    classes: "cf", content: content
  });
  $("#body").html(body);

  var searchInput = $("#search-input");
  var MAX_SEARCH_TERM_LENGTH = 20;
  self._firefeed.startSearch(function(results) {
    var searchResultHtml = Mustache.to_html($('#tmpl-search-result').html(), {results: results});
    $('#search-result-list').html(searchResultHtml);
  });
  var onCharChange = function() {
    var searchTerm = searchInput.val();
    if (searchTerm.length > MAX_SEARCH_TERM_LENGTH) {
      searchTerm = searchTerm.substr(0, MAX_SEARCH_TERM_LENGTH)
      searchInput.val(searchTerm);
    }
    self._firefeed.updateSearchTerm(searchTerm);
  };

  searchInput.keyup(onCharChange);
  searchInput.blur(onCharChange);

  return function() { self._firefeed.unload(); };
};

FirefeedUI.prototype.renderTimeline = function(info) {
  var self = this;
  $("#header").html(Mustache.to_html($("#tmpl-page-header").html(), {user: self._loggedIn}));

  // Render placeholders for location / bio if not filled in.
  info.location = info.location.substr(0, 80) || "Your Location...";
  info.bio = info.bio.substr(0, 141) || "Your Bio...";

  // Render body.
  var content = Mustache.to_html($("#tmpl-timeline-content").html(), info);
  var body = Mustache.to_html($("#tmpl-content").html(), {
    classes: "cf", content: content
  });
  $("#body").html(body);

  // Attach textarea handlers.
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
  }
  charCount.text(self._limit);
  sparkText.keyup(_textAreaHandler);
  sparkText.blur(_textAreaHandler);

  // Attach post spark button.
  $("#spark-button").click(self._postHandler.bind(self));

  // Attach new spark event handler, capped to 10 for now.
  self._handleNewSpark(
    "spark-timeline-list", 10,
    self._firefeed.onNewSpark.bind(self._firefeed)
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
  return function() { self._firefeed.unload(); };
};

FirefeedUI.prototype.renderProfile = function(uid) {
  var self = this;
  $("#header").html(Mustache.to_html($("#tmpl-page-header").html(), {user: self._loggedIn}));

  // Render profile page body.
  $("#body").html(Mustache.to_html($("#tmpl-profile-body").html()));

  var followersLoaded = false;
  var followers = [];
  var renderFollowers = function() {
    $('#follower-profile-list').html(Mustache.to_html($('#tmpl-user-list').html(), {users: followers}));
  };

  var followeesLoaded = false;
  var followees = [];
  var renderFollowees = function() {
    $('#followee-profile-list').html(Mustache.to_html($('#tmpl-user-list').html(), {users: followees}));
  };

  // Update user info.
  self._firefeed.getUserInfo(uid, function(info) {
    info.id = uid;
    var content = Mustache.to_html($("#tmpl-profile-content").html(), info);
    $("#profile-content").html(content);
    var button = $("#followBtn-" + info.id);

    // Show follow button if logged in.
    if (self._loggedIn && self._loggedIn.id != info.id) {
      button.click(function(e) {
        e.preventDefault();
        self._firefeed.follow(info.id, function(err, done) {
          // TODO FIXME: Check for errors!
          $("#followBtn-" + info.id).fadeOut(1500);
        });
      });
    } else {
      button.hide();
    }
  }, /*onFollower=*/ function(newFollower) {
    followers.push(newFollower);
    if (followersLoaded) {
      renderFollowers();
    }
  }, /*onFollowersComplete=*/ function() {
    followersLoaded = true;
    renderFollowers();
  }, /*onFollowee=*/ function(newFollowee) {
    followees.push(newFollowee);
    if (followeesLoaded) {
      renderFollowees();
    }
  }, /*onFolloweesComplete=*/ function() {
    followeesLoaded = true;
    renderFollowees();
  });

  // Render this user's tweets. Capped to 5 for now.
  self._handleNewSpark(
    "spark-profile-list", 5,
    self._firefeed.onNewSparkFor.bind(self._firefeed, uid)
  );
  return function() { self._firefeed.unload(); };
};

FirefeedUI.prototype.renderSpark = function(id) {
  var self = this;
  $("#header").html(Mustache.to_html($("#tmpl-page-header").html(), {user: self._loggedIn}));

  // Render spark page body.
  self._firefeed.getSpark(id, function(spark) {
    if (spark !== null && spark.author) {
      self._firefeed.getUserInfo(spark.author, function(authorInfo) {
        for (var key in authorInfo) {
          spark[key] = authorInfo[key];
        }
        spark.content = spark.content.substring(0, self._limit);
        spark.friendlyTimestamp = self._formatDate(
          new Date(spark.timestamp || 0)
        );
        var content = Mustache.to_html($("#tmpl-spark-content").html(), spark);
        var body = Mustache.to_html($("#tmpl-content").html(), {
          classes: "cf", content: content
        });
        $("#body").html(body);
      });
    }
  });
  return function() { self._firefeed.unload(); };
};
