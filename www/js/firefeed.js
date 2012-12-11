
function Firefeed(baseURL, authURL) {
  this._user = null;
  this._firebase = null;
  this._mainUser = null;

  this._baseURL = baseURL;
  this._authURL = authURL;
}
Firefeed.prototype = {
  _validateCallback: function _validateCallback(cb) {
    if (!cb || typeof cb != "function") {
      throw new Error("Invalid onComplete callback provided");
    }
  },

  _validateString: function _validateString(str, name) {
    if (!str || typeof str != "string") {
      throw new Error("Invalid " + name + " provided");
    }
  },

  login: function login(user, onComplete) {
    var self = this;
    self._validateString(user, "user");
    self._validateCallback(onComplete);
    $.ajax({
      type: "POST",
      url: self._authURL + "/login",
      data: {user: user || ""},
      dataType: "json",
      success: function(data) {
        self._user = data.user;
        var ref = new Firebase(self._baseURL);
        ref.auth(data.token, function(done) {
          if (done) {
            self._firebase = ref;
            self._mainUser = ref.child("users").child(user);
            ref.child("people").child(user).set("online");
            onComplete(false, self._user);
          } else {
            onComplete(new Error("Could not auth to Firebase"), false);
          }
        });
      },
      error: function(xhr, status, error) {
        onComplete(error, null);
      }
    });
  },

  logout: function logout(onComplete) {
    var self = this;
    self._validateCallback(onComplete);
    $.ajax({
      type: "POST",
      url: self._authURL + "/logout",
      success: function(data) {
        self._firebase.child("people").child(user).set("offline");
        self._firebase.unauth();
        self._firebase = null;
        self._mainUser = null;
        self._user = null;
        onComplete(false, true);
      },
      error: function(xhr, status, error) {
        onComplete(error, false);
      }
    });
  },

  follow: function follow(user, onComplete) {
    var self = this;
    self._validateString(user, "user");
    self._validateCallback(onComplete);
    self._mainUser.child("following").child(user).set(true, function(done) {
      if (!done) {
        onComplete(new Error("Could not follow user"), false);
        return;
      }
      // Add to the folowers list.
      var followUser = self._firebase.child("users").child(user);
      followUser.child("followers").child(self._user).set(true);
      // Copy all previous sparks.
      var myStream = self._mainUser.child("stream");
      followUser.child("sparks").once("value", function(sparkSnap) {
        sparkSnap.forEach(function(spark) {
          myStream.child(spark.name()).set(true);
        });
      });
      onComplete(false, user);
    });
  },

  post: function post(content, onComplete) {
    var self = this;
    self._validateString(content, "spark");
    self._validateCallback(onComplete);
    
    var sparkRef = self._firebase.child("sparks").push();
    sparkRef.set({author: self._user, content: content}, function(done) {
      if (!done) {
        onComplete(new Error("Could not post spark"), false);
        return;
      }
      self._mainUser.child("sparks").child(sparkRef.name()).set(true, function(done) {
        if (!done) {
          onComplete(new Error("Could not add spark to stream"), false);
          return;
        }
        // Add to the stream of everyone who follows you.
        self._mainUser.child("followers").once("value", function(followerList) {
          followerList.forEach(function(follower) {
            if (follower.val()) {
              var followerRef = self._firebase.child("users").child(follower.name());
              followerRef.child("stream").child(sparkRef.name()).set(true);
            }
          });
        });
        onComplete(false, true);
      });
    });
  },

  onNewSuggestedUser: function onNewSuggestedUser(onComplete) {
    var self = this;
    if (!onComplete || typeof onComplete != "function") {
      throw new Error("Invalid onComplete callback provided");
    }
    var following = self._mainUser.child("following");
    following.once("value", function(followSnap) {
      var users = Object.keys(followSnap.val() || {});
      self._firebase.child("people").on("child_added", function(peopleSnap) {
        var user = peopleSnap.name();
        if (user == self._user || users.indexOf(user) >= 0) {
          return;
        }
        onComplete(user);
      });
    });
  },

  onNewSpark: function onNewSpark(onComplete) {
    var self = this;
    if (!onComplete || typeof onComplete != "function") {
      throw new Error("Invalid onComplete callback provided");
    }
    self._mainUser.child("stream").on("child_added", function(sparkRefSnap) {
      var sparkID = sparkRefSnap.name();
      self._firebase.child("sparks").child(sparkID).on("value", function(sparkSnap) {
        onComplete(sparkSnap.name(), sparkSnap.val());
      });
    });
  },

};


var ff = new Firefeed("https://firefeed.firebaseio.com/", "http://localhost:5000");

function onLogin() {
  ff.login(prompt("Enter username", "Guest"), signedIn);
}
function onLogout() {
  ff.logout(signedOut);
}
function signedIn(err, user) {
  if (err) {
    alert("There was an error while logging in!");
    return;
  }
  showSuggested();
  updateStream();
  $("#login-box").css("display", "none");
  $("#welcome-msg").html("Welcome back to FireFeed, <b>" + user + "</b>!");
  $("#content-box").css("display", "block");
}
function signedOut(err) {
  if (err) {
    alert("There was an error while logging out!");
    return;
  }
  $("#login-box").css("display", "block");
  $("#welcome-msg").html("Welcome to FireFeed!");
  $("#content-box").css("display", "none");
}
function showSuggested() {
  ff.onNewSuggestedUser(function(user) {
    $("<li id='follow" + user + "' />")
        .html(user + " - <a href='#' onclick='followUser(\"" + user + "\");'>Follow</a>")
        .appendTo("#user-list");
  });
}
function updateStream() {
  ff.onNewSpark(function(id, spark) {
    if ($("#default-spark").length) {
      $("#default-spark").remove();
    }
    var elId = "#spark-" + id;
    var innerHTML = "<td>" + spark.author + "</td>" + "<td>" + spark.content + "</td>";
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
