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
console.log('CLOUDFRONT_DOMAIN_NAME:', process.env.CLOUDFRONT_DOMAIN_NAME);

// MongoDB connection URL
const mongoURI = process.env.MONGO_URI;

// Connect to MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected successfully to MongoDB');
});

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors());

// AWS S3 and CloudFront configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN_NAME;
console.log('CloudFront Domain:', cloudFrontDomain);

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Appends the file extension
  },
});

const upload = multer({ storage });

// Function to upload file to S3
const uploadFileToS3 = async (filePath, fileName) => {
  const fileContent = fs.readFileSync(filePath);
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
    Body: fileContent,
    ContentType: 'image/png', // adjust this according to the file type
  };
  await s3.upload(params).promise();

  // Generate CloudFront URL
  const cloudFrontUrl = `https://${cloudFrontDomain}/${fileName}`;
  console.log('Generated CloudFront URL:', cloudFrontUrl);
  return cloudFrontUrl;
};

// Function to generate a CloudFront URL
const getCloudFrontUrl = (key) => {
  return `https://${cloudFrontDomain}/${key}`;
};

// Event schema
const eventSchema = new mongoose.Schema({
  event_date: String, // Format: 'YYYY-MM-DD'
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
  tags: [String], // Add tags array field
  faculty: [String], // Add faculty array field
  degree_level: [String] // Add degree level array field
});

// Add an index on the event_date and start_time fields for efficient querying and sorting
eventSchema.index({ event_date: 1, start_time: 1 });

// Function to get the dynamic event model based on the date
const getEventModel = (date) => {
  const collectionName = `Event_${date.replace(/-/g, '_')}`;
  return mongoose.model(collectionName, eventSchema, collectionName);
};

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

const SponsoredEvent = mongoose.model('SponsoredEvent', sponsoredEventSchema, 'sponsored_event');

// Define the keys schema and model
const KeySchema = new mongoose.Schema({}, { strict: false });
const Key = mongoose.model('Key', KeySchema);

// Define the News schema and model
const newsSchema = new mongoose.Schema({
  title: String,
  content: String,
  date: String, // Field to store the date as a string in "YYYY-MM-DD" format
  created_at: { type: Date, default: Date.now }
});

const News = mongoose.model('News', newsSchema, 'news');

// Route to add news
app.post('/add-news', upload.single('image'), async (req, res) => {
  try {
    const { date, title, content } = req.body;

    const newNews = new News({
      title,
      content,
      date,
    });

    await newNews.save();
    res.status(201).json(newNews);
  } catch (error) {
    console.error('Error adding news:', error);
    res.status(500).json({ error: 'Error adding news' });
  }
});

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
    console.log('Request body:', req.body);

    const { event_date, latitude, longitude, tags, faculty, degree_level } = req.body;
    let image_url = '';

    if (req.file) {
      const cloudFrontUrl = await uploadFileToS3(req.file.path, req.file.filename);
      image_url = cloudFrontUrl;
      fs.unlinkSync(req.file.path); // Remove local file
    }

    // Get the model for the event collection dynamically
    const EventModel = getEventModel(event_date);

    const newEvent = new EventModel({
      ...req.body,
      image_url,
      tags: JSON.parse(tags), // Parse tags back to array
      faculty: JSON.parse(faculty), // Parse faculty back to array
      degree_level: JSON.parse(degree_level), // Parse degree level back to array
      latitude: latitude && latitude !== "null" ? parseFloat(latitude) : null,
      longitude: longitude && longitude !== "null" ? parseFloat(longitude) : null,
    });

    await newEvent.save();
    console.log('Event saved:', newEvent);
    res.status(201).json(newEvent);
  } catch (err) {
    console.error('Error adding event:', err);
    res.status(500).json({ message: 'Error adding event', error: err.message });
  }
});

// Route to get events for a specific date or the current date by default
app.get('/events', async (req, res) => {
  const date = req.query.date || dayjs().format('YYYY-MM-DD');

  try {
    console.log(`Fetching events for date: ${date}`);

    const EventModel = getEventModel(date);

    const events = await EventModel.find({}).sort({ start_time: 1 });

    console.log(`Fetched events for ${date}:`, events);
    res.json(events);
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
        sponsoredEvent.image_url = getCloudFrontUrl(path.basename(sponsoredEvent.image_url));
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

// Route to get news
app.get('/news', async (req, res) => {
  try {
    const newsItems = await News.find().sort({ created_at: -1 }); // Sort by most recent
    res.json(newsItems);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Error fetching news' });
  }
});

// Serve static files from the uploads directory
app.use('/uploads', express.static('uploads'));

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Clubs and Organizations Schema and Routes
const clubsOrganizationsSchema = new mongoose.Schema({
  name: String, // Name of the club/organization
  image: String, // Image URL
});

const ClubOrganization = mongoose.model('ClubOrganization', clubsOrganizationsSchema, 'clubs-organizations');

// Route to get all clubs and organizations
app.get('/clubs-organizations', async (req, res) => {
  try {
    const clubsOrganizations = await ClubOrganization.find().sort({ name: 1 }); // Sort by name
    res.json(clubsOrganizations);
  } catch (error) {
    console.error('Error fetching clubs/organizations:', error);
    res.status(500).json({ error: 'Error fetching clubs/organizations' });
  }
});

// Route to get popular events based on the sponsored events for a specific date
app.get('/popular_events', async (req, res) => {
  const date = req.query.date || dayjs().format('YYYY-MM-DD');

  try {
      const sponsoredEvents = await SponsoredEvent.find({ event_date: date }).exec();
      const eventTitles = sponsoredEvents.map(event => event.event_title);
      
      const EventModel = getEventModel(date);
      const popularEvents = await EventModel.find({ event_title: { $in: eventTitles } }).exec();

      res.json(popularEvents);
  } catch (err) {
      console.error('Error fetching popular events:', err);
      res.status(500).json({ message: 'Error fetching popular events', error: err.message });
  }
});


// Updated route to get all clubs and organizations or filter by faculty from the correct collection
app.get('/clubs-organizations', async (req, res) => {
  try {
    const faculty = req.query.faculty;
    const query = faculty && faculty !== 'All' ? { faculty } : {};
    
    // Make sure we query the correct collection 'Faculty&Academic'
    const ClubOrganization = mongoose.model('ClubOrganization', new mongoose.Schema({}, { strict: false }), 'Faculty&Academic');

    const clubsOrganizations = await ClubOrganization.find(query).sort({ title: 1 }); // Sort by title
    res.json(clubsOrganizations);
  } catch (error) {
    console.error('Error fetching clubs/organizations:', error);
    res.status(500).json({ error: 'Error fetching clubs/organizations' });
  }
});
