
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
  this._name = null;
  this._userid = null;
  this._firebase = null;
  this._mainUser = null;
  this._fullName = null;
  
  // Every time we call firebaseRef.on, we need to remember to call .off,
  // when requested by the caller via unload(). We'll store our handlers
  // here so we can clear them later.
  this._handlers = [];

  if (!baseURL || typeof baseURL != "string") {
    throw new Error("Invalid baseURL provided");
  }
  this._firebase = new Firebase(
    baseURL, newContext || false ? new Firebase.Context() : null
  );
}
Firefeed.prototype = {
  _validateCallback: function(cb, notInit) {
    if (!cb || typeof cb != "function") {
      throw new Error("Invalid onComplete callback provided");
    }
    if (!notInit) {
      if (!this._userid || !this._firebase) {
        throw new Error("Method called without a preceding login() call");
      }
    }
  },
  _validateString: function(str, name) {
    if (!str || typeof str != "string") {
      throw new Error("Invalid " + name + " provided");
    }
  },
  _getParameterByName: function(name) {
    var expr = "[?&]" + name + "=([^&]*)"
    var match = RegExp().exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\+/g, " "));
  },
  _getPicURL: function(id, large) {
    return "https://graph.facebook.com/" + (id || this._userid) +
           "/picture/?type=" + (large ? "large" : "square") +
           "&return_ssl_resources=1";
  },
  _onNewSparkForFeed: function(feed, onComplete, onOverflow) {
    var self = this;

    // We listen for new children on the feed.
    var handler = feed.on("child_added", function(snap) {
      // When a new spark is added, fetch the content from the master spark
      // list since feeds only contain references in the form of spark IDs.
      var sparkID = snap.name();
      var sparkRef = self._firebase.child("sparks").child(sparkID);
      var handler = sparkRef.on("value", function(sparkSnap) {
        var ret = sparkSnap.val();
        ret.pic = self._getPicURL(ret.author);
        onComplete(sparkSnap.name(), ret);
      });
      self._handlers.push({
        ref: sparkRef, handler: handler, eventType: "value"
      });
    });
    self._handlers.push({
      ref: feed, handler: handler, eventType: "child_added"
    });

    // Also listen for child_removed so we can call onOverflow appropriately.
    handler = feed.on("child_removed", function(snap) {
      onOverflow(snap.name());
    });
    self._handlers.push({
      ref: feed, handler: handler, eventType: "child_removed"
    });
  }
};

/**
 * Login a given user. The provided callback will be called with (err, info)
 * where "err" will be false if the login succeeded, and "info" is set to
 * an object containing the following fields:
 *
 *    id: User ID
 *    name: A string suitable for greeting the user (usually first name)
 *    pic: URL to a square avatar of the user
 *    location: Location of the user (can be empty)
 *    bio: A brief bio of the user (can be empty)
 * 
 * Some methods on this object may not be called until login() has succeeded,
 * and are noted as such.
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
    // Reuse the token, and auth the Firebase.
    self._firebase.auth(token, function(done) {
      if (done) {
        finish();
      } else {
        onComplete(new Error("Could not auth to Firebase"), false);
      }
    });
    return;
  }

  // No token was found, and silent was set to false. We'll attempt to login
  // the user via the Facebook helper.
  var authClient = new FirebaseAuthClient(self._firebase);
  authClient.login("facebook", function(err, token, info) {
    if (err) {
      onComplete(new Error(err), false);
      return;
    }
    // We got ourselves a token! Persist the info in localStorage for later.
    localStorage.setItem("userid", info.id);
    localStorage.setItem("authToken", token);
    localStorage.setItem("name", info.first_name);
    localStorage.setItem("fullName", info.displayName || info.name);
    finish();
  });

  function finish() {
    self._userid = localStorage.getItem("userid");
    self._mainUser = self._firebase.child("users").child(self._userid);
    self._fullName = localStorage.getItem("fullName");
    self._name = localStorage.getItem("name");

    var peopleRef = self._firebase.child("people").child(self._userid);
    peopleRef.once("value", function(peopleSnap) {
      var retval = {};
      var val = peopleSnap.val();
      if (!val) {
        // First time login, upload details.
        retval = {
          name: self._name, fullName: self._fullName,
          location: "", bio: "", pic: self._getPicURL()
        };
        peopleRef.set(retval);
      } else {
        retval = val;
      }
      peopleRef.child("presence").set("online");
      retval.id = self._userid;
      onComplete(false, retval);
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
  var peopleRef = this._firebase.child("people").child(this._userid);
  peopleRef.child("presence").set("offline");
  this._firebase.unauth();

  this._userid = null;
  this._mainUser = null;
  this._fullName = null;
  this._name = null;
};

/**
 * Get information on a particular user, given a user ID. You do not need
 * to be authenticated to make this call. The onComplete callback will be
 * provided an object as a single argument, containing the same fields as the
 * object returned by login(), except that "pic" will point to the URL of a
 * larger image.
 *
 * onComplete may be called multiple time if user information changes. Make
 * sure to update your DOM accordingly.
 *
 * @param    {string}    user        The user to get information for.
 * @param    {Function}  onComplete  The callback to call with the user info.
 */
