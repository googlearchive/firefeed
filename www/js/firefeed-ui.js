
var ff = new Firefeed("http://firefeed.firebaseio-staging.com/");

$(document).ready(function() {
  $("#login-button").click(function() {
    ff.login(false, signedIn);
  });
  $("#logout-button").click(function() {
    ff.logout();
    signedOut();
  });

  ff.login(true, function(err, name) {
    if (err) {
      // User is not signed in, render button.
      $("#login-box").css("display", "block");
      return;
    }
    // Resuming session.
    signedIn(err, name);
  });
});

function signedIn(err, name) {
  if (err) {
    alert("There was an error while logging in! " + err);
    return;
  }
  showSuggested();
  updateStream();
  $("#login-box").css("display", "none");
  $("#welcome-msg").html("Welcome back to FireFeed, <b>" + name + "</b>!");
  $("#content-box").css("display", "block");
}
function signedOut() {
  $("#login-box").css("display", "block");
  $("#welcome-msg").html("Welcome to FireFeed!");
  $("#content-box").css("display", "none");
}
function showSuggested() {
  ff.onNewSuggestedUser(function(userid, name) {
    $("#recommended").css("display", "block");
    $("<li id='follow" + userid + "' />")
        .html(name + " - <a href='#' onclick='followUser(\"" + userid + "\");'>Follow</a>")
        .appendTo("#recommended-list");
  });
}
function updateStream() {
  ff.onNewSpark(function(id, spark) {
    if ($("#default-spark").length) {
      $("#default-spark").remove();
    }
    var elId = "#spark-" + id;
    var innerHTML = "<td>" + spark.displayName + "</td>" + "<td>" + spark.content + "</td>";
    if ($(elId).length) {
      $(elId).html(innerHTML);
    } else {
      $("#spark-stream tr:last").after($("<tr/>", {id: elId}).html(innerHTML));
    }
  });
}
function followUser(user) {
  ff.follow(user, function(err, done) {
    if (!err) {
      $("#follow" + user).delay(500).fadeOut("slow", function() {
        $(this).remove();
        if ($("#recommended-list li").length == 0) {
          $("#recommended-list").fadeOut("slow");
        }
      });
      return;
    }
    alert("Could not follow user! " + err);
  });
}
function onSparkPost() {
  $("post-button").attr("disabled", "disabled");
  ff.post($("#new-spark").val(), function(err, done) {
    showPostedToast(!err);
  });
}
function showPostedToast(success) {
  $("post-button").removeAttr("disabled");

  var toast;
  if (success) {
    $("#new-spark").val("");
    toast = $("<span class='success'/>");
    toast.html("Successfully posted!")
  } else {
    toast = $("<span class='warning'/>");
    toast.html("Error while posting!");
  }
  toast.css("display", "none");

  toast.appendTo($("#submit-box"));
  toast.delay(100).fadeIn("slow", function() {
    $(this).delay(1000).fadeOut("slow", function() {
      $(this).remove();
    });
  });
}
