
describe("Initialization:", function() {
  var firefeed = null;

  beforeEach(function() {
    firefeed = helpers.createFeed();
  });

  afterEach(function() {
    firefeed.unload();
    firefeed = null;
  });

  it("Constructor", function() {
    expect(typeof firefeed).toBe(typeof {});
    expect(firefeed._baseURL).toBe(BASEURL);
  });

  it("Login", function() {
    spyOn(firefeed._firebase, 'authWithOAuthPopup');
    firefeed.login('facebook');
    expect(firefeed._firebase.authWithOAuthPopup).toHaveBeenCalled();
  });

  it("Logout", function() {
    spyOn(firefeed._firebase, 'unauth');
    firefeed.logout();
    expect(firefeed._firebase.unauth).toHaveBeenCalled();
  });

});