Firefeed.prototype.getUserInfo = function(user, onComplete) {
  var self = this;
  self._validateCallback(onComplete, true);
  var ref = self._firebase.child("people").child(user);
  var handler = ref.on("value", function(snap) {
    var val = snap.val();
    val.pic = self._getPicURL(snap.name(), true);
    onComplete(val);
  });
  self._handlers.push({
    ref: ref, handler: handler, eventType: "value"
  });
};

/**
 * Get information on a particular spark, given a spark ID. You do not need
 * to be authenticated to make this call. The onComplete callback will be
 * provided an object as a single argument, containing the same fields as the
 * object returned by onNewSpark().
 *
 * onComplete will be called only once as sparks cannot be modified once they
 * are posted (see rules.json).
 *
 * @param    {string}    id          The spark ID of the spark to be fetched.
 * @param    {Function}  onComplete  The callback to call with the spark.
 */
Firefeed.prototype.getSpark = function(id, onComplete) {
  var self = this;
  self._validateCallback(onComplete, true);
  self._firebase.child("sparks").child(id).once("value", function(snap) {
    onComplete(snap.val());
  });
};

/**
 * Follow a particular user, on behalf of the user who is currently logged in.
 * The provided callback will be called with (err, done) where "err" will be
 * false if the follow operation succeeded. You need to be authenticated
 * through login() to use this function.
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
    // to the feed of the current user so they will be displayed.
    // NOTE: this will result in the onNewSpark callback being called, so
    // as soon as a follow is complete, sparks will instantly appear!
    var myFeed = self._mainUser.child("feed");
    followUser.child("sparks").once("value", function(sparkSnap) {
      sparkSnap.forEach(function(spark) {
        myFeed.child(spark.name()).set(true);
      });
    });

    // All done!
    onComplete(false, user);
  });
};

/**
 * Post a spark as the current user. The provided callback will be called with
 * (err, done) where "err" will be false if the post succeeded, and done will
 * be set to the ID of the spark just posted. You need to be authenticated
 * through login() to use this function.
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
    author: self._userid, 
    by: self._fullName, 
    content: content,
    timestamp: new Date().getTime()
  };

  sparkRef.set(spark, function(done) {
    if (!done) {
      onComplete(new Error("Could not post spark"), false);
      return;
    }

    // Now we add a "reference" to the spark we just pushed, by adding it to
    // the sparks list for the current user.
    var feedSparkRef = self._mainUser.child("sparks").child(sparkRefId);
    feedSparkRef.set(true, function(done) {
      if (!done) {
        onComplete(new Error("Could not add spark to feed"), false);
        return;
      }

      // Then, we add the spark ID to the users own feed.
      self._mainUser.child("feed").child(sparkRefId).set(true);

      // We also add ourself (with priority) to a list of users with recent
      // activity which we can use elsewhere to see "active" users.
      var time = new Date().getTime();
      var recentUsersRef = self._firebase.child("recent-users");
      recentUsersRef.child(self._userid).setWithPriority(true, time);

      // We'll also add the spark to a seperate list of most recent sparks
      // which can be displayed elsewhere, just like active users above.
      var recentSparkRef = self._firebase.child("recent-sparks");
      recentSparkRef.child(sparkRefId).setWithPriority(true, time);

      // Finally, we add the spark ID to the feed of everyone who follows
      // the current user.
      self._mainUser.child("followers").once("value", function(followerList) {
        followerList.forEach(function(follower) {
          if (!follower.val()) {
            return;
          }
          var childRef = self._firebase.child("users").child(follower.name());
          childRef.child("feed").child(sparkRefId).set(true);
        });
      });

      // All done!
      onComplete(false, sparkRefId);
    });
  });
};

/**
 * Get a set of "suggested" users to follow.  For now this is just a list of 5
 * users with recent activity, who you aren't already following.  As the site
 * grows, this can be evolved in a number of different ways.
 *
 * The callback is invoked with two arguments, first the userid, and second
 * an object, containing the same fields as the info object returned by login
 * i.e. (name, pic, location, bio).
 *
 * You need to be authenticated through login() to use this function.
 *
 * @param    {Function}  onSuggestedUser  The callback to call for each
 *                                        suggested user.
 */
Firefeed.prototype.getSuggestedUsers = function(onSuggestedUser) {
  var self = this;
  self._validateCallback(onSuggestedUser);

  // First, get the current list of users the current user is following,
  // and make sure it is updated as needed.
  var followerList = [];
  self._mainUser.child("following").once("value", function(followSnap) {
    followerList = [];
    var snap = followSnap.val() || {};
    for (var k in snap) {
      if (snap.hasOwnProperty(k)) {
        followerList.push(k);
      }
    }

    // We limit to 20 to try to ensure that there are at least 5 you aren't
    // already following.
    var recentUsersQuery = self._firebase.child("recent-users").limit(20);
    var count = 0;
    
    var recentUsersRef = self._firebase.child("recent-users");
    recentUsersRef.once("value", function(recentUsersSnap) {
      recentUsersSnap.forEach(function(recentUserSnap) {
        if (count >= 5) {
          return true; // Stop enumerating.
        }
        var userid = recentUserSnap.name();
        if (userid == self._userid || followerList.indexOf(userid) >= 0) {
          return; // Skip this one.
        }
        count++;
        // Now look up their user info and call the onComplete callback.
        self.getUserInfo(userid, function(userInfo) {
          onSuggestedUser(userid, userInfo);
        });
      });
    });
  });
};

