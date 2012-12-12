
describe("Operations", function() {
  var firefeed1 = null;
  var firefeed2 = null;

  beforeEach(function() {
    var flag = false;
    firefeed1 = new Firefeed(BASEURL, AUTHURL);
    firefeed2 = new Firefeed(BASEURL, AUTHURL);
    runs(function() {
      firefeed1.login(USER, function(err, done) {
        expect(err).toBe(false);
        expect(done).toBe(USER);
        //firefeed2.login(USER2, function(err, done) {
        //  expect(err).toBe(false);
        //  expect(done).toBe(USER2);
          flag = true;
        //});
      });
    });
    waitsFor(function() {
      return flag;
    }, "Initializing Firefeed with two logins", TIMEOUT * 2);
  });

  it("Follow", function() {
    var flag = false;
    expect(firefeed1._firebase).toNotBe(null);

    runs(function() {
      firefeed1.follow(USER2, function(err, done) {
        expect(err).toBe(false);
        expect(done).toBe(USER2);
        expect(firefeed1._mainUser).toNotBe(null);
        flag = true;
      });
    });

    waitsFor(function() {
      return flag;
    }, "Waiting for follow callback", TIMEOUT);

    /*
    // Check that the user just followed is in the following list.
    flag = false;
    runs(function() {
      var ref = firefeed1._mainUser.child("following").child(USER2);
      ref.once("value", function(snapshot) {
        expect(snapshot.val() === true);
        flag = true;
      });
    });

    waitsFor(function() {
      return flag;
    }, "Waiting for following add check", TIMEOUT);

    // Check that USER2 has the original user in the follower list.
    flag = false;
    runs(function() {
      var ref = firefeed1._firebase.child("users").child(USER2);
      ref.child("followers").once("value", function(snapshot) {
        expect(snapshot.val() === true);
        flag = true;
      });
    });


    waitsFor(function() {
      return flag;
    }, "Waiting for follower add check", TIMEOUT);*/
  });
});
