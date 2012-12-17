
describe("Events:", function() {
  var firefeed1 = null;
  var firefeed2 = null;

  beforeEach(function() {
    var flag = false;

    runs(function() {
      makeAndLoginAs(USER, function(ff1) {
        firefeed1 = ff1;
        makeAndLoginAs(USER2, function(ff2) {
          firefeed2 = ff2;
          flag = true;
        });
      });
    });

    waitsFor(function() {
      return flag;
    }, "Initializing Firefeed with two logins", TIMEOUT * 2);
  });

  it("Suggested User", function() {
    // Check if USER is a suggested user for USER2.
    var flag = false;

    runs(function() {
      firefeed2.onNewSuggestedUser(function(user) {
        expect(user).toBe(USER);
        flag = true;
      });
    });

    waitsFor(function() {
      return flag;
    }, "Waiting for suggested user callback", TIMEOUT);
  });

  it("New spark", function() {
    // Post a spark on USER2 and see if it appears for USER.
    var flag = false;
    var sparkId = null;
    var content = "this is another sample spark";

    runs(function() {
      firefeed2.post(content, function(err, done) {
        expect(err).toBe(false);
        expect(typeof done).toBe("string");
        sparkId = done;
        firefeed1.onNewSpark(function(id, spark) {
          if (id != sparkId) {
            return;
          }
          expect(spark.author).toBe(USER2);
          expect(spark.by).toBe(USER2);
          expect(spark.content).toBe(content);
          flag = true;
        });
      });
    });

    waitsFor(function() {
      return flag;
    }, "Waiting for new spark to appear", TIMEOUT);
  });
});
