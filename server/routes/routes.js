module.exports = function (app, dataSource) {

    app.get('/', (req, res) => {
        if (!initialized) {
            var body = 'Loading data please refresh the page in a couple of moments';
            res.send(body);
        } else {

            var quakeData = JSON.stringify(dataSource.getQuakes());
            var body = quakeData.replace(/\\u0000/gi, '');

            res.send(body);
        }
    });

    app.route('/eruptions/:year').get((req, res) => {
        const requestedYear = req.params['year'];
        var result;
        dataSource.getEruptions().forEach(element => {
            if (element.Year === requestedYear) {
                result = JSON.stringify(element).replace(/\\u0000/gi, '');
                ;
            }
        });
        res.send( result );
    });

    app.route('/quakes/:place').get((req, res) => {
        const place = req.params['place'];
        var result;
        dataSource.getQuakes().forEach(element => {
            if (element.place) {
                if (element.place.toString().includes(place)) {
                    result = JSON.stringify(element).replace(/\\u0000/gi, '');
                    ;
                }
            }
        });
        res.send( result );
    });

    app.route('/geojson/quakes/').get((req, res) => {        
        var result;
        result = dataSource.toGeoJson(dataSource.getQuakes());
        res.send( result );
        dataSource.saveAllData(result, 'test.geojson');
    });
};