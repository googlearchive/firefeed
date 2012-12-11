
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

function showSuggested() {
  firebase.child("people").on("child_added", function(childSnap) {
    var uid = childSnap.name();
    if (uid != user) {
      $("<li/>")
        .html(uid + " - <a onclick='followUser(\"" + uid + "\");'>Follow</a>")
        .appendTo("#user-list");
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
  console.log("trying to post " + JSON.stringify(spark));
  sparkRef.set(spark, function(success) {
    if (success) {
      var userSparkRef = firebase.child("users").child(user).child("sparks");
      userSparkRef.child(sparkRef.name()).set(true, showPostedToast);
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
