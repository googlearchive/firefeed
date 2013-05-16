function FirefeedSearch(ref, stem, resultsHandler) {
  this._ref = ref;
  this._term = stem;
  this._stems = this._generateStems(stem);
  this._resultsHandler = resultsHandler;
  this._handles = [];
  this._firstNameResults = [];
  this._lastNameResults = [];
  this._startSearch();
}

FirefeedSearch.prototype = {
  _generateStems: function(stem) {
    stem = stem.substr(0, 3).toLowerCase();
    var stems = [stem];
    for (var i = 0; i < 3; ++i) {
      if (stem.charAt(i) === ' ') {
        stems.push(stem.substr(0, i) + '|' + stem.substr(i + 1, stem.length))
      }
    }
    return stems;
  },
  toTitleCase: function(str) {
    return str.replace(/\w\S*/g, function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  },
  _startSearchForStem: function(stem) {
    var nextChar = String.fromCharCode(stem.charCodeAt(2) + 1);
    // TODO: check valid firebase key here
    var endKey = stem.substr(0, 2) + nextChar;
    var firstNameQuery = this._ref.child('search/firstName').startAt(null, stem).endAt(null, endKey);
    var lastNameQuery = this._ref.child('search/lastName').startAt(null, stem).endAt(null, endKey);

    var self = this;
    var firstNameHandle = firstNameQuery.on('child_added', function(snap) {
      self._onFirstNameResult(snap);
    });
    var lastNameHandle = lastNameQuery.on('child_added', function(snap) {
      self._onLastNameResult(snap);
    });
    return {
      firstName: {query: firstNameQuery, handle: firstNameHandle},
      lastName: {query: lastNameQuery, handle: lastNameHandle}
    }
  },
  _onFirstNameResult: function(resultSnap) {
    var result = {
      userId: resultSnap.val()
    };
    var name = resultSnap.name().split('|').slice(0, 2).join(' ');
    result['name'] = this.toTitleCase(name);
    this._firstNameResults.push(result);
    this._raiseFilteredResults();
  },
  _onLastNameResult: function(resultSnap) {
    var result = {
      userId: resultSnap.val()
    };
    var name = resultSnap.name().split('|').slice(0, 2).join(', ');
    result['name'] = this.toTitleCase(name);
    this._lastNameResults.push(result);
    this._raiseFilteredResults();
  },
  _startSearch: function() {
    for (var i = 0; i < this._stems.length; ++i) {
      this._handles.push(this._startSearchForStem(this._stems[i]));
    }
  },
  _raiseFilteredResults: function() {
    var results = [];
    for (var i = 0; i < this._firstNameResults.length; ++i) {
      var result = this._firstNameResults[i];
      if (result.name.substr(0, this._term.length).toLowerCase() === this._term) {
        results.push(result);
      }
    }
    for (i = 0; i < this._lastNameResults.length; ++i) {
      result = this._lastNameResults[i];
      if (result.name.substr(0, this._term.length).toLowerCase() === this._term) {
        results.push(result);
      }
    }
    this._resultsHandler(results);
  }
};

FirefeedSearch.prototype.containsTerm = function(term) {
  if (term.length < 3) {
    return false;
  } else {
    var prefix = term.substr(0, 3);
    for (var i = 0; i < this._stems.length; ++i) {
      if (prefix === this._stems[i]) {
        return true;
      }
    }
    return false;
  }
};

FirefeedSearch.prototype.updateTerm = function(term) {
  this._term = term;
  this._raiseFilteredResults();
};

FirefeedSearch.prototype.stopSearch = function() {
  for (var i = 0; i < this._handles.length; ++i) {
    var handle = this._handles[i];
    handle.firstName.query.off('child_added', handle.firstName.handle);
    handle.lastName.query.off('child_added', handle.lastName.handle);
  }
};