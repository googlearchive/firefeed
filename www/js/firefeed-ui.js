
var __ff_ui;

$(function() {
  __ff_ui = new FirefeedUI();
  History.Adapter.bind(window, 'statechange', function() {
    var state = History.getState();
    switch (state.url) {
      case "?":
        __ff_ui.renderHome(true);
        break;
      case "?timeline":
        __ff_ui.renderTimeline(state.data["name"]);
        break;
      default:
        __ff_ui.renderHome(true);
    }
  });
});

function FirefeedUI() {
  this._limit = 120;
  this._firefeed = new Firefeed("http://firefeed.firebaseio-staging.com/");
  this.renderHome();
}

FirefeedUI.prototype.logout = function(e) {
  this._firefeed.logout();
  History.pushState({logout: true}, "", "?");
  e.preventDefault();
}

FirefeedUI.prototype._renderHome = function() {
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
    self._firefeed.login(false, function(err, name) {
      if (err) {
        console.log("Error logging in: " + err);
      } else {
        self.renderTimeline(name);
        History.pushState({name: name}, "", "?timeline");
      }
    });
    e.preventDefault();
  });
}

FirefeedUI.prototype.renderHome = function(logout) {
  var self = this;
  if (logout) {
    // Don't check if user is logged in.
    self._renderHome();
    return;
  }

  // Try silent login in case the user is already logged in.
  self._firefeed.login(true, function(err, name) {
    if (!err && name) {
      // Redirect to timeline.
      self.renderTimeline(name);
      History.pushState({name: name}, "", "?timeline");
    } else {
      // They aren't logged in, show home page.
      self._renderHome();
    }
  });
};

FirefeedUI.prototype.renderTimeline = function(name) {
  $("#header").html($("#tmpl-page-header").html());
  $("#logout-button").click(this.logout.bind(this));

  // Render body.
  var content = Mustache.to_html($("#tmpl-timeline-content").html(), {
    name: name, location: "San Francisco, CA"
  });
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
  self._firefeed.onNewSuggestedUser(function(userid, name) {
    $(Mustache.to_html($("#tmpl-suggested-user").html(), {
      id: userid, name: name
    })).appendTo("#suggested-users");
  });
};
