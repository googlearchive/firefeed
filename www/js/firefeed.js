
function onLogin(silent) {
  var uid = prompt("Enter username: ", "Guest");
  $.ajax({
    type: "POST",
    url: "http://localhost:5000/login",
    data: {user: uid || ""},
    dataType: "json",
    success: function(data) {
      signedIn(data.user, data.token);
    },
    error: function(xhr, status, error) {
      if (!silent) {
        alert("Error! " + error + " try again!");
      }
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

function signedIn(user, token) {
  $("#login-box").css("display", "none");
  $("#welcome-msg").html("Welcome back to FireFeed, <b>" + user + "</b>!");
}

function signedOut() {
  $("#login-box").css("display", "block");
  $("#welcome-msg").html("Welcome to FireFeed!");
}
