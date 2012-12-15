
var firefeed;
$(document).ready(function() {
  firefeed = new Firefeed("http://firefeed.firebaseio-staging.com/");
  renderHome();
});

function renderHome() {
  $("#header").html($("#tmpl-index-header").html());
  var body = Mustache.to_html($("#tmpl-content").html(), {
    classes: "cf home", content: $("#tmpl-index-content").html()
  });
  $("#body").html(body); 

  $("#login-button").click(function(e) {
    firefeed.login(false, function(err, name) {
      if (err) {
        alert("oops!");
      } else {
        renderTimeline(name);
      }
    });
    e.preventDefault();
  });
}

function renderTimeline(name) {
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
}
