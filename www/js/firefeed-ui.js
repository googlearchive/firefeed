
var __ff_ui = null;
$(function() {
  __ff_ui = new FirefeedUI();
});

function FirefeedUI() {
  this._limit = 141;
  this._loggedIn = false;
  this._spinner = new Spinner();
  this._firefeed = new Firefeed("https://firefeed.firebaseio-staging.com/");

  // Setup page navigation.
  this._router = null;

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
      self.renderHome();
    }
  });

  self._router = new mainRouter();
  Backbone.history.start();
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

FirefeedUI.prototype.renderHome = function(e) {
  if (e) {
    e.preventDefault();
  }

  $("#header").html(_.template(
    $("#tmpl-header-content").html(), {homePage: true}
  ));
  $("#inner-body").html($("#tmpl-index-content").html());

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
      } else {
        self._loggedIn = info;
        self._router.navigate("timeline", {trigger: true});
      }
    });
  });

  $("#about-link").remove();
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

// Backbone Models.
var sparkList = {};
var Spark = Backbone.Model.extend({
});
User = Backbone.Model.extend({
});

// Backbone Collections.
var Feed = Backbone.Collection.extend({
  model: Spark,
  initialize: function(limit, uid) {
    var self = this;
    self._limit = limit || 10;
    __ff_ui._firefeed.onNewSpark(self._limit, function(sparkId, spark) {
      spark.content = spark.content.substring(0, 141);
      spark.sparkId = sparkId;
      spark.friendlyTimestamp = __ff_ui._formatDate(new Date(spark.timestamp || 0));
      var sparkModel = new Spark(spark);
      sparkList[sparkId] = sparkModel;
      self.trigger("add", sparkModel);
    }, function(id) {
      sparkList[id].trigger("remove");
      delete sparkList[id];
    }, uid);
  }
});

// Backbone Views.
var SparkView = Backbone.View.extend({
  tagName: "li",
  initialize: function() {
    this.listenTo(this.model, "remove", this.removeSelf);
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
});

var TimelineView = Backbone.View.extend({
  el: $("#inner-body"),
  render: function() {
    this.$el.html(_.template($("#tmpl-timeline-content").html())(this.model.toJSON()));
    new FeedView({model: new Feed(), el: $("#spark-timeline-list")});
  }
});

var FeedView = Backbone.View.extend({
  initialize: function() {
    this.listenTo(this.model, "add", this.addSpark);
  },
  addSpark: function(spark) {
    var view = new SparkView({model: spark, id: "spark-" + spark.get("sparkId")});
    var sparkEl = view.render().$el;
    this.$el.prepend(sparkEl.hide());
    sparkEl.slideDown("slow");
  }
});
