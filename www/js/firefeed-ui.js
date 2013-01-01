
var __ff_ui = null;
$(function() {
  __ff_ui = new FirefeedUI();
});

/* Controller */
function FirefeedUI() {
  this._limit = 141;
  this._router = null;
  this._loggedIn = false;
  this._firefeed = new Firefeed("https://firefeed.firebaseio-staging.com/");

  // Figure out if the user is logged in or not, with silent login.
  var self = this;
  this._firefeed.login(true, function(err, info) {
    if (!err && info) {
      self._loggedIn = info;
    }
    self._setupHandlers();
  });
}

FirefeedUI.prototype._setupHandlers = function() {
  // Setup collections.
  var self = this;
  var sparkList = {};

  // Global feed of all user's sparks.
  var globalFeed = new FirefeedUI.Feed();
  self._firefeed.onNewSparkFrom(5, function(sparkId, spark) {
    spark.sparkId = sparkId;
    spark.content = spark.content.substring(0, self._limit);
    spark.friendlyTimestamp = self._formatDate(new Date(spark.timestamp || 0));
    
    var sparkModel = new FirefeedUI.Spark(spark);
    sparkList[sparkId] = sparkModel;
    globalFeed.add(sparkModel);
  }, function(id) {
    globalFeed.remove(sparkList[id]);
    delete sparkList[id];
  });

  // Setup routes.
  var self = this;
  var mainRouter = Backbone.Router.extend({
    routes: {
      "timeline": "timeline",
      "profile/:id": "profile",
      "spark/:id": "spark",
      "*splat": "home"
    },
    timeline: function() {
      self.renderTimeline();
    },
    profile: function(id) {
      self.renderProfile(id);
    },
    spark: function(id) {
      self.renderSpark(id);
    },
    home: function() {
      var view = new FirefeedUI.HomeView({collection: globalFeed});
      view.on("firefeed:login", function() {
        self._firefeed.login(false, function(err, info) {
          if (err) {
            view.trigger("firefeed:login:failed");
          } else {
            self._loggedIn = info;
            self._router.navigate("timeline", {trigger: true});
          }
        });
      });
      self._showView(view, true);
    }
  });

  this._router = new mainRouter();
  Backbone.history.start();
};

FirefeedUI.prototype._showView = function(view, isHome) {
  if (this._currentView) {
    this._currentView.body.close();
    this._currentView.header.close();
  }
  this._currentView = {
    body: view,
    header: new FirefeedUI.HeaderView({_isHome: isHome})
  };
  this._currentView.header.render();
  this._currentView.body.render();
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
}

FirefeedUI.prototype.logout = function(e) {
  if (e) {
    e.preventDefault();
  }
  this._firefeed.logout();
  this._loggedIn = false;
  this._router.navigate("home", {trigger: true});
};

FirefeedUI.prototype.render404 = function() {
  // TODO: Add 404 page.
  this._router.navigate("404", {trigger: true});
};

FirefeedUI.prototype.goHome = function() {
  this._router.navigate("timeline", {trigger: true});
};

FirefeedUI.prototype.renderTimeline = function() {
  var self = this;

  if (!self._loggedIn) {
    self._router.navigate("home", {trigger: true});
    return;
  }

  var info = self._loggedIn;
  $("#header").html(_.template(
    $("#tmpl-header-content").html(), {homePage: false}
  ));
  $("#top-logo").click(this.goHome.bind(this));
  $("#logout-button").click(this.logout.bind(this));

  // Render placeholders for location / bio if not filled in.
  info.location = info.location || "Your Location...";
  info.bio = info.bio || "Your Bio...";

  // Render body.
  new TimelineView({model: new User(info)}).render();

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

  // Get some "suggested" users.
  self._firefeed.getSuggestedUsers(function(userid, info) {
    info.id = userid;
    $(_.template($("#tmpl-suggested-user").html(), info)).
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
  $("#header").html(_.template(
    $("#tmpl-header-content").html(), {homePage: false}
  ));
  $("#top-logo").click(this.goHome.bind(this));
  if (self._loggedIn) {
    $("#logout-button").click(self.logout.bind(self));
  } else {
    $("#logout-button").remove();
  }

  // Render profile page body.
  $("#inner-body").html(_.template($("#tmpl-profile-body").html()));

  // Update user info.
  self._firefeed.getUserInfo(uid, function(info) {
    info.id = uid;
    var content = _.template($("#tmpl-profile-content").html(), info);
    $("#profile-content").html(content);
    var button = $("#followBtn-" + info.id);

    // Show follow button if logged in.
    if (self._loggedIn && self._loggedIn != info.id) {
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
  });

  // Render this user's tweets.
  new FeedView({model: new Feed(5, uid), el: $("#spark-profile-list")});
};

FirefeedUI.prototype.renderSpark = function(id) {
  $("#header").html(_.template(
    $("#tmpl-header-content").html(), {homePage: false}
  ));
  $("#top-logo").click(this.goHome.bind(this));
  $("#logout-button").click(this.logout.bind(this));

  // Render spark page body.
  var self = this;
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
        var content = _.template($("#tmpl-spark-content").html(), spark);
        $("#innerBody").html(content);
      });
    }
  });
};

