# Recurring Meetings API Documentation

## Overview

The Recurring Meetings API provides endpoints for creating, managing, and monitoring recurring meeting series. All endpoints require authentication via the `admin_token` cookie.

## Base URL

All endpoints are relative to `/api/events/recurring`

## Authentication

All endpoints require a valid `admin_token` cookie. Unauthorized requests will return a 401 status code.

## Endpoints

### 1. Create Recurring Series

**POST** `/api/events/recurring`

Creates a new recurring meeting series.

#### Request Body

```json
{
  "title": "Weekly Team Standup",
  "description": "Weekly team synchronization meeting",
  "participants": ["user1@example.com", "user2@example.com"],
  "startTime": "2024-01-15T10:00:00Z",
  "duration": 30,
  "recurrencePattern": {
    "type": "weekly",
    "interval": 1,
    "daysOfWeek": [1, 3, 5],
    "endCondition": {
      "type": "count",
      "occurrenceCount": 20
    }
  },
  "provider": "zoom",
  "zoomSettings": {},
  "reminderSettings": [
    { "timing": 1440, "enabled": true },
    { "timing": 60, "enabled": true }
  ],
  "seriesNotification": { "enabled": true },
  "trackOpens": true,
  "trackClicks": true,
  "useInterstitialJoin": true,
  "redirectDelay": 5
}
```

#### Response

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "Weekly Team Standup",
  "host": "organizer@example.com",
  "hostId": "507f1f77bcf86cd799439012",
  "isActive": true,
  "createdAt": "2024-01-10T10:00:00Z",
  "nextGenerationDate": "2024-01-15T10:00:00Z"
}
```

### 2. Get All Recurring Series

**GET** `/api/events/recurring`

Retrieves all recurring series for the authenticated user.

#### Response

```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Weekly Team Standup",
    "host": "organizer@example.com",
    "isActive": true,
    "totalInstances": 5,
    "completedInstances": 2,
    "createdAt": "2024-01-10T10:00:00Z"
  }
]
```

### 3. Get Specific Series

**GET** `/api/events/recurring/{seriesId}`

Retrieves details for a specific recurring series.

#### Response

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "Weekly Team Standup",
  "description": "Weekly team synchronization meeting",
  "host": "organizer@example.com",
  "participants": ["user1@example.com", "user2@example.com"],
  "recurrencePattern": {
    "type": "weekly",
    "interval": 1,
    "daysOfWeek": [1, 3, 5]
  },
  "isActive": true,
  "totalInstances": 5,
  "createdAt": "2024-01-10T10:00:00Z"
}
```

### 4. Update Series

**PUT** `/api/events/recurring/{seriesId}`

Updates a recurring series. Changes can be applied to future instances only or all instances.

#### Request Body

```json
{
  "title": "Updated Meeting Title",
  "participants": ["user1@example.com", "user3@example.com"],
  "duration": 45,
  "applyToFutureOnly": true
}
```

