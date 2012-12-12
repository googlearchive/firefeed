
var USER = "jasmine";
var USER2 = "jasmine2";

var TIMEOUT = 1000;
var AUTHURL = "http://localhost:5000";
var BASEURL = "https://firefeed.firebaseio.com";

// We create a new context so we can auth independently.
var makeAndLoginAs = function(user, cb) {
  var ff = new Firefeed(BASEURL, AUTHURL, true);
  ff.login(user, function(err, done) {
    expect(err).toBe(false);
    expect(done).toBe(user);
    expect(ff._firebase).toNotBe(null);
    cb(ff);
  });
};
