
var __ff_ui = null;
$(function() {
  __ff_ui = new FirefeedUI();
});

/* Controller */
function FirefeedUI() {
  this._limit = 141;
  this._router = null;
  this._loggedIn = false;

  this._feeds = {};
  this._userFeed = null;
  this._firefeed = new Firefeed("https://firefeed.firebaseio-staging.com/");

  // Figure out if the user is logged in or not, with silent login.
  var self = this;
  this._firefeed.login(true, function(err, info) {
    if (!err && info) {
      self._loggedIn = info;
    }
    self._setupEvents();
    self._setupHandlers();
  });
}

/* This function is needs refactoring BIGTIME */
FirefeedUI.prototype._setupHandlers = function() {
  // Setup collections.
  var self = this;

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

      var view = new FirefeedUI.TimelineView({
        model: new FirefeedUI.User(info), collection: self._getUserFeed(),
        limit: self._limit
      });
      self._showView(view);
    },
    profile: function(id) {
      // Get user info and kick off view. TODO: Refactor this.
      self._firefeed.getUserInfo(id, function(info) {
        info.id = id;
        var view = new FirefeedUI.ProfileView({
          model: new FirefeedUI.User(info),
          collection: self._getFeed(id)
        });
        self._showView(view);
      });
    },
    spark: function(id) {
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
            var view = new FirefeedUI.BigSparkView({
              model: new FirefeedUI.BigSpark(spark)
            });
            self._showView(view);
          });
        }
      });
    },
    home: function() {
      var view = new FirefeedUI.HomeView({collection: self._getFeed()});
      self._showView(view, true);
    }
  });

  this._router = new mainRouter();
  Backbone.history.start();
};

FirefeedUI.prototype._setupEvents = function() {
  var self = this;
  Backbone.on("firefeed:post", function(post) {
    self._firefeed.post(post, function(err, done) {
      if (err) {
        Backbone.trigger("firefeed:post:failed");
      } else {
        Backbone.trigger("firefeed:post:success"); 
      }
    });
  });
  Backbone.on("firefeed:profile", function(key, value) {
    self._firefeed.setProfileField(key, value);
  });
  Backbone.on("firefeed:login", function() {
    self._firefeed.login(false, function(err, info) {
      if (err) {
        Backbone.trigger("firefeed:login:failed");
      } else {
        self._loggedIn = info;
        self._router.navigate("timeline", {trigger: true});
      }
    });
  });
  Backbone.on("firefeed:home", function() {
    self._router.navigate("home", {trigger: true});
  });
  Backbone.on("firefeed:logout", function() {
    self._firefeed.logout();
    self._loggedIn = false;
    self._router.navigate("home", {trigger: true});
  });
};

FirefeedUI.prototype._getFeed = function(uid) {
  if (this._feeds[uid]) {
    return this._feeds[uid];
  }

  var self = this;
  var sparkList = {};
  var userFeed = new FirefeedUI.Feed();
  self._firefeed.onNewSparkFrom(5, function(sparkObj) {
    // Create an empty Spark model first.
    var sparkModel = new FirefeedUI.Spark({sparkId: sparkObj.id});
    sparkList[sparkObj.id] = sparkModel;
    userFeed.add(sparkModel);

    // Keep it updated when the values change.
    sparkObj.onValue = function(spark) {
      spark.content = spark.content.substring(0, self._limit);
      spark.friendlyTimestamp = self._formatDate(new Date(spark.timestamp || 0));
      sparkModel.set(spark);
    }
  }, function(id) {
    userFeed.remove(sparkList[id]);
    delete sparkList[id];
  }, uid);

  return this._feeds[uid] = userFeed;
};

FirefeedUI.prototype._getUserFeed = function() {
  if (this._userFeed) {
    return this._userFeed;
  }

  // Create user feed.
  var self = this;
  var userSparkList = {};
  var userFeed = new FirefeedUI.Feed();
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

  return this._userFeed = userFeed;
}

FirefeedUI.prototype._showView = function(view, isHome) {
  if (this._currentView) {
    this._currentView.body.close();
    this._currentView.header.close();
  }

  this._currentView = {
    body: view,
    header: new FirefeedUI.HeaderView({_isHome: isHome, _user: this._loggedIn})
  };
  this._currentView.header.render();
  this._currentView.body.render();
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
FirefeedUI.BigSpark = Backbone.Model.extend({
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
    this._user = options._user;
    this._isHome = options._isHome;
  },
  render: function() {
    this.$el.html(_.template(
      $("#tmpl-header-content").html(), {homePage: this._isHome}
    ));
    // Hide logout button if user is not logged in.
    if (!this._user) {
      $("#logout-button").hide();
    }
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
    Backbone.trigger("firefeed:home");
  },
  logout: function(e) {
    e.preventDefault();
    Backbone.trigger("firefeed:logout");
  }
});

