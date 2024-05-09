const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = 3001; // Changed port number to avoid conflict

// MongoDB connection URL
const mongoURI = 'mongodb+srv://richardluo73:Drose125@cluster0.dvqbjnc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB
mongoose.connect(mongoURI);
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected successfully to MongoDB');
});

// Define a schema for the events
const EventSchema = new mongoose.Schema({
  event_id: Number,
  event_name: String,
  start_time: String,
  end_time: { type: String, default: null },
  location: String,
  club: String,
  bio: String,
  reference_link: String
});

// Create a model based on the schema
const Event = mongoose.model('Event', EventSchema);

// Middleware to parse JSON bodies
app.use(express.json());

// Route to add an event
app.post('/add-event', (req, res) => {
  const newEvent = new Event(req.body);
  newEvent.save()
    .then(event => res.status(201).json(event))
    .catch(err => res.status(400).json({ message: 'Error adding event', error: err }));
});

// Route to get all events
app.get('/events', (req, res) => {
  Event.find()
    .then(events => res.json(events))
    .catch(err => res.status(500).json({ message: 'Error fetching events', error: err }));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
