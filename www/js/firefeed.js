
/**
 * The Firefeed object is the primary conduit to the data feed. It provides
 * functions to login a user, log them out, and most importantly, to register
 * callbacks for events like receiving a new message, or a new suggested user
 * to follow. This object knows nothing about the UI, see firefeed-ui.js for
 * how this object is used to make sure the UI is updated as events come in.
 *
 * @param    {string}    baseURL     The Firebase URL.
 * @param    {boolean}   newContext  Whether a new Firebase context is used.
 *                                   (Useful for testing only)
 * @return   {Firefeed}
 */
function Firefeed(baseURL, newContext) {
  this._userid = null;
  this._firebase = null;
  this._mainUser = null;
  this._displayName = null;
  this._newContext = newContext || false;

  if (!baseURL || typeof baseURL != "string") {
    throw new Error("Invalid baseURL provided");
  }
  this._baseURL = baseURL;
}
Firefeed.prototype = {
  _validateCallback: function _validateCallback(cb, notInit) {
    if (!cb || typeof cb != "function") {
      throw new Error("Invalid onComplete callback provided");
    }
    if (!notInit) {
      if (!this._userid || !this._firebase) {
        throw new Error("Method called without a preceding login call");
      }
    }
  },
  _validateString: function _validateString(str, name) {
    if (!str || typeof str != "string") {
      throw new Error("Invalid " + name + " provided");
    }
  },
  _getParameterByName: function _getParameterByName(name) {
    var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
  }
};

/**
 * Login a given user. The provided callback will be called with (err, name)
 * where "err" will be false if the login succeeded, and "name" is set to
 * a string suitable for greeting the user.
 * 
 * It is an error to call any other method on this object without a login()
 * having succeeded.
 *
 * The login is performed using Firebase Easy Login, with Facebook as the
 * identity provider. You will probably call login() twice in your app, once
 * to check if the user is already logged in by passing the silent parameter as
 * true. If they are not (onComplete will be invoked with an error), you may
 * display a login button and associate the click action for it with another
 * call to login(), this time setting silent to false.
 *
 * @param    {boolean}   silent      Whether or not a silent (no popup)
 *                                   login should be performed.
 * @param    {Function}  onComplete  The callback to call when login is done.
 */
Firefeed.prototype.login = function(silent, onComplete) {
  var self = this;
  self._validateCallback(onComplete, true);

  // We store the Firebase token in localStorage, so if one isn't present
  // we'll assume the user hasn't logged in.
  var token = localStorage.getItem("authToken");
  if (!token && silent) {
    onComplete(new Error("User is not logged in"), false);
    return;
  } else if (token) {
    processToken(token);
    return;
  }

  // No token was found, and silent was set to false. We'll attempt to login
  // the user via the Facebook helper.
  var authClient = new FirebaseAuthClient("firefeed", {
    endpoint: "https://staging-auth.firebase.com/auth"
  });
  authClient.login("facebook", function(err, token, info) {
    if (err) {
      onComplete(new Error(err), false);
      return;
    }
    // We got ourselves a token! Persist the info in localStorage for later.
    localStorage.setItem("userid", info.id);
    localStorage.setItem("authToken", token);
    localStorage.setItem("displayName", info.displayName);
    processToken(token);
  });

  function processToken(token) {
    // Create and authenticate a new Firebase ref with the token.
    var ref = new Firebase(
      self._baseURL, self._newContext ? new Firebase.Context() : null
    );
    ref.auth(token, function(done) {
      if (done) {
        self._firebase = ref;
        self._userid = localStorage.getItem("userid");
        self._mainUser = ref.child("users").child(self._userid);
        self._displayName = localStorage.getItem("displayName");

        ref.child("people").child(self._userid).set({
          displayName: self._displayName,
          presence: "online"
        });
        onComplete(false, self._displayName);
      } else {
        onComplete(new Error("Could not auth to Firebase"), false);
      }
    });
  }
};

/**
 * Logout the current user. The object may be reused after a logout, but only
 * after a successful login() has been performed.
 */
Firefeed.prototype.logout = function() {
  // Reset all keys and other user info.
  localStorage.clear();

  // Set presence to offline, reset all instance variables, and return!
  this._firebase.unauth();
  this._firebase.child("people").child(this._userid).set("offline");

  this._userid = null;
  this._mainUser = null;
  this._firebase = null;
  this._displayName = null;
};

/**
 * Follow a particular user, on behalf of the user who is currently logged in.
 * The provided callback will be called with (err, done) where "err" will be
 * false if the follow operation succeeded.
 *
 * @param    {string}    user        The user to follow.
 * @param    {Function}  onComplete  The callback to call when follow is done.
 */
