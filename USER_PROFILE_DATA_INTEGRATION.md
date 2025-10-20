# User Profile Screen - Real Data Integration

## Overview
The UserProfileScreen has been updated to display real data from the backend for other users' profiles, including ratings, feedback, and statistics from actual user interactions.

## Data Sources

### 1. User Basic Information
**Endpoint**: `GET /api/auth/users/:userId`

**Data Retrieved**:
- `_id` - User ID
- `name` - User's name
- `email` - User's email
- `profilePic` - Profile picture URL
- `age` - User's age
- `gender` - User's gender
- `country` - User's country
- `nativeLanguage` - User's native language
- `englishLevel` - English proficiency level (A1, A2, B1, B2, C1, C2)
- `bio` - User biography
- `interests` - Array of user interests

### 2. User Rating Summary
**Endpoint**: `GET /api/ratings/summary/:userId`

**Data Retrieved**:
```typescript
{
  stats: {
    totalRatings: number,          // Total number of ratings received
    averageRating: number,          // Average rating (1-5 stars)
    positiveFeedback: number,       // Count of positive feedback
    negativeFeedback: number,       // Count of negative feedback
    satisfactionPercentage: number, // Percentage of satisfied users
    totalCalls: number,             // Total number of calls
    totalHours: number,             // Total hours of conversation
    totalMinutes: number            // Total minutes of conversation
  },
  recentRatings: Array,            // Last 5 ratings with user info
  recentFeedback: Array,           // Last 10 public feedback items
  compliments: Array<{             // Compliments with counts
    _id: string,                   // Compliment type
    count: number                  // Number of times received
  }>,
  advice: Array<{                  // Advice with counts
    _id: string,                   // Advice type
    count: number                  // Number of times received
  }>
}
```

## Display Components

### Stats Section
Shows three key metrics:
1. **Feedback**: Total feedback count (positive + negative)
2. **Talks**: Total number of calls completed
3. **Hours**: Total hours of conversation

### Rating & Feedback Section
Displays comprehensive rating information:

#### When ratings exist:
- **Satisfaction Percentage**: Shows the percentage of users satisfied with this conversation partner
- **Average Rating**: Shows the average star rating (out of 5)
- **Rating Count**: Shows total number of ratings received
- **Top Compliments**: Lists up to 5 most common compliments received with counts

#### When no ratings exist:
- Shows "No ratings yet" message
- Explains that the user hasn't received ratings from other users

### Information Section
Displays user profile information:
- Native Language
- English Level (from `englishLevel` field)
- Gender
- Age
- Location/Country

## Backend Models

### User Model
Located at: `mrenglishserverside/models/User.js`

Key fields for profile display:
- Basic info: name, email, profilePic
- Demographics: age, gender, country
- Language: nativeLanguage, englishLevel
- Personal: bio, interests

### UserStats Model
Located at: `mrenglishserverside/models/UserStats.js`

Tracks:
- Call statistics (totalCalls, totalMinutes, totalHours)
- Rating statistics (totalRatings, averageRating)
- Feedback statistics (positiveFeedback, negativeFeedback, satisfactionPercentage)
- Activity statistics (lastActiveAt, currentStreak)

### Rating Model
Located at: `mrenglishserverside/models/Rating.js`

Stores individual ratings (1-5 stars) from users with optional comments.

### Compliment Model
Located at: `mrenglishserverside/models/Compliment.js`

Available compliment types:
- Great speaking partner
- Speaks clearly
- Interesting person
- Respectful and polite
- Attentive listener
- Helps me with my English
- Helps me express myself
- Patient teacher
- Good pronunciation
- Friendly and welcoming

### Feedback Model
Located at: `mrenglishserverside/models/Feedback.js`

Tracks positive/negative feedback with optional messages.

## Data Flow

```
UserProfileScreen
    |
    ├──> Fetch User Data (GET /api/auth/users/:userId)
    |    └──> Returns: Basic user information
    |
    ├──> Fetch Rating Summary (GET /api/ratings/summary/:userId)
    |    └──> Returns: Stats, ratings, feedback, compliments
    |
    ├──> Check Local Storage
    |    ├──> favorites (AsyncStorage)
    |    └──> blockedUsers (AsyncStorage)
    |
    └──> Display Combined Data
```

## Error Handling

1. **User Profile Fetch Failure**: 
   - Shows error alert to user
   - Still attempts to check local storage for favorite/block status
   - Sets loading state to false

2. **Rating Summary Fetch Failure**:
   - Logs error to console
   - Continues without rating data
   - Shows "No ratings yet" message

3. **Network Issues**:
   - User sees appropriate error messages
   - Can retry by refreshing or navigating away and back

## Usage Example

When viewing a user profile:
1. Screen fetches user data from `/api/auth/users/:userId`
2. Screen fetches rating summary from `/api/ratings/summary/:userId`
3. Displays:
   - Profile picture with English level badge
   - User name with gender indicator
   - Online status
   - Action buttons (Message, Call) - hidden if user is blocked
   - Stats: Feedback count, Talks count, Hours
   - Information: Native language, English level, Gender, Age, Location
   - Rating & Feedback: Satisfaction %, Average rating, Top compliments
   - Block/Report options

## Testing the Integration

To verify real data is showing:

1. **Check Stats**:
   - Values should come from `ratingSummary.stats`
   - Should show 0 if user has no activity

2. **Check Ratings**:
   - If user has ratings: Shows satisfaction % and average rating
   - If no ratings: Shows "No ratings yet"

3. **Check Compliments**:
   - Only shows if user has received compliments
   - Displays up to top 5 compliments with counts

4. **Check User Info**:
   - Should use `englishLevel` field from backend
   - Falls back to `level` if `englishLevel` not available

## Future Enhancements

Potential additions:
1. Show recent feedback comments
2. Display rating distribution chart
3. Add pagination for viewing all ratings
4. Show advice received (similar to compliments)
5. Add option to filter compliments/advice
6. Display user's learning goals or preferences
7. Show mutual friends or common interests

## Notes

- All data is fetched fresh on each profile view
- Local storage only used for favorite/block status
- Rating summary includes aggregated data calculated server-side
- Compliments are sorted by count (most received first)
- The screen gracefully handles missing or incomplete data


