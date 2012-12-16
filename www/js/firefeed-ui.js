
var __ff_ui;
$(window).bind("popstate", function(e)) {
  if (e.state) {
    switch (e.state.page) {
      case "home":
        __ff_ui.renderHome();
      case "timeline":
        __ff_ui.renderTimeline(e.state.name);
        break;
    }
  } else {
    renderHome();
  }
}
$(document).ready(function() {
  __ff_ui = new FirefeedUI();
  __ff_ui.renderHome();
});

function FirefeedUI() {
  this._firefeed = Firefeed("http://firefeed.firebaseio-staging.com/");
}

FirefeedUI.prototype.renderHome = function() {
  $("#header").html($("#tmpl-index-header").html());

  $(".ribbon-curl").find("img").hover(function(){
    $(this).attr("src", "img/curl-animate.gif");
  }, function(){
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
        alert("oops!");
      } else {
        history.pushState(
          {page: "timeline", name: name}, "timeline", "timeline"
        );
        self.renderTimeline(name);
      }
    });
    e.preventDefault();
  });
};

FirefeedUI.prototype.renderTimeline = function(name) {
  $("#header").html($("#tmpl-page-header").html());
  var content = Mustache.to_html($("#tmpl-timeline-content").html(), {
    name: name, location: "San Francisco, CA"
  });
  var body = Mustache.to_html($("#tmpl-content").html(), {
    classes: "cf", content: content
  });
  $("#body").html(body);

  firefeed.onNewSuggestedUser(function(userid, name) {
      $(Mustache.to_html($("#tmpl-suggested-user").html(), {
        id: userid, name: name
      })).appendTo("#suggested-users");
  });
};