Firefeed.prototype.follow = function(user, onComplete) {
  var self = this;
  self._validateString(user, "user");
  self._validateCallback(onComplete);

  // First, we add the user to the "following" list of the current user.
  self._mainUser.child("following").child(user).set(true, function(done) {
    if (!done) {
      onComplete(new Error("Could not follow user"), false);
      return;
    }

    // Then, we add the current user to the folowers list of user just followed.
    var followUser = self._firebase.child("users").child(user);
    followUser.child("followers").child(self._userid).set(true);

    // Last, we copy all previous sparks generated by the user just followed
    // to the stream of the current user so they will be displayed.
    // NOTE: this will result in the onNewSpark callback being called, so
    // as soon as a follow is complete, sparks will instantly appear!
    var myStream = self._mainUser.child("stream");
    followUser.child("sparks").once("value", function(sparkSnap) {
      sparkSnap.forEach(function(spark) {
        myStream.child(spark.name()).set(true);
      });
    });

    // All done!
    onComplete(false, user);
  });
};

/**
 * Post a spark as the current user. The provided callback will be called with
 * (err, done) where "err" will be false if the post succeeded, and done will
 * be set to the ID of the spark just posted.
 *
 * @param    {string}    content     The content of the spark in text form.
 * @param    {Function}  onComplete  The callback to call when the post is done.
 */
Firefeed.prototype.post = function(content, onComplete) {
  var self = this;
  self._validateString(content, "spark");
  self._validateCallback(onComplete);
  
  // First, we add the spark to the global sparks list. push() ensures that
  // we get a unique ID for the spark that is chronologically ordered.
  var sparkRef = self._firebase.child("sparks").push();
  var sparkRefId = sparkRef.name();

  var spark = {
    author: self._userid, displayName: self._displayName, content: content
  };

  sparkRef.set(spark, function(done) {
    if (!done) {
      onComplete(new Error("Could not post spark"), false);
      return;
    }

    // Now we add a "reference" to the spark we just pushed, by adding it to
    // the sparks list for the current user.
    var streamSparkRef = self._mainUser.child("sparks").child(sparkRefId);
    streamSparkRef.set(true, function(done) {
      if (!done) {
        onComplete(new Error("Could not add spark to stream"), false);
        return;
      }

      // Then, we add the spark ID to the users own stream.
      self._mainUser.child("stream").child(sparkRefId).set(true);

      // Finally, we add the spark ID to the stream of everyone who follows
      // the current user. This "fan-out" approach scales well!
      self._mainUser.child("followers").once("value", function(followerList) {
        followerList.forEach(function(follower) {
          if (!follower.val()) {
            return;
          }
          var childRef = self._firebase.child("users").child(follower.name());
          childRef.child("stream").child(sparkRefId).set(true);
        });
      });

      // All done!
      onComplete(false, sparkRefId);
    });
  });
};

/**
 * Register a callback to be notified when a new "suggested" user to follow
 * is added to the site. Currently, a suggested user is any user that isn't
 * the current user or someone the current user doesn't follow. As the site
 * grows, this can be evolved in a number of different ways.
 *
 * @param    {Function}  onComplete  The callback to call whenever a new
 *                                   suggested user appears. The function is
 *                                   invoked with two arguments, the user ID
 *                                   and the display name of the user.
 */
Firefeed.prototype.onNewSuggestedUser = function(onComplete) {
  var self = this;
  self._validateCallback(onComplete);

  // First, get the current list of users the current user is following,
  // and make sure it is updated as needed.
  var followerList = [];
  var following = self._mainUser.child("following");

  following.on("value", function(followSnap) {
    followerList = Object.keys(followSnap.val() || {});

    // Now, whenever a new user is added to the site, invoke the callback
    // if we decide that they are a suggested user.
    self._firebase.child("people").on("child_added", function(peopleSnap) {
      var userid = peopleSnap.name();
      if (userid == self._userid || followerList.indexOf(userid) >= 0) {
        return;
      }
      onComplete(userid, peopleSnap.val().displayName);
    });
  });
};

/**
 * Register a callback to be notified whenever a new spark appears on the
 * current user's list. This is usually triggered by another user posting a
 * spark (see Firefeed.post), which will appear in real-time on the current
 * user's feed!
 *
 * We'll limit the number of sparks to 100, i.e. only invoke the callback
 * for the 100 latest sparks. The callback will also be called for any sparks
 * that are added subsequently.
 *
 * @param    {Function}  onComplete  The callback to call whenever a new spark
 *                                   appears on the current user's stream. The
 *                                   function will be invoked with two
 *                                   arguments
 *                                   the first of which is the spark ID and
 *                                   the second an object containing the
 *                                   "author" and "content" properties.
 */
Firefeed.prototype.onNewSpark = function(onComplete) {
  var self = this;
  self._validateCallback(onComplete);

  // We simply listen for new children on the current user's stream.
  self._mainUser.child("stream").limit(100).on("child_added", function(snap) {
    // When a new spark is added, fetch the content from the master spark list
    // since streams only contain references in the form of spark IDs.
    var sparkID = snap.name();
    var sparkRef = self._firebase.child("sparks").child(sparkID);
    sparkRef.on("value", function(sparkSnap) {
      onComplete(sparkSnap.name(), sparkSnap.val());
    });
  });
};
