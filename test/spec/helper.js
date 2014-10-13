
var USER = "jasmine";
var USER2 = "jasmine2";

var TIMEOUT = 1000;
var BASEURL = "https://firefeed-staging.firebaseio.com";

// Replace $TOP_SECRET with the secret for BASEURL.
var tokenGenerator = new FirebaseTokenGenerator('uTZgdJmwpcPqHtxqZ0gpNvqaODY2ELUYyGBfh3rb');

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

var helpers = {

  tokenGenerator: new FirebaseTokenGenerator('uTZgdJmwpcPqHtxqZ0gpNvqaODY2ELUYyGBfh3rb'),

  BASEURL: 'https://firefeed-staging.firebaseio.com',

  userOne: {
    id: 1,
    facebook: {
      displayName: 'David East',
      id: 100
    }
  },

  userTwo: {
    id: 2,
    facebook: {
      displayName: 'Kato Wulf',
      id: 200
    }
  },

  createFeed: function(params) {
    return new Firefeed(this.BASEURL);
  },
  setUserToLocalStorage: function(user, token) {
    localStorage.clear();
    localStorage.setItem('authToken', token);
    localStorage.setItem('userid', user);
    localStorage.setItem('name', user);
    localStorage.setItem('fullName', user);
  },
  createUserToken: function(user) {
    return this.tokenGenerator.createToken({id: user});
  },
  authenticate: function(feed, user, cb) {
    debugger;
    var token = this.createUserToken(user);
    this.setUserToLocalStorage(user, token);
    feed._firebase.authWithCustomToken(token, cb.bind(feed));
  }
};