/**
 * Set one of our profile fields (e.g. bio, location, etc.)
 *
 * @param    {string}    field       The name of the field (e.g. 'bio').
 * @param    {Object}    value       The new value to write.
 */
Firefeed.prototype.setProfileField = function(field, value) {
  var peopleRef = this._firebase.child("people").child(this._userid);
  peopleRef.child(field).set(value);
};

/**
 * Register a callback to be notified whenever a new spark appears on a user's
 * feed. This is usually triggered by another user posting a spark (see
 * Firefeed.post), which will appear in real-time on the feeds of all their
 * followers.
 *
 * You can limit the number of sparks that you'll get by passing a number as
 * the first argument. The onComplete callback will called only for the 100
 * latest sparks. The callback will also be called for any sparks that are
 * added subsequently, but if the total number of sparks exceeds the number
 * provided, the onOverflow callback will be called to compensate.
 *
 * To hook this up to the DOM, simply display a spark in your onComplete
 * callback, but also remove the spark in the onOverflow callback. This will
 * ensure that the total number of sparks displayed on your page will never
 * exceed the number specified.
 *
 * If you are authenticated through the login() call, you may omit the user ID
 * and a feed will be provided for the currently logged in user.
 *
 * @param    {number}    total       The maximum number of sparks to report.
 *                                   If new sparks are added after this event
 *                                   handler is set, they will also be reported
 *                                   but the onOverflow callback will be
 *                                   invoked with the oldest sparks to
 *                                   compensate. Defaults to 10.
 *
 * @param    {Function}  onComplete  The callback to call whenever a new spark
 *                                   appears on the current user's feed. The
 *                                   function will be invoked with two
 *                                   arguments, the first of which is the spark
 *                                   ID and the second an object containing the
 *                                   "author", "by", "pic" and "content"
 *                                   properties.
 *
 * @param    {Function}  onOverflow  The callback that will be called when
 *                                   onComplete has already been called
 *                                   num times, to keep the total number
 *                                   of reported sparks capped at num.
 *                                   This will be called with one argument,
 *                                   the spark ID of the spark expected to
 *                                   removed (the oldest spark).
 *
 * @param    {string}    id          Optional if authenticated by login().
 *                                   The user from whose feed the sparks must
 *                                   be fetched.
 */
Firefeed.prototype.onNewSpark = function(num, onComplete, onOverflow, id) {
  this._validateCallback(onComplete);
  this._validateCallback(onOverflow);

  var feed;
  if (id) {
    feed = this._firebase.child("users").child(id).child("feed");
  } else if (this._mainUser) {
    feed = this._mainUser.child("feed");
  } else {
    throw new Error("User ID omitted in onNewSpark, but not logged in!");
  }
  this._onNewSparkForFeed(feed.limit(num || 100), onComplete, onOverflow);
};

/**
 * Register a callback to get the latest sparks (default 10) posted by a
 * specified user. The onComplete and onOverflow handlers will be invoked in
 * the same manner as onNewSpark. The user ID argument is optional, and if
 * omitted, the latest 'num' sparks from all users will be reported.
 *
 * You do not need to be authenticated to use this function.
 *
 * @param    {number}    num       The maximum number of sparks to report.
 *                                   Defaults to 10.
 *
 * @param    {Function}  onComplete  The callback to call whenever a new spark
 *                                   is added to the latest set.
 *
 * @param    {Function}  onOverflow  The callback that will be called when
 *                                   a spark needs to be evicted from the
 *                                   latest set.
 *
 * @param    {string}    id          The user whose sparks must be fetched.
 *                                   If omitted, the latest 'num' sparks from
 *                                   all users will be provided.
 */
Firefeed.prototype.onNewSparkFrom = function(num, onComplete, onOverflow, id) {
  this._validateCallback(onComplete, true);
  this._validateCallback(onOverflow, true);

  var feed;
  if (id) {
    feed = this._firebase.child("users").child(id).child("sparks");
  } else {
    feed = this._firebase.child("recent-sparks");
  }
  feed = feed.limit(num || 10);
  this._onNewSparkForFeed(feed, onComplete, onOverflow);
};

/**
 * Unload all event handlers currently registered. You must call this function
 * when you no longer want to receive updates. This is especially important
 * for single page apps, when transistioning between views. It is safe to
 * reuse the Firefeed object after calling this and registering new handlers.
 */
Firefeed.prototype.unload = function() {
  for (var i = 0; i < this._handlers.length; i++) {
    var ref = this._handlers[i].ref;
    var handler = this._handlers[i].handler;
    var eventType = this._handlers[i].eventType;
    ref.off(eventType, handler);
  }
  this._handlers = [];
};
