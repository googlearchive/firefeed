
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
  var globalSparkList = {};

  // Global feed of all user's sparks.
  var globalFeed = new FirefeedUI.Feed();
  self._firefeed.onNewSparkFrom(5, function(sparkObj) {
    // Create an empty Spark model first.
    var sparkModel = new FirefeedUI.Spark({sparkId: sparkObj.id});
    globalSparkList[sparkObj.id] = sparkModel;
    globalFeed.add(sparkModel);

    // Keep it updated when the values change.
    sparkObj.onValue = function(spark) {
      spark.content = spark.content.substring(0, self._limit);
      spark.friendlyTimestamp = self._formatDate(new Date(spark.timestamp || 0));
      sparkModel.set(spark);
    }
  }, function(id) {
    globalFeed.remove(globalSparkList[id]);
    delete globalSparkList[id];
  });

  // Feed of all user's sparks.
  var userSparkList = {};
  var userFeed = new FirefeedUI.Feed();

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
      if (!self._loggedIn) {
        self._router.navigate("home", {trigger: true});
        return;
      }

      // Get user info.
      var info = self._loggedIn;
      info.location = info.location || "Your Location...";
      info.bio = info.bio || "Your Bio...";

      // Setup user feed. XXX: Do this only once, on login.
      self._firefeed.onNewSpark(10, function(sparkObj) {
        var sparkModel = new FirefeedUI.Spark({sparkId: sparkObj.id});
        userSparkList[sparkObj.id] = sparkModel;
        userFeed.add(sparkModel);
        sparkObj.onValue = function(spark) {
          spark.content = spark.content.substring(0, self._limit);
          spark.friendlyTimestamp = self._formatDate(new Date(spark.timestamp || 0));
          sparkModel.set(spark);
        }
      }, function(id) {
        userFeed.remove(userSparkList[id]);
        delete userSparkList[id];
      });

      var view = new FirefeedUI.TimelineView({
        model: new FirefeedUI.User(info), collection: userFeed
      });
      self._showView(view);
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

  var self = this;
  this._currentView.header.on("firefeed:home", function() {
    self._router.navigate("home", {trigger: true});
  });
  this._currentView.header.on("firefeed:logout", function() {
    self._firefeed.logout();
    self._loggedIn = false;
    self._router.navigate("home", {trigger: true});
  });

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

  var spinner = new Spinner();
  spinner.spin(containerEl.get(0));
  self._firefeed.post(sparkText.val(), function(err, done) {
    if (!err) {
      message.html("Posted!").css("background", "#008000");
      sparkText.val("");
    } else {
      message.html("Posting failed!").css("background", "#FF6347");
    }
    spinner.stop();
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

FirefeedUI.prototype.render404 = function() {
  // TODO: Add 404 page.
  this._router.navigate("404", {trigger: true});
};

FirefeedUI.prototype.renderTimeline = function() {
  var self = this;


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
  //new FeedView({model: new Feed(5, uid), el: $("#spark-profile-list")});
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
  model: FirefeedUI.Spark,
  comparator: function(spark) {
    return parseInt(spark.get("timestamp"), 10);
  }
});

/* Backbone Views */
FirefeedUI.SparkView = Backbone.View.extend({
  tagName: "li",
  initialize: function() {
    this.listenTo(this.model, "change", this.update);
  },
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
  },
  update: function() {
    this.render();
    if (!this.$el.is(":visible")) {
      this.$el.slideDown("slow");
    }
  }
});

FirefeedUI.FeedView = Backbone.View.extend({
  initialize: function() {
    this._sparks = {};
    _.forEach(this.collection, this.addSpark);
    this.listenTo(this.collection, "add", this.addSpark);
    this.listenTo(this.collection, "remove", this.removeSpark);
  },
  addSpark: function(spark) {
    if (!spark) {
      return;
    }
    var id = spark.get("sparkId");
    var view = new FirefeedUI.SparkView({model: spark, id: "spark-" + id});
    this._sparks[id] = view;
    // Add the spark but keep it hidden. The SparkView will show itself
    // when there's data.
    this.$el.prepend(view.$el.hide());
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
      // Preload curl animation gif.
      this._curlPath = "img/curl-animate.gif";
      var img = new Image();
      img.src = this._curlPath;
      return {
        "hover .ribbon-curl > img": "curl"
      };
    } else {
      return {
        "click #top-logo": "home",
        "click #logout-button": "logout"
      }
    }
  },
  curl: function(e) {
    if (e.type == "mouseenter") {
      $(e.target).attr("src", this._curlPath);
    } else {
      $(e.target).attr("src", "img/curl-static.gif");
    }
  },
  home: function(e) {
    e.preventDefault();
    this.trigger("firefeed:home");
  },
  logout: function(e) {
    e.preventDefault();
    this.trigger("firefeed:logout");
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
      collection: this.collection, el: $("#spark-index-list")
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
    var template = _.template($("#tmpl-timeline-content").html());
    this.$el.html(template(this.model.toJSON()));
    this._userFeedView = new FirefeedUI.FeedView({
      collection: this.collection, el: $("#spark-timeline-list")
    });
    this._userFeedView.render();
  },
  onClose: function() {
    this._userFeedView.close();
  }
});
