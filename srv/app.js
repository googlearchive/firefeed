
var firetoken = require("./firetoken.js"),
    express   = require("express"),
    app       = express();

var tokenGenerator = new firetoken("$TOP_SECRET");

app.use(express.bodyParser());
app.use(express.cookieParser("secretz"));

app.use(express.session());

function sendToken(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With");
  res.setHeader("Content-Type", "application/json");
  res.send(200, JSON.stringify({
    user: req.session.user,
    token: req.session.token
  }));
}

app.post("/login", function(req, res) {
  if (req.session.user) {
    sendToken(req, res);
    return;
  }

  if (!req.body.user) {
    res.send(500, "Invalid login request");
    return;
  }

  req.session.regenerate(function() {
    req.session.user = req.body.user;
    req.session.token = tokenGenerator.createToken({userid: req.body.user});
    sendToken(req, res);
  });
});

app.post("/logout", function(req, res) {
  req.session.destroy(function() {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With");
    res.send(200);
  });
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Started server on port " + port);
});
