Firefeed
========
Firefeed is a web app that lets users post small messages called *sparks* to
their feed. You can follow other users, and their sparks will appear on your
feed.

### [Live Demo](http://firefeed.io)

The unique property of this application is that it is built entirely using
client side logic - no server neccessary - other than to serve the static
HTML/CSS/JS files, of course.

This is made possible by [Firebase](http://firebase.com/). A detailed explanation
of how the app was built is [available here](http://firefeed.io/about.html).

Navigating the Code
-------------------
The core application logic is in www/js/firefeed.js. It is hooked up to the
UI in www/index.html via www/js/firefeed-ui.js.
[firefeed.js](http://github.com/firebase/firefeed/blob/master/firefeed.js) consists of 11
public methods, all of which are documented with jsdoc.

If you'd like to embed a feed like Firefeed into your app, we recommend
importing firefeed.js and hooking it up to your own UI. Take a look at
firefeed-ui for an example of how this is done!

### iOS Client

An iOS client is also available. Download the app from the
[App Store](https://itunes.apple.com/us/app/ifirefeed/id645597646?mt=8&uo=4)
and browse the [source](https://github.com/firebase/iFirefeed).

Exercises for the reader
------------------------
1. Implement unfollowing a user.
2. Implement protected accounts. If a user opts into a protected account, their
sparks can only be viewed by people they approve.
3. Implement search based on #hashtags. (Hint: Instead of searching for the
actual value through the global list of sparks, consider creating a new bucket
for every hashtag when it is first used, and then populating it with spark
references).
4. Implement retweets, favorites and @ messages to other users. (Hint: You can sort
the @ messages at creation time for ease of rendering on the consumer side).
5. Implement direct messages. (Hint: Use a mailbox style system between users, and
setup your rules such that you can write to another user's mailbox but not read
from it).

Help
----

Please feel free to [reach out to us](https://groups.google.com/group/firebase-talk)
if you have questions, comments or suggestions!

License
-------
[MIT](http://firebase.mit-license.org).
