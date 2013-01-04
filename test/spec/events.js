
describe("Events:", function() {
  var firefeed1 = null;
  var firefeed2 = null;

  beforeEach(function() {
    var flag1 = false;

    runs(function() {
      makeAndLoginAs(USER, function(ff1) {
        firefeed1 = ff1;
        makeAndLoginAs(USER2, function(ff2) {
          firefeed2 = ff2;
          flag1 = true;
        });
      });
    });

    waitsFor(function() {
      return flag1;
    }, "Initializing Firefeed with two logins", TIMEOUT * 2);
  });

  it("Suggested User", function() {
    // Check if USER is a suggested user for USER2.
    var flag2 = false;

    runs(function() {
      firefeed2.getSuggestedUsers(function(id, user) {
        expect(id).toBe(USER);
        expect(user.name).toBe(USER);
        expect(user.fullName).toBe(USER);
        expect(typeof user.pic).toBe("string");
        flag2 = true;
      });
    });

    waitsFor(function() {
      return flag2;
    }, "Waiting for suggested user callback", TIMEOUT);
  });

  it("New spark", function() {
    // Post a spark on USER2 and see if it appears for USER.
    var flag3 = false;
    var sparkId = null;
    var content = "this is another sample spark";

    runs(function() {
      firefeed2.post(content, function(err, done) {
        expect(err).toBe(false);
        expect(typeof done).toBe("string");
        sparkId = done;
        firefeed1.onNewSpark(null, function(spark) {
          if (spark.id != sparkId) {
            return;
          }
          spark.onValue = function(val) {
            expect(val.author).toBe(USER2);
            expect(val.by).toBe(USER2);
            expect(val.content).toBe(content);
            flag3 = true;
          }
        }, function() {});
      });
    });

    waitsFor(function() {
      return flag3;
    }, "Waiting for new spark to appear", TIMEOUT);
  });
});
