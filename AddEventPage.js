import React, { useState } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import '../styles/AddEventPage.css';

const containerStyle = {
  width: '100%',
  height: '400px'
};

const center = {
  lat: 49.2827,
  lng: -123.1207
};

const AddEventPage = () => {
  const [eventData, setEventData] = useState({
    event_date: '',
    event_title: '',
    start_time: '',
    end_time: '',
    location: '',
    activity_description: '',
    registration_status: '',
    reference_link: '',
    about_organization: '',
    latitude: null,
    longitude: null,
  });

  const handleChange = (e) => {
    setEventData({ ...eventData, [e.target.name]: e.target.value });
  };

  const handleMapClick = (e) => {
    setEventData({ ...eventData, latitude: e.latLng.lat(), longitude: e.latLng.lng() });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3001/add-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });
      const data = await response.json();
      console.log('Event added:', data);
    } catch (error) {
      console.error('Error adding event:', error);
    }
  };

  return (
    <div className="form-container">
      <h2 className="form-title">Add Event</h2>
      <form className="event-form" onSubmit={handleSubmit}>
        <TextField label="Event Date" name="event_date" onChange={handleChange} required />
        <TextField label="Event Title" name="event_title" onChange={handleChange} required />
        <TextField label="Start Time" name="start_time" onChange={handleChange} required />
        <TextField label="End Time" name="end_time" onChange={handleChange} required />
        <TextField label="Location" name="location" onChange={handleChange} required />
        <TextField
          label="Activity Description"
          name="activity_description"
          multiline
          rows={4}
          onChange={handleChange}
          required
        />
        <TextField label="Registration Status" name="registration_status" onChange={handleChange} required />
        <TextField label="Reference Link" name="reference_link" onChange={handleChange} required />
        <TextField
          label="About Your Organization"
          name="about_organization"
          multiline
          rows={4}
          onChange={handleChange}
          required
        />
        <div className="map-container">
          <label className="map-label">Pin on Map</label>
          <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}>
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={center}
              zoom={13}
              onClick={handleMapClick}
            >
              {eventData.latitude && eventData.longitude && (
                <Marker position={{ lat: eventData.latitude, lng: eventData.longitude }} />
              )}
            </GoogleMap>
          </LoadScript>
        </div>
        <Button variant="contained" type="submit" className="submit-button">
          Submit
        </Button>
      </form>
    </div>
  );
};

export default AddEventPage;
