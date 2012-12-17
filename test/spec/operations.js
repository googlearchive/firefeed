
describe("Operations:", function() {
  var spark1Id = null;
  var spark2Id = null;
  var firefeed1 = null;
  var firefeed2 = null;
  var content1 = "test spark I"
  var content2 = "test spark II";

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

  it("Post without follower", function() {
    var flag2 = false;

    runs(function() {
      firefeed2.post(content1, function(err, done) {
        expect(err).toBe(false);
        expect(typeof done).toBe("string");
        spark1Id = done;
        flag2 = true;
      });
    });

    waitsFor(function() {
      return flag2;
    }, "Waiting for post to complete", TIMEOUT);
  });

  it("User followed", function() {
    var flag3 = false;

    runs(function() {
      firefeed1.follow(USER2, function(err, done) {
        expect(err).toBe(false);
        expect(done).toBe(USER2);
        expect(firefeed1._mainUser).toNotBe(null);
        flag3 = true;
      });
    });

    waitsFor(function() {
      return flag3;
    }, "Waiting for follow callback", TIMEOUT);
  });

  it("Previous spark copied", function() {
    // Check that the previous spark of the user just followed was copied.
    var flag4 = false;

    runs(function() {
      var stream = firefeed1._mainUser.child("stream");
      stream.once("value", function(snap) {
        snap.forEach(function(sparkSnap) {
          if (sparkSnap.name() == spark1Id) {
            flag4 = true;
          }
        });
      });
    });

    waitsFor(function() {
      return flag4;
    }, "Waiting for spark copy callback", TIMEOUT);
  });

  it("User in following list", function() {
    // Check that the user just followed is in the following list.
    var flag5 = false;

    runs(function() {
      var ref = firefeed1._mainUser.child("following").child(USER2);
      ref.once("value", function(snapshot) {
        expect(snapshot.val() === true);
        flag5 = true;
      });
    });

    waitsFor(function() {
      return flag5;
    }, "Waiting for user to added in following list", TIMEOUT);
  });

  it("User in follower list", function() {
    // Check that USER2 has USER in the follower list.
    var flag6 = false;

    runs(function() {
      var ref = firefeed2._firebase.child("users").child(USER2);
      ref.child("followers").once("value", function(snapshot) {
        expect(snapshot.val() === true);
        flag6 = true;
      });
    });

    waitsFor(function() {
      return flag6;
    }, "Waiting for user to be added in follower list", TIMEOUT);
  });

  it("Post in global list", function() {
    var flag7 = false;

    // Check that the spark appears in the global list.
    runs(function() {
      firefeed2._firebase.child("sparks").once("child_added", function(snap) {
        var spark = snap.val();
        expect(spark.author).toBe(USER2);
        expect(spark.content).toBe(content2);
        spark2Id = snap.name();
        flag7 = true;
      });
      firefeed2.post(content2, function(err, done) {
        expect(err).toBe(false);
        expect(typeof done).toBe("string");
      });
    });

    waitsFor(function() {
      return flag7;
    }, "Waiting for spark to appear in global list", TIMEOUT);
  });

  it("Post in user list", function() {
    // Check that the spark appears in the user's spark list.
    var flag8 = false;

    runs(function() {
      var ref = firefeed2._firebase.child("sparks").child(spark2Id);
      ref.once("value", function(snap) {
        var spark = snap.val();
        expect(snap.name()).toBe(spark2Id);
        expect(spark.author).toBe(USER2);
        expect(spark.content).toBe(content2);
        flag8 = true;
      });
    });

    waitsFor(function() {
      return flag8;
    }, "Waiting for spark to appear in user list", TIMEOUT);
  });

  it("Post in follower stream", function() { 
    // Check that the spark appeared in a follower's stream.
    var flag9 = false;

    runs(function() {
      var ref = firefeed1._mainUser.child("stream").child(spark2Id);
      ref.once("value", function(snap) {
        expect(snap.name()).toBe(spark2Id);
        expect(snap.val()).toBe(true);
        flag9 = true;
      });
    });

    waitsFor(function() {
      return flag9;
    }, "Waiting for spark to appear in follower stream", TIMEOUT);
  });
});