/* Convenience close method to clean up views */
Backbone.View.prototype.close = function() {
  this.remove();
  this.off();
  if (this.onClose) {
    this.onClose();
  }
};

/* Backbone Models */
FirefeedUI.User = Backbone.Model.extend({
});
FirefeedUI.Spark = Backbone.Model.extend({
});

/* Backbone Collections */
FirefeedUI.Feed = Backbone.Collection.extend({
});

/* Backbone Views */
FirefeedUI.SparkView = Backbone.View.extend({
  tagName: "li",
  render: function() {
    this.$el.html(_.template($("#tmpl-spark").html())(this.model.toJSON()));
    return this;
  },
  removeSelf: function() {
    var self = this;
    setTimeout(function() {
      self.$el.stop().slideToggle("slow", function() {
        self.remove();
      });
    }, 100);
  }
});

FirefeedUI.FeedView = Backbone.View.extend({
  initialize: function() {
    this._sparks = {};
    this.listenTo(this.model, "add", this.addSpark);
    this.listenTo(this.model, "remove", this.removeSpark);
  },
  addSpark: function(spark) {
    var id = spark.get("sparkId");
    var view = new FirefeedUI.SparkView({model: spark, id: "spark-" + id});
    this._sparks[id] = view;

    var sparkEl = view.render().$el;
    this.$el.prepend(sparkEl.hide());
    sparkEl.slideDown("slow");
  },
  removeSpark: function(spark) {
    var id = spark.get("sparkId");
    this._sparks[id].removeSelf();
    delete this._sparks[id];
  },
  onClose: function() {
    _.each(this._sparks, function(view) {
      view.close();
    });
  }
});

FirefeedUI.HeaderView = Backbone.View.extend({
  el: $("#header"),
  initialize: function(options) {
    this._isHome = options._isHome;
  },
  render: function() {
    this.$el.html(_.template(
      $("#tmpl-header-content").html(), {homePage: this._isHome}
    ));
  },
  events: function() {
    if (this._isHome) {
      // Preload curl animationg gif.
      this._curlPath = "img/curl-animate.gif";
      var img = new Image();
      img.src = this._curlPath;
      return { "hover .ribbon-curl > img": "curl" };
    }
  },
  curl: function(e) {
    if (e.type == "mouseenter") {
      $(e.target).attr("src", this._curlPath);
    } else {
      $(e.target).attr("src", "img/curl-static.gif");
    }
  }
});

FirefeedUI.HomeView = Backbone.View.extend({
  el: $("#inner-body"),
  events: {
    "click #login-button": "login"
  },
  render: function() {
    this.$el.html($("#tmpl-index-content").html());
    this._spinner = new Spinner();
    this._button = $("#login-button");
    this.on("firefeed:login:failed", this.loginFailed);
    this._globalFeedView = new FirefeedUI.FeedView({
      model: this.collection, el: $("#spark-index-list")
    });
    this._globalFeedView.render();
  },
  login: function(e) {
    e.preventDefault();
    this._button.hide();
    this._spinner.spin($("#login-div").get(0));
    this.trigger("firefeed:login");
  },
  loginFailed: function() {
    this._spinner.stop();
    this._button.show();
    humane.addnCls = "humane-jackedup-error";
    humane.log("Sorry, there was an error while logging in!");
  },
  onClose: function() {
    this._globalFeedView.close();
  }
});

FirefeedUI.TimelineView = Backbone.View.extend({
  el: $("#inner-body"),
  render: function() {
    this.$el.html(_.template($("#tmpl-timeline-content").html())(this.model.toJSON()));
    new FeedView({model: new UserFeed(10), el: $("#spark-timeline-list")});
  }
});
