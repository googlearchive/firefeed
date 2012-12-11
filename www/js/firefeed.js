
var user = null;
var firebase = null;

function onLogin(silent) {
  var uid = prompt("Enter username: ", "Guest");
  $.ajax({
    type: "POST",
    url: "http://localhost:5000/login",
    data: {user: uid || ""},
    dataType: "json",
    success: function(data) {
      user = data.user;
      var ref = new Firebase("https://firefeed.firebaseio.com/");
      ref.auth(data.token, function(fin) {
        if (fin) {
          firebase = ref;
          signedIn();
        } else {
          alert("Could not sign in to Firebase!");
        }
      });
    },
    error: function(xhr, status, error) {
      alert("Error! " + error + " try again!");
    }
  });
}

function onLogout() {
  $.ajax({
    type: "POST",
    url: "http://localhost:5000/logout",
    success: function(data) {
      signedOut();
    },
    error: function(xhr, status, error) {
      alert("Error! " + error + " try again!");
    }
  });
}

function signedIn() {
  firebase.child("people").child(user).set(true, function() {
    showSuggested();
  });
  updateStream();
  $("#login-box").css("display", "none");
  $("#welcome-msg").html("Welcome back to FireFeed, <b>" + user + "</b>!");
  $("#content-box").css("display", "block");
}

function signedOut() {
  $("#login-box").css("display", "block");
  $("#welcome-msg").html("Welcome to FireFeed!");
  $("#content-box").css("display", "none");

  if (firebase) {
    firebase.unauth();
    firebase = null;
  }
}

function updateStream() {
  firebase.child("users").child(user).child("stream").on("child_added", function(sparkRefSnap) {
    if ($("#default-spark")) {
      $("#default-spark").remove();
    }
    firebase.child("sparks").child(sparkRefSnap.name()).on("value", function(sparkSnap) {
      var elId = "#spark-" + sparkSnap.name();
      var spark = sparkSnap.val();
      var innerHTML = "<td>" + spark.author + "</td>" + "<td>" + spark.content + "</td>";
      if ($(elId).length) {
        $(elId).html(innerHTML);
      } else {
        $("#spark-stream tr:last").after($("<tr/>", {id: elId}).html(innerHTML));
      }
    });
  });
}

function showSuggested() {
  firebase.child("users").child(user).child("following").once("value", function(followSnap) {
    var followers = Object.keys(followSnap.val() || {});
    firebase.child("people").on("child_added", function(childSnap) {
      var uid = childSnap.name();
      if (uid == user || followers.indexOf(uid) >= 0) {
        return;
      }
      $("<li id='follow" + uid + "' />")
        .html(uid + " - <a href='#' onclick='followUser(\"" + uid + "\");'>Follow</a>")
        .appendTo("#user-list");
    });
  });
}

function followUser(uid) {
  var ref = firebase.child("users").child(user).child("following").child(uid);
  ref.set(true, function(success) {
    if (success) {
      $("#follow" + uid).delay(500).fadeOut("slow", function() {
        $(this).remove();
      });
      // Add to the folowers list.
      firebase.child("users").child(uid).child("followers").child(user).set(true);
      // Copy all previous sparks.
      var myStream = firebase.child("users").child(user).child("stream");
      firebase.child("users").child(uid).child("sparks").once("value", function(sparkSnap) {
        sparkSnap.forEach(function(spark) {
          myStream.child(spark.name()).set(true);
        });
      });
    }
  });
}

function onSparkPost() {
  if (!firebase) {
    alert("Cannot post Spark without logging in first!");
    return;
  }

  $("post-button").attr("disabled", "disabled");

  var spark = {
    author: user,
    content: $("#new-spark").val()
  };

  var sparkRef = firebase.child("sparks").push();
  sparkRef.set(spark, function(success) {
    if (success) {
      // Add to your own spark list.
      var userSparkRef = firebase.child("users").child(user).child("sparks");
      userSparkRef.child(sparkRef.name()).set(true, showPostedToast);
      // Add to the stream of everyone who follows you.
      firebase.child("users").child(user).child("followers").once("value", function(followerSnap) {
        followerSnap.forEach(function(follower) {
          if (follower.val()) {
            firebase.child("users").child(follower.name()).child("stream").child(sparkRef.name()).set(true);
          }
        });
      });
    } else {
      showPostedToast(false);
    }
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
