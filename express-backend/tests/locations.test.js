const request = require('supertest');
const express = require('express');

// Create a minimal express app to test the router in isolation
// Mock the auth middleware before requiring the router
jest.mock('../middleware/auth', () => {
  return (req, res, next) => {
    req.user = { _id: 'mock-user-id' };
    next();
  };
});

const locationsRouter = require('../routes/locations');
const app = express();
app.use(express.json());

app.use('/locations', locationsRouter);

describe('GET /locations/healthy-options', () => {
  
  it('should return 400 if lat or lng is missing', async () => {
    const res1 = await request(app).get('/locations/healthy-options');
    expect(res1.statusCode).toBe(400);
    expect(res1.body.error).toContain('required');

    const res2 = await request(app).get('/locations/healthy-options?lat=12.9');
    expect(res2.statusCode).toBe(400);
  });

  it('should return 400 if lat or lng is out of bounds or invalid', async () => {
    const res1 = await request(app).get('/locations/healthy-options?lat=abc&lng=123');
    expect(res1.statusCode).toBe(400);

    const res2 = await request(app).get('/locations/healthy-options?lat=100&lng=70');
    expect(res2.statusCode).toBe(400); // 100 is > 90
  });

  it('should return top 5 closest restaurants using the local static engine', async () => {
    // 12.9716, 77.5946 is Bangalore (close to EatFit)
    const res = await request(app).get('/locations/healthy-options?lat=12.9716&lng=77.5946');
    
    expect(res.statusCode).toBe(200);
    expect(res.body.source).toBe('local_static_engine');
    expect(res.body.count).toBeLessThanOrEqual(5);
    expect(res.body.options.length).toBeGreaterThan(0);
    
    // The closest one to this coordinate in our DB should be "EatFit" (0 km)
    expect(res.body.options[0].name).toBe('EatFit');
    expect(res.body.options[0].distance).toBe('0 km');
    expect(res.body.options[0].googleMapsUrl).toBeDefined();
    
    // Verify it is sorted by distance
    const dist1 = parseFloat(res.body.options[0].distance);
    const dist2 = parseFloat(res.body.options[1].distance);
    expect(dist1).toBeLessThanOrEqual(dist2);
  });
  
  it('should return Mumbai options when Mumbai coordinates are provided', async () => {
    // 19.0760, 72.8777 is Mumbai (close to Earthen Oven)
    const res = await request(app).get('/locations/healthy-options?lat=19.0760&lng=72.8777');
    
    expect(res.statusCode).toBe(200);
    expect(res.body.options[0].name).toContain('Earthen Oven');
  });
});
