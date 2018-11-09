var express = require('express');
var dataSource = require("./quakes-eruptions-data-source")
var routes = require('./routes/routes');

const app = express();

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

require('./routes/routes.js')(app, dataSource);

function main() {
    var initializePromise = dataSource.initialize();
    initializePromise.then(function () {
        console.log("Initialized data");
        var quakeJson = dataSource.getQuakes();
        var erupJson =dataSource.getEruptions()
        var quakeSample = JSON.stringify(quakeJson[0]).replace(/\\u0000/gi, '');
        var erupSample = JSON.stringify(erupJson[0]).replace(/\\u0000/gi, '');
        console.log('\nEarthquake sample:\n' + quakeSample);
        console.log('\nEruption sample:\n' + erupSample + '\n');
        dataSource.saveAllData(quakeJson, 'earthquakes.json');
        dataSource.saveAllData(erupJson, 'eruptions.json');
        initialized = true;
    }, function (err) {
        console.log(err);
    })
}

main();

var server = app.listen(4000, () => {

});

console.log("Server running on http://127.0.0.1:4000");
console.log("Working directory: " + __dirname);
console.log("Running application from file: " + __filename);

var runTime = 0;
var timer = setInterval(function () {
    runTime += 100;
    console.log("Server has been running for " + runTime + " seconds")
    if (runTime === 360000) {
        console.log("Shutting down server...")
        clearInterval(timer);
        server.close();
    }
}, 100000)