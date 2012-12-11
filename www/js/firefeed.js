
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
  }
};

Firefeed.prototype.login = function(user, onComplete) {
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
};

Firefeed.prototype.logout = function(onComplete) {
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
};

Firefeed.prototype.follow = function(user, onComplete) {
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
};

Firefeed.prototype.post = function(content, onComplete) {
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
};

Firefeed.prototype.onNewSuggestedUser = function(onComplete) {
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
};

Firefeed.prototype.onNewSpark = function(onComplete) {
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
};
