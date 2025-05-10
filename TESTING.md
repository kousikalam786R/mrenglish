# API Testing Guide with Thunder Client

This document provides instructions for testing the chat API endpoints using Thunder Client or other API testing tools.

## Authentication

Most endpoints require authentication. Follow these steps:

1. First, get a token by logging in:
   - **Endpoint**: `POST http://localhost:5000/api/auth/login`
   - **Body**: 
     ```json
     {
       "email": "your-email@example.com",
       "password": "your-password"
     }
     ```
   - **Response**: Save the token from the response

2. Use the token in all subsequent requests:
   - Add an `Authorization` header with value `Bearer YOUR_TOKEN`

## User Endpoints

### Get Current User
- **Endpoint**: `GET http://localhost:5000/api/auth/me`
- **Headers**: 
  - `Authorization: Bearer YOUR_TOKEN`

### Get User by ID
- **Endpoint**: `GET http://localhost:5000/api/auth/users/{userId}`
- **Headers**: 
  - `Authorization: Bearer YOUR_TOKEN`

### Get All Users
- **Endpoint**: `GET http://localhost:5000/api/auth/users`
- **Headers**: 
  - `Authorization: Bearer YOUR_TOKEN`

## Chat Endpoints

### Get Recent Chats (Connected Users)
- **Endpoint**: `GET http://localhost:5000/api/messages/recent`
- **Headers**: 
  - `Authorization: Bearer YOUR_TOKEN`
- **Response**: List of recent chats with users
- **Expected Response Format**:
  ```json
  [
    {
      "user": {
        "_id": "65f2d76b1bcf0f79dc9ac01e",
        "name": "John Doe",
        "email": "john@example.com",
        "profilePic": "https://example.com/profile.jpg"
      },
      "unreadCount": 3,
      "lastMessage": {
        "_id": "65f2d76b1bcf0f79dc9ac01f",
        "sender": "65f2d76b1bcf0f79dc9ac01e",
        "receiver": "65f2d76b1bcf0f79dc9ac020",
        "content": "Hello there!",
        "read": false,
        "createdAt": "2023-01-01T12:00:00.000Z"
      }
    }
  ]
  ```
- **Note**: This endpoint returns only users you've chatted with, not all users

### Get Messages for a Conversation
- **Endpoint**: `GET http://localhost:5000/api/messages/conversations/{receiverId}`
- **Headers**: 
  - `Authorization: Bearer YOUR_TOKEN`
- **Response**: List of messages between you and the specified user

### Send a Message
- **Endpoint**: `POST http://localhost:5000/api/messages/send`
- **Headers**: 
  - `Authorization: Bearer YOUR_TOKEN`
  - `Content-Type: application/json`
- **Body**:
  ```json
  {
    "receiverId": "USER_ID_HERE",
    "content": "Hello, this is a test message!"
  }
  ```

## Implementing a "Connected Users" Endpoint

If you need a specific endpoint to only get users you've communicated with, your server already implements this through the `/api/messages/recent` endpoint. However, if you need a simpler format, you could create a new endpoint like this:

### Server Implementation

```javascript
// Get only connected users (users you've chatted with)
router.get('/connected-users', auth, async (req, res) => {
  try {
    const { userId } = req;
    
    // Find all messages where the current user is either sender or receiver
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }]
    });
    
    // Extract unique user IDs excluding the current user
    const connectedUserIds = new Set();
    messages.forEach(message => {
      if (message.sender.toString() !== userId) {
        connectedUserIds.add(message.sender.toString());
      }
      if (message.receiver.toString() !== userId) {
        connectedUserIds.add(message.receiver.toString());
      }
    });
    
    // Get user details for connected users
    const connectedUsers = await User.find({
      _id: { $in: Array.from(connectedUserIds) }
    }).select('name email profilePic');
    
    res.json(connectedUsers);
  } catch (error) {
    console.error('Error getting connected users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
```

## Troubleshooting

If you're encountering issues:

1. Check that your server is running at port 5000
2. Verify your token is valid and not expired
3. Make sure you're using the correct userId format (typically MongoDB ObjectId)
4. Check the server logs for detailed error messages

## Expected Server API Implementation

The server should implement these routes:

```javascript
// Auth routes
router.post('/auth/login', login);
router.post('/auth/register', signup);
router.get('/auth/me', protect, getCurrentUser);
router.get('/auth/users', protect, getAllUsers);
router.get('/auth/users/:userId', protect, getUserById);

// Message routes
router.get('/messages/recent', protect, getRecentChats);
router.get('/messages/conversations/:receiverId', protect, getConversation);
router.post('/messages/send', protect, sendMessage);
```

If any of these routes are not implemented, you'll need to add them to your server code. 