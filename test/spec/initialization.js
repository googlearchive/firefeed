
describe("Initialization:", function() {
  var firefeed = null;

  it("Constructor", function() {
    firefeed = new Firefeed(BASEURL);
    expect(typeof firefeed).toBe(typeof {});
    expect(firefeed._baseURL).toBe(BASEURL);
  });

  it("Login", function() {
    var flag = false;

    runs(function() {
      makeAndLoginAs(USER, function(ff) {
        expect(ff).toNotBe(null);
        firefeed = ff;
        flag = true;
      });
    });

    waitsFor(function() {
      return flag;
    }, "Login callback should be called", TIMEOUT);
  });

  it("Logout", function() {
    firefeed.logout();
    expect(firefeed._firebase).toBe(null);
    expect(firefeed._userid).toBe(null);
    expect(firefeed._fullName).toBe(null);
    expect(firefeed._name).toBe(null);
    expect(firefeed._mainUser).toBe(null);
    expect(localStorage.getItem("authToken")).toBe(null);
    expect(localStorage.getItem("userid")).toBe(null);
    expect(localStorage.getItem("name")).toBe(null);
    expect(localStorage.getItem("fullName")).toBe(null);
  });
});
