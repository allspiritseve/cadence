#!/usr/bin/env node

require('proof')(3, function (async, equal) {
  var fs = require('fs')
    , cadence = require("../../index")()
    , one = async(), two = async()
    ;

  cadence(function () {
    return 1;
  }, function (number) {
    equal(number, 1, "return step");
  })();

  cadence(function (cadence) {
    return 1;
  })(function (error, number) {
    equal(number, 1, "return cadence");
    one();
  });

  cadence(function (cadence) {
    cadence()(null, 1);
  })(function (error, number) {
    equal(number, 1, "callback cadence");
    two();
  });
});
