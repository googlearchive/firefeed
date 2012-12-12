
var USER = "test";
var TIMEOUT = 1000;
var AUTHURL = "http://localhost:5000";
var BASEURL = "https://firefeed.firebaseio.com";

describe("Initialization & Teardown", function() {
  var firefeed;

  beforeEach(function() {
    firefeed = new Firefeed(BASEURL, AUTHURL);
  });

  it("Constructor", function() {
    expect(typeof firefeed).toBe(typeof {});
    expect(firefeed._baseURL).toBe(BASEURL);
    expect(firefeed._authURL).toBe(AUTHURL);
  });

  it("Login", function() {
    var flag = false;

    runs(function() {
      firefeed.login(USER, function(err, done) {
        expect(err).toBe(false);
        expect(done).toBe(USER);
        expect(firefeed._user).toBe(USER);
        expect(firefeed._firebase).toNotBe(null);
        flag = true;
      });
    });

    waitsFor(function() {
      return flag;
    }, "Login callback should be called", TIMEOUT);
  });

  it("Logout", function() {
    var flag  = false;

    runs(function() {
      firefeed.login(USER, function() {
        firefeed.logout(function(err, done) {
          expect(err).toBe(false);
          expect(done).toBe(true);
          expect(firefeed._firebase).toBe(null);
          expect(firefeed._user).toBe(null);
          flag = true;
        });
      });
    });

    waitsFor(function() {
      return flag;
    }, "Logout callback should be called", TIMEOUT);
  });
});
