/* global use, db */
// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

const database = 'Pinnit';
const collection = 'Events';

// Create a new database.
use(database);

// Create a new collection.
db.createCollection(collection);



db.Events.insertOne({
    "event_id": 1,
    "event_name": "Yoga Drop In: Therapeutic Yoga w/ Amanda",
    "start_time": "12:30",
    "end_time": false,
    "location": "Nest 2301",
    "club": "ubcyogaclub",
    "bio": "Come join UBC yoga for some fun yoga!",
    "reference_link": "www.instagram.com",
    "image_url": "https://instagram.fyvr1-1.fna.fbcdn.net/v/t51.2885-15/21984643_995308220608235_7854693412774084608_n.jpg?stp=dst-jpg_e35&_nc_ht=instagram.fyvr1-1.fna.fbcdn.net&_nc_cat=111&_nc_ohc=WZP0jekEo1IQ7kNvgEWWmwt&edm=AGenrX8BAAAA&ccb=7-5&oh=00_AYC8trUokSFDm0T2POPnrtAxbUjbg96rw_lFWWHoYqRNtg&oe=66491A2D&_nc_sid=ed990e"

  });

// The prototype form to create a collection:
/* db.createCollection( <name>,
  {
    capped: <boolean>,
    autoIndexId: <boolean>,
    size: <number>,
    max: <number>,
    storageEngine: <document>,
    validator: <document>,
    validationLevel: <string>,
    validationAction: <string>,
    indexOptionDefaults: <document>,
    viewOn: <string>,
    pipeline: <pipeline>,
    collation: <document>,
    writeConcern: <document>,
    timeseries: { // Added in MongoDB 5.0
      timeField: <string>, // required for time series collections
      metaField: <string>,
      granularity: <string>,
      bucketMaxSpanSeconds: <number>, // Added in MongoDB 6.3
      bucketRoundingSeconds: <number>, // Added in MongoDB 6.3
    },
    expireAfterSeconds: <number>,
    clusteredIndex: <document>, // Added in MongoDB 5.3
  }
)*/

// More information on the `createCollection` command can be found at:
// https://www.mongodb.com/docs/manual/reference/method/db.createCollection/
