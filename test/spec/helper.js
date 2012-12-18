
var USER = "jasmine";
var USER2 = "jasmine2";

var TIMEOUT = 1000;
var BASEURL = "https://firefeed.firebaseio-staging.com";

// Replace $TOP_SECRET with the secret for BASEURL.
var tokenGenerator = new FirebaseTokenGenerator("$TOP_SECRET");

// We create a new context so we can auth independently.
var makeAndLoginAs = function(user, cb) {
  var ff = new Firefeed(BASEURL, true);

  // Use the token generator to make a token. Never do this in a real web app!
  var token = tokenGenerator.createToken({id: user});

  // Set in localStorage and login.
  localStorage.clear();
  localStorage.setItem("authToken", token);
  localStorage.setItem("userid", user);
  localStorage.setItem("name", user);
  localStorage.setItem("fullName", user);

  ff.login(true, function(err, info) {
    expect(err).toBe(false);
    expect(info.name).toBe(user);
    expect(info.bio).toBe(" ");
    expect(info.location).toBe(" ");
    expect(typeof info.pic).toBe(typeof "");
    expect(ff._firebase).toNotBe(null);
    cb(ff);
  });
};
