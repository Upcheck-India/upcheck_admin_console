import mongoose from 'mongoose';

const NotificationTrackingSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  opened: {
    type: Boolean,
    default: false
  },
  openedAt: Date,
  clicked: {
    type: Boolean,
    default: false
  },
  clickedAt: Date,
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedAt: Date
}, { _id: false });

const SeriesDataSchema = new mongoose.Schema({
  upcomingMeetings: [Date],
  totalMeetings: {
    type: Number,
    min: 0
  },
  recurrenceDescription: {
    type: String,
    trim: true
  }
}, { _id: false });

const NotificationErrorSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true
  },
  retryCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastFailedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const NotificationSchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  seriesId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RecurringSeries'
  },
  
  recipient: {
    type: String,
    required: [true, 'Recipient email is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['reminder', 'cancellation', 'update', 'series_notification'],
    required: true
  },
  timing: {
    type: Number, // Minutes before meeting (null for series notifications)
    min: 0
  },
  
  status: {
    type: String,
    enum: ['scheduled', 'sent', 'failed', 'cancelled'],
    default: 'scheduled'
  },
  scheduledFor: {
    type: Date,
    required: true
  },
  sentAt: Date,
  
  // Series notification specific data
  seriesData: SeriesDataSchema,
  
  // Email tracking
  tracking: NotificationTrackingSchema,
  
  // Error handling
  error: NotificationErrorSchema,
  
  // Email content metadata
  subject: {
    type: String,
    trim: true
  },
  templateVersion: {
    type: String,
    default: '1.0'
  },
  
  // Delivery metadata
  messageId: String, // Email service message ID
  deliveryAttempts: {
    type: Number,
    default: 0,
    min: 0
  },
  maxDeliveryAttempts: {
    type: Number,
    default: 3,
    min: 1
  }
}, { 
  timestamps: true,
  collection: 'notifications'
});

// Indexes for efficient querying
NotificationSchema.index({ scheduledFor: 1, status: 1 });
NotificationSchema.index({ meetingId: 1, type: 1 });
NotificationSchema.index({ seriesId: 1, type: 1 });
NotificationSchema.index({ recipient: 1, status: 1 });
NotificationSchema.index({ 'tracking.token': 1 });
NotificationSchema.index({ status: 1, createdAt: 1 });

// Virtual for checking if notification is overdue
NotificationSchema.virtual('isOverdue').get(function() {
  return this.status === 'scheduled' && new Date() > this.scheduledFor;
});

// Virtual for checking if notification can be retried
NotificationSchema.virtual('canRetry').get(function() {
  return this.status === 'failed' && 
         this.deliveryAttempts < this.maxDeliveryAttempts;
});

// Method to generate tracking token
NotificationSchema.methods.generateTrackingToken = function() {
  const crypto = require('crypto');
  this.tracking = {
    token: crypto.randomBytes(32).toString('hex'),
    opened: false,
    clicked: false,
    acknowledged: false
  };
  return this.tracking.token;
};

// Method to mark as sent
NotificationSchema.methods.markSent = function(messageId = null) {
  this.status = 'sent';
  this.sentAt = new Date();
  this.deliveryAttempts += 1;
  if (messageId) {
    this.messageId = messageId;
  }
  return this.save();
};

// Method to mark as failed
NotificationSchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.deliveryAttempts += 1;
  this.error = {
    message: error.message,
    retryCount: (this.error?.retryCount || 0) + 1,
    lastFailedAt: new Date()
  };
  return this.save();
};

// Method to track email open
NotificationSchema.methods.trackOpen = function() {
  if (!this.tracking.opened) {
    this.tracking.opened = true;
    this.tracking.openedAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to track email click
NotificationSchema.methods.trackClick = function() {
  if (!this.tracking.clicked) {
    this.tracking.clicked = true;
    this.tracking.clickedAt = new Date();
  }
  // Also mark as opened if not already
  if (!this.tracking.opened) {
    this.tracking.opened = true;
    this.tracking.openedAt = new Date();
  }
  return this.save();
};

// Method to track acknowledgment
NotificationSchema.methods.trackAcknowledgment = function() {
  if (!this.tracking.acknowledged) {
    this.tracking.acknowledged = true;
    this.tracking.acknowledgedAt = new Date();
  }
  return this.save();
};

// Static method to get pending notifications
NotificationSchema.statics.getPendingNotifications = function(limit = 50) {
  return this.find({
    status: 'scheduled',
    scheduledFor: { $lte: new Date() }
  })
  .sort({ scheduledFor: 1 })
  .limit(limit);
};

// Static method to get notifications by tracking token
NotificationSchema.statics.findByTrackingToken = function(token) {
  return this.findOne({ 'tracking.token': token });
};

// Static method to cleanup old notifications
NotificationSchema.statics.cleanupOldNotifications = function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    status: { $in: ['sent', 'cancelled'] },
    createdAt: { $lt: cutoffDate }
  });
};

export default mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);