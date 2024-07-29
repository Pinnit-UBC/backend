const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const AWS = require('aws-sdk');
const fs = require('fs');
const dayjs = require('dayjs');
const axios = require('axios');
const app = express();
const PORT = 3001;
require('dotenv').config();

console.log('GOOGLE_MAPS_API_KEY:', process.env.GOOGLE_MAPS_API_KEY);
console.log('MONGO_URI:', process.env.MONGO_URI);

// MongoDB connection URL
const mongoURI = process.env.MONGO_URI;

// Connect to MongoDB
mongoose.connect(mongoURI);
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected successfully to MongoDB');
});

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors());

// AWS S3 configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Appends the file extension
  }
});

const upload = multer({ storage });

// Function to upload file to S3
const uploadFileToS3 = async (filePath, fileName) => {
  const fileContent = fs.readFileSync(filePath);

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
    Body: fileContent,
    ContentType: 'image/png' // adjust this according to the file type
  };

  const uploadResult = await s3.upload(params).promise();
  return uploadResult.Location; // Make sure this is the correct URL
};

// Function to generate a pre-signed URL
const getPreSignedUrl = (key) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Expires: 60 * 60 // URL expires in 1 hour
  };

  return s3.getSignedUrl('getObject', params);
};

// Function to create a model dynamically or return existing model
function getEventModel(eventDate) {
  const eventSchema = new mongoose.Schema({
    event_date: String,
    event_title: String,
    host_organization: String,
    start_time: String,
    end_time: { type: String, default: null },
    location: String,
    activity_description: String,
    registration_status: String,
    reference_link: String,
    image_url: String, // Ensure this field is included in the schema
    latitude: Number,
    longitude: Number,
    Address: String,
  });

  // Add an index on the start_time field for efficient sorting
  eventSchema.index({ start_time: 1 });

  const modelName = `Event_${eventDate.replace(/-/g, '_')}`;
  return mongoose.models[modelName] || mongoose.model(modelName, eventSchema, modelName);
}

// Define the SponsoredEvent model
const sponsoredEventSchema = new mongoose.Schema({
  event_date: String,
  event_title: String,
  host_organization: String,
  start_time: String,
  end_time: { type: String, default: null },
  location: String,
  activity_description: String,
  registration_status: String,
  reference_link: String,
  image_url: String,
  latitude: Number,
  longitude: Number,
  Address: String,
});

const SponsoredEvent = mongoose.model('SponsoredEvent', sponsoredEventSchema, 'sponsored_event'); // Explicitly use the collection name

// Define the keys schema and model
const KeySchema = new mongoose.Schema({}, { strict: false });
const Key = mongoose.model('Key', KeySchema);

// Route to verify the pass key
app.post('/verify-key', async (req, res) => {
  const { user_id, pass_key } = req.body;

  try {
    const keyDocument = await Key.findOne({ [user_id]: pass_key }).exec();
    if (keyDocument) {
      res.json({ valid: true });
    } else {
      res.json({ valid: false });
    }
  } catch (err) {
    console.error('Error verifying key:', err);
    res.status(500).json({ valid: false, error: err.message });
  }
});

// Route to add an event
app.post('/add-event', upload.single('image'), async (req, res) => {
  try {
    console.log('Request body:', req.body); // Log the request body

    const { event_date, host_organization, latitude, longitude } = req.body;
    const imageFilePath = req.file.path;
    const imageName = req.file.filename;

    const s3UploadResult = await uploadFileToS3(imageFilePath, imageName);
    const image_url = s3UploadResult; // URL of the uploaded image in S3

    console.log('Event Date:', event_date);
    console.log('Host/Organization:', host_organization);
    console.log('Image URL:', image_url); // Log the image URL
    console.log('Latitude:', latitude);
    console.log('Longitude:', longitude);

    const Event = getEventModel(event_date);

    const newEvent = new Event({
      ...req.body,
      image_url,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
    });

    const savedEvent = await newEvent.save();
    console.log('Event saved:', savedEvent);

    // Delete the file from the local server after uploading to S3
    fs.unlink(imageFilePath, (err) => {
      if (err) {
        console.error('Failed to delete local file:', err);
      } else {
        console.log('Local file deleted successfully');
      }
    });

    res.status(201).json(savedEvent);
  } catch (err) {
    console.error('Error adding event:', err);
    res.status(400).json({ message: 'Error adding event', error: err.message });
  }
});

// Route to get events for a specific date or the current date by default
app.get('/events', async (req, res) => {
  const date = req.query.date || dayjs().format('YYYY-MM-DD');
  const eventDate = date.replace(/-/g, '_');

  try {
    console.log(`Fetching events for date: ${date}`);
    const Event = getEventModel(date);
    const events = await Event.find().sort({ start_time: 1 });

    // Add pre-signed URLs to the events
    const eventsWithUrls = events.map(event => {
      if (event.image_url) {
        event.image_url = getPreSignedUrl(path.basename(event.image_url));
      }
      return event;
    });

    console.log(`Fetched events for ${date}:`, eventsWithUrls);
    res.json(eventsWithUrls);
  } catch (err) {
    console.error(`Error fetching events for ${date}:`, err);
    res.status(500).json({ message: 'Error fetching events', error: err.message });
  }
});

// Route to get sponsored events for a specific date or the current date by default
app.get('/sponsored_event', async (req, res) => {
  const date = req.query.date || dayjs().format('YYYY-MM-DD');

  try {
    console.log(`Received request for sponsored event on date: ${date}`);
    const sponsoredEvent = await SponsoredEvent.findOne({ event_date: date });

    if (sponsoredEvent) {
      console.log(`Found sponsored event: ${JSON.stringify(sponsoredEvent)}`);
      if (sponsoredEvent.image_url) {
        sponsoredEvent.image_url = getPreSignedUrl(path.basename(sponsoredEvent.image_url));
      }
    } else {
      console.log(`No sponsored event found for this date.`);
    }

    res.json(sponsoredEvent);
  } catch (err) {
    console.error(`Error fetching sponsored event for ${date}:`, err);
    res.status(500).json({ message: 'Error fetching sponsored event', error: err.message });
  }
});

// Route to handle subscription
app.post('/subscribe', async (req, res) => {
  const { name, email } = req.body;
  const listId = 'db921483ac'; // Replace with your Mailchimp list ID
  const apiKey = 'de8b05dbb0058b6d83e41325add7cf3e-us22';
  const serverPrefix = apiKey.split('-')[1];

  const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members`;

  try {
    const response = await axios.post(
      url,
      {
        email_address: email,
        status: 'subscribed',
        merge_fields: {
          FNAME: name.split(' ')[0],
          LNAME: name.split(' ').slice(1).join(' '),
        },
      },
      {
        headers: {
          Authorization: `apikey ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 200 || response.status === 201) {
      res.status(200).json({ message: 'Subscribed successfully!' });
    } else {
      res.status(response.status).json({ message: 'Failed to subscribe.' });
    }
  } catch (error) {
    console.error('Error subscribing:', error.response ? error.response.data : error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Proxy route to fetch image
app.get('/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  try {
    const response = await axios({
      url: imageUrl,
      responseType: 'arraybuffer',
    });
    const buffer = Buffer.from(response.data, 'binary');
    res.setHeader('Content-Type', response.headers['content-type']);
    res.send(buffer);
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).send('Error fetching image');
  }
});

// Serve static files from the uploads directory
app.use('/uploads', express.static('uploads'));

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
