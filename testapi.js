const axios = require('axios');

// Function to add an event
async function addEvent() {
    const url = 'http://localhost:3001/add-event';
    const eventData = {
        event_id: 2,
        event_name: "Tech Talk on Web Development",
        start_time: "15:00",
        end_time: "17:00",
        location: "Tech Hub 101",
        club: "Web Dev Club",
        bio: "An in-depth talk on modern web development practices.",
        reference_link: "www.webdevclub.com"
    };

    try {
        const response = await axios.post(url, eventData);
        console.log('Event Added:', response.data);
    } catch (error) {
        console.error('Error adding event:', error);
    }
}

// Function to get all events
async function getEvents() {
    const url = 'http://localhost:3001/events';

    try {
        const response = await axios.get(url);
        console.log('All Events:', response.data);
    } catch (error) {
        console.error('Error fetching events:', error);
    }
}

// Call the functions to test
addEvent().then(() => getEvents());