FirefeedUI.HomeView = Backbone.View.extend({
  el: $("#inner-body"),
  initialize: function() {
    this.listenTo(Backbone, "firefeed:login:failed", this.loginFailed);
  },
  events: {
    "click #login-button": "login"
  },
  render: function() {
    this.$el.html($("#tmpl-index-content").html());
    this._spinner = new Spinner();
    this._button = $("#login-button");
    this._globalFeedView = new FirefeedUI.FeedView({
      collection: this.collection, el: $("#spark-index-list")
    });
    this._globalFeedView.render();
  },
  login: function(e) {
    e.preventDefault();
    this._button.hide();
    this._spinner.spin($("#login-div").get(0));
    Backbone.trigger("firefeed:login");
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

FirefeedUI.PostSparkView = Backbone.View.extend({
  initialize: function(options) {
    this._limit = options.limit;
    this.listenTo(Backbone, "firefeed:post:failed", this.onPostFailed);
    this.listenTo(Backbone, "firefeed:post:success", this.onPostSuccess);
  },
  events: {
    "blur #spark-input": "textHandler",
    "keyup #spark-input": "textHandler",
    "click #spark-button": "postHandler"
  },
  render: function() {
    // Put user info.
    this.$el.html(_.template($("#tmpl-post-spark").html())(this.model.toJSON()));

    // Initialize spark text area.
    $("#spark-button").css("visibility", "hidden");
    $("#c-count").text(this._limit);

    // Make profile fields editable.
    $(".editable").editable(function(value, settings) {
      var id = $(this).attr("id");
      if (id == "inputLocation") {
        Backbone.trigger("firefeed:profile", "location", value);
      }
      if (id == "inputBio") {
        Backbone.trigger("firefeed:profile", "bio", value);
      }
      return value;
    });
  },
  textHandler: function(e) {
    var button = $("#spark-button");
    var charCount = $("#c-count");
    var text = $(e.target).val();
    charCount.text("" + (this._limit - text.length));
    if (text.length > this._limit) {
      charCount.css("color", "#FF6347");
      button.css("visibility", "hidden");
    } else if (text.length == 0) {
      button.css("visibility", "hidden");
    } else {
      charCount.css("color", "#999");
      button.css("visibility", "visible");
    }
  },
  postHandler: function(e) {
    e.preventDefault();

    this._sparkButton = $(e.target);
    this._message = $("<div>", { class: "msg" }).html("Posting...");
    this._sparkButton.replaceWith(this._message);

    this._spinner = new Spinner();
    this._spinner.spin($("#spark-button-div").get(0));

    Backbone.trigger("firefeed:post", $("#spark-input").val());
  },
  onPostFailed: function() {
    this._message.html("Posting failed!").css("background", "#FF6347");
    this.resetPost();
  },
  onPostSuccess: function() {
    this._message.html("Posted!").css("background", "#008000");
    $("#spark-input").val("");
    this.resetPost();
  },
  resetPost: function() {
    this._spinner.stop();
    $("#c-count").val(this._limit);
    this._message.css("visibility", "visible");

    var self = this;
    this._message.fadeOut(1500, function() {
      self._message.replaceWith(self._sparkButton);
      self._sparkButton.click(self.postHandler.bind(self));
    });
  }
});

FirefeedUI.TimelineView = Backbone.View.extend({
  el: $("#inner-body"),
  initialize: function(options) {
    this._limit = options.limit;
  },
  render: function() {
    this.$el.html(_.template($("#tmpl-timeline-content").html())());

    // Setup user feed.
    this._userFeedView = new FirefeedUI.FeedView({
      collection: this.collection, el: $("#spark-timeline-list")
    });
    this._userFeedView.render();

    // Setup post spark area.
    this._postSparkView = new FirefeedUI.PostSparkView({
      model: this.model, limit: this._limit, el: $("#post-spark")
    });
    this._postSparkView.render();
  },
  onClose: function() {
    this._userFeedView.close();
    this._postSparkView.close();
  }
});

FirefeedUI.ProfileView = Backbone.View.extend({
  el: $("#inner-body"),
  render: function() {
    this.$el.html(_.template($("#tmpl-profile-body").html()));

    var content = _.template($("#tmpl-profile-content").html())(this.model.toJSON());
    $("#profile-content").html(content);

    // Render this user's sparks.
    this._profileFeedView = new FirefeedUI.FeedView({
      collection: this.collection, el: $("#spark-profile-list")
    });
    this._profileFeedView.render();
  },
  onClose: function() {
    this._profileFeedView.close();
  }
});

FirefeedUI.BigSparkView = Backbone.View.extend({
  el: $("#inner-body"),
  render: function() {
    var content = _.template($("#tmpl-spark-content").html())(this.model.toJSON());
    this.$el.html(content);
  }
});
