# Testing User Profile Real Data Integration

## Quick Verification Checklist

### ✅ Frontend Changes
- [x] UserProfileScreen fetches real user data from `/api/auth/users/:userId`
- [x] UserProfileScreen fetches rating summary from `/api/ratings/summary/:userId`
- [x] Stats section displays real feedback, talks, and hours
- [x] Rating section shows satisfaction percentage and average rating
- [x] Top compliments displayed when available
- [x] Proper error handling for failed API requests
- [x] Loading states implemented
- [x] No linter errors

### ✅ Backend Endpoints Available
- [x] `GET /api/auth/users/:userId` - Get user profile
- [x] `GET /api/ratings/summary/:userId` - Get rating summary with stats
- [x] `POST /api/ratings/submit` - Submit a rating
- [x] `POST /api/ratings/feedback` - Submit feedback
- [x] `POST /api/ratings/compliment` - Submit a compliment

## How to Test

### 1. Start the Backend Server
```bash
cd mrenglishserverside
node server.js
```

Server should start on `http://localhost:5000`

### 2. Verify Endpoints Manually

#### Using Thunder Client / Postman / curl

**Get User Profile:**
```bash
curl -X GET http://localhost:5000/api/auth/users/{USER_ID} \
  -H "Authorization: Bearer {YOUR_TOKEN}" \
  -H "Content-Type: application/json"
```

**Get Rating Summary:**
```bash
curl -X GET http://localhost:5000/api/ratings/summary/{USER_ID} \
  -H "Authorization: Bearer {YOUR_TOKEN}" \
  -H "Content-Type: application/json"
```

### 3. Test with the App

1. **Login to the app** with a user account
2. **Navigate to any user's profile** (from Contacts, Chat, etc.)
3. **Check the displayed data:**
   - Profile picture and name should load
   - Stats (Feedback, Talks, Hours) should show real numbers or 0
   - Rating section should show:
     - "No ratings yet" if user has no ratings
     - Satisfaction % and Average rating if ratings exist
     - Top compliments if user has received any

### 4. Create Test Data (Optional)

If you want to test with real ratings and feedback:

#### Option A: Use the Test Script
```bash
cd mrenglishserverside
node test-user-profile-endpoints.js
```

Before running:
1. Update `AUTH_TOKEN` with a valid JWT token
2. Update `TEST_USER_ID` with an actual user ID
3. Uncomment the test data creation functions

#### Option B: Manually Submit Ratings via API

**Submit a Rating (1-5 stars):**
```bash
curl -X POST http://localhost:5000/api/ratings/submit \
  -H "Authorization: Bearer {YOUR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "{TARGET_USER_ID}",
    "rating": 5,
    "comment": "Great conversation partner!",
    "interactionType": "call"
  }'
```

**Submit Positive Feedback:**
```bash
curl -X POST http://localhost:5000/api/ratings/feedback \
  -H "Authorization: Bearer {YOUR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "{TARGET_USER_ID}",
    "feedbackType": "positive",
    "message": "Very helpful and patient",
    "interactionType": "call"
  }'
```

**Submit a Compliment:**
```bash
curl -X POST http://localhost:5000/api/ratings/compliment \
  -H "Authorization: Bearer {YOUR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "{TARGET_USER_ID}",
    "complimentType": "Great speaking partner",
    "interactionType": "call"
  }'
```

Available compliment types:
- "Great speaking partner"
- "Speaks clearly"
- "Interesting person"
- "Respectful and polite"
- "Attentive listener"
- "Helps me with my English"
- "Helps me express myself"
- "Patient teacher"
- "Good pronunciation"
- "Friendly and welcoming"

## Debugging

### Check Network Requests

#### React Native Debugger
1. Enable Debug mode in your app
2. Open React Native Debugger
3. Go to Network tab
4. Navigate to a user profile
5. You should see requests to:
   - `/api/auth/users/{userId}`
   - `/api/ratings/summary/{userId}`

#### Console Logs
Check the app console for:
- "Error fetching user profile:" - If profile fetch fails
- "Error fetching rating summary:" - If rating fetch fails
- User data and rating summary should be logged

### Common Issues

**Issue: "No ratings yet" shows even though ratings exist**
- Check if the rating summary endpoint is returning data
- Verify `ratingSummary.stats.totalRatings > 0`
- Check console for API errors

**Issue: Stats show 0 for everything**
- User might not have any activity yet
- Check if UserStats document exists for this user
- Try submitting test ratings/feedback

**Issue: Profile doesn't load**
- Check if user ID is valid (24-character MongoDB ObjectId)
- Verify authentication token is valid
- Check backend server is running
- Check network connectivity

**Issue: Compliments don't show**
- Compliments only show if count > 0
- Check if compliments were submitted for this user
- Verify compliment types match the predefined list

## Expected Behavior

### User with No Activity
```
Stats:
  Feedback: 0
  Talks: 0
  Hours: 0

Rating & Feedback:
  "No ratings yet"
  "This user hasn't received any ratings from other users yet"
```

### User with Activity
```
Stats:
  Feedback: 5      (3 positive + 2 negative)
  Talks: 12
  Hours: 4

Rating & Feedback:
  Satisfaction: 60%
  Avg Rating: 4.2 ⭐
  Based on 5 ratings from other users
  
  Top Compliments:
    ✓ Great speaking partner (3)
    ✓ Speaks clearly (2)
    ✓ Patient teacher (1)
```

## Monitoring Real Data

### Check MongoDB Directly

Connect to your MongoDB database and check:

**UserStats Collection:**
```javascript
db.userstats.findOne({ user: ObjectId("USER_ID") })
```

**Ratings Collection:**
```javascript
db.ratings.find({ user: ObjectId("USER_ID") })
```

**Compliments Collection:**
```javascript
db.compliments.find({ user: ObjectId("USER_ID") })
```

**Feedback Collection:**
```javascript
db.feedbacks.find({ user: ObjectId("USER_ID") })
```

### Backend Logs

When a user profile is accessed, you should see:
```
GET /api/auth/users/{userId}
Getting rating summary for userId: {userId}
```

When ratings are submitted:
```
POST /api/ratings/submit
Rating created successfully
UserStats updated
```

## Performance Considerations

- Profile data is fetched on every screen view (not cached)
- Two separate API calls: user profile + rating summary
- Rating summary aggregates data from multiple collections
- For users with many ratings, consider pagination in future

## Next Steps

After verifying the integration:

1. **Add more users** to your database with diverse profiles
2. **Submit ratings and feedback** between users after calls
3. **Monitor the stats** to ensure they update correctly
4. **Test edge cases** (blocked users, network errors, etc.)
5. **Consider adding**:
   - Caching for frequently viewed profiles
   - Pull-to-refresh functionality
   - Loading skeletons for better UX
   - Error retry mechanisms

## Need Help?

Check the documentation:
- `USER_PROFILE_DATA_INTEGRATION.md` - Detailed integration documentation
- `test-user-profile-endpoints.js` - Endpoint testing script
- Backend README files for API documentation