#### Response

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "Updated Meeting Title",
  "updatedAt": "2024-01-12T10:00:00Z"
}
```

### 5. Delete Series

**DELETE** `/api/events/recurring/{seriesId}?cancelFutureOnly=true`

Deletes or deactivates a recurring series.

#### Query Parameters

- `cancelFutureOnly` (boolean): If true, only deactivates the series and cancels future meetings. If false, deletes the entire series.

#### Response

```json
{
  "message": "Series deactivated and future meetings cancelled"
}
```

### 6. Get Series Instances

**GET** `/api/events/recurring/{seriesId}/instances`

Retrieves all meeting instances for a series with pagination and filtering.

#### Query Parameters

- `limit` (number, 1-100): Maximum number of instances to return (default: 50)
- `offset` (number): Number of instances to skip (default: 0)
- `status` (string): Filter by status - 'upcoming', 'past', 'cancelled'
- `startDate` (ISO date): Filter instances starting from this date
- `endDate` (ISO date): Filter instances ending before this date

#### Response

```json
{
  "instances": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "title": "Weekly Team Standup",
      "startTime": "2024-01-15T10:00:00Z",
      "duration": 30,
      "seriesId": "507f1f77bcf86cd799439011",
      "recurrenceInstance": {
        "originalDate": "2024-01-15T10:00:00Z",
        "isModified": false,
        "isCancelled": false
      }
    }
  ],
  "pagination": {
    "total": 20,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

### 7. Send Series Notification

**POST** `/api/events/recurring/{seriesId}/notify`

Sends a series notification email to all participants.

#### Request Body

```json
{
  "force": false,
  "customMessage": "Please note the updated meeting schedule"
}
```

#### Response

```json
{
  "message": "Series notification scheduled successfully",
  "jobId": "507f1f77bcf86cd799439014",
  "recipients": 5
}
```

### 8. Update Individual Instance

**PUT** `/api/events/{eventId}/instance`

Updates a specific meeting instance within a series.

#### Request Body

```json
{
  "title": "Special Topic Discussion",
  "startTime": "2024-01-15T11:00:00Z",
  "duration": 60,
  "participants": ["user1@example.com", "user2@example.com", "guest@example.com"],
  "applyToFuture": false,
  "sendNotification": true
}
```

#### Response

```json
{
  "message": "Instance updated successfully",
  "event": {
    "_id": "507f1f77bcf86cd799439013",
    "title": "Special Topic Discussion",
    "recurrenceInstance": {
      "isModified": true,
      "modificationReason": "Instance-specific changes"
    }
  },
  "appliedToFuture": false
}
```

### 9. Cancel Individual Instance

**DELETE** `/api/events/{eventId}/instance?cancelFuture=false&sendNotification=true`

Cancels a specific meeting instance or all future instances.

#### Query Parameters

- `cancelFuture` (boolean): If true, cancels this and all future instances
- `sendNotification` (boolean): If true, sends cancellation notifications

#### Response

```json
{
  "message": "Successfully cancelled 1 meeting instance(s)",
  "cancelledCount": 1,
  "cancelledFuture": false
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": ["Specific validation error 1", "Specific validation error 2"]
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Recurrence Pattern Schema

### Daily Pattern

```json
{
  "type": "daily",
  "interval": 1,
  "endCondition": {
    "type": "count",
    "occurrenceCount": 30
  }
}
```

### Weekly Pattern

```json
{
  "type": "weekly",
  "interval": 2,
  "daysOfWeek": [1, 3, 5],
  "endCondition": {
    "type": "date",
    "endDate": "2024-12-31T23:59:59Z"
  }
}
```

### Monthly Pattern (by date)

```json
{
  "type": "monthly",
  "interval": 1,
  "dayOfMonth": 15,
  "endCondition": {
    "type": "never"
  }
}
```

### Monthly Pattern (by week)

```json
{
  "type": "monthly",
  "interval": 1,
  "weekOfMonth": 2,
  "dayOfWeek": 1,
  "endCondition": {
    "type": "count",
    "occurrenceCount": 12
  }
}
```

## Rate Limiting

API endpoints are subject to rate limiting:

- Series creation: 10 requests per hour
- Series updates: 50 requests per hour
- Instance generation: 100 requests per hour

## Best Practices

1. **Validation**: Always validate recurrence patterns before submission
2. **Pagination**: Use appropriate limit values for instance listings
3. **Error Handling**: Implement proper error handling for all API calls
4. **Notifications**: Be mindful of notification frequency to avoid spam
5. **Testing**: Test recurrence patterns with small occurrence counts first

## Examples

### Creating a Daily Standup

```javascript
const response = await fetch('/api/events/recurring', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Daily Standup',
    description: 'Daily team synchronization',
    participants: ['team@example.com'],
    startTime: '2024-01-15T09:00:00Z',
    duration: 15,
    recurrencePattern: {
      type: 'daily',
      interval: 1,
      endCondition: { type: 'count', occurrenceCount: 50 }
    },
    provider: 'zoom'
  })
});
```

### Updating Series Participants

```javascript
const response = await fetch('/api/events/recurring/507f1f77bcf86cd799439011', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    participants: ['newteam@example.com'],
    applyToFutureOnly: true
  })
});
```