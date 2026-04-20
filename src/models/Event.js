import mongoose from 'mongoose';

const TrackingEntrySchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true
  },
  token: {
    type: String,
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
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

const RecurrenceInstanceSchema = new mongoose.Schema({
  originalDate: {
    type: Date,
    required: true
  },
  wasModified: {
    type: Boolean,
    default: false
  },
  isCancelled: {
    type: Boolean,
    default: false
  },
  modificationReason: {
    type: String,
    trim: true
  }
}, { _id: false });

const EventOverridesSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  participants: [{
    type: String,
    trim: true
  }],
  duration: {
    type: Number,
    min: 1,
    max: 300
  },
  joinUrl: {
    type: String,
    trim: true
  }
}, { _id: false });

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    trim: true
  },
  host: {
    type: String,
    required: [true, 'Host email is required'],
    trim: true
  },
  hostId: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 1,
    max: 300
  },
  participants: [{
    type: String,
    trim: true
  }],
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  
  // Meeting provider configuration
  provider: {
    type: String,
    enum: ['zoom', 'google_meet'],
    default: 'zoom'
  },
  joinUrl: {
    type: String,
    trim: true
  },
  zoomMeetingUrl: {
    type: String,
    trim: true
  },
  zoomMeetingId: {
    type: String,
    trim: true
  },
  zoomSettings: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Notification settings
  sendNotification: {
    type: Boolean,
    default: false
  },
  
  // Tracking configuration
  trackOpens: {
    type: Boolean,
    default: false
  },
  trackClicks: {
    type: Boolean,
    default: false
  },
  trackAck: {
    type: Boolean,
    default: false
  },
  tracking: [TrackingEntrySchema],
  
  // Bot integration
  inviteUpcheckBot: {
    type: Boolean,
    default: false
  },
  
  // Join page configuration
  useInterstitialJoin: {
    type: Boolean,
    default: true
  },
  redirectDelay: {
    type: Number,
    default: 5,
    min: 0
  },
  includeDirectMeetingLink: {
    type: Boolean,
    default: true
  },
  
  // Email template options
  includeAgenda: {
    type: Boolean,
    default: true
  },
  includeParticipants: {
    type: Boolean,
    default: true
  },
  includeNotes: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    trim: true
  },
  
  // Recurring meeting fields
  seriesId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RecurringSeries'
  },
  recurrenceInstance: RecurrenceInstanceSchema,
  
  // Instance-specific overrides for recurring meetings
  overrides: EventOverridesSchema,
  
  // Event status
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  collection: 'events'
});

// Indexes for efficient querying
EventSchema.index({ startTime: 1 });
EventSchema.index({ host: 1, startTime: 1 });
EventSchema.index({ hostId: 1, startTime: 1 });
EventSchema.index({ seriesId: 1, startTime: 1 });
EventSchema.index({ 'recurrenceInstance.originalDate': 1 });
EventSchema.index({ status: 1, startTime: 1 });
EventSchema.index({ 'tracking.token': 1 });

// Virtual for checking if event is recurring
EventSchema.virtual('isRecurring').get(function() {
  return !!this.seriesId;
});

// Virtual for checking if event is in the past
EventSchema.virtual('isPast').get(function() {
  return new Date() > this.endTime;
});

// Virtual for checking if event is currently happening
EventSchema.virtual('isInProgress').get(function() {
  const now = new Date();
  return now >= this.startTime && now <= this.endTime;
});

// Virtual for getting effective title (with overrides)
EventSchema.virtual('effectiveTitle').get(function() {
  return this.overrides?.title || this.title;
});

// Virtual for getting effective description (with overrides)
EventSchema.virtual('effectiveDescription').get(function() {
  return this.overrides?.description || this.description;
});

// Virtual for getting effective participants (with overrides)
EventSchema.virtual('effectiveParticipants').get(function() {
  return this.overrides?.participants || this.participants;
});

// Virtual for getting effective duration (with overrides)
EventSchema.virtual('effectiveDuration').get(function() {
  return this.overrides?.duration || this.duration;
});

// Method to apply instance-specific overrides
EventSchema.methods.applyOverrides = function(overrides) {
  this.overrides = { ...this.overrides, ...overrides };
  this.recurrenceInstance.wasModified = true;
  return this.save();
};

// Method to cancel this instance
EventSchema.methods.cancelInstance = function(reason = null) {
  this.recurrenceInstance.isCancelled = true;
  this.recurrenceInstance.modificationReason = reason;
  this.status = 'cancelled';
  return this.save();
};

// Method to get tracking entry by email
EventSchema.methods.getTrackingByEmail = function(email) {
  return this.tracking?.find(t => t.email === email);
};

// Method to track email open
EventSchema.methods.trackOpen = function(token) {
  const trackingEntry = this.tracking?.find(t => t.token === token);
  if (trackingEntry && !trackingEntry.opened) {
    trackingEntry.opened = true;
    trackingEntry.openedAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to track email click
EventSchema.methods.trackClick = function(token) {
  const trackingEntry = this.tracking?.find(t => t.token === token);
  if (trackingEntry) {
    if (!trackingEntry.clicked) {
      trackingEntry.clicked = true;
      trackingEntry.clickedAt = new Date();
    }
    // Also mark as opened if not already
    if (!trackingEntry.opened) {
      trackingEntry.opened = true;
      trackingEntry.openedAt = new Date();
    }
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to track acknowledgment
EventSchema.methods.trackAcknowledgment = function(token) {
  const trackingEntry = this.tracking?.find(t => t.token === token);
  if (trackingEntry && !trackingEntry.acknowledged) {
    trackingEntry.acknowledged = true;
    trackingEntry.acknowledgedAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to find events by series
EventSchema.statics.findBySeries = function(seriesId, options = {}) {
  const query = { seriesId: new mongoose.Types.ObjectId(seriesId) };
  
  if (options.includeCancel === false) {
    query['recurrenceInstance.isCancelled'] = { $ne: true };
  }
  
  return this.find(query).sort({ startTime: 1 });
};

// Static method to find upcoming events
EventSchema.statics.findUpcoming = function(limit = 10) {
  return this.find({
    startTime: { $gt: new Date() },
    status: { $ne: 'cancelled' }
  })
  .sort({ startTime: 1 })
  .limit(limit);
};

// Static method to find events by tracking token
EventSchema.statics.findByTrackingToken = function(token) {
  return this.findOne({ 'tracking.token': token });
};

// Pre-save middleware to update endTime when duration changes
EventSchema.pre('save', function(next) {
  if (this.isModified('startTime') || this.isModified('duration')) {
    const effectiveDuration = this.effectiveDuration;
    this.endTime = new Date(this.startTime.getTime() + effectiveDuration * 60000);
  }
  
  if (this.isModified()) {
    this.updatedAt = new Date();
  }
  
  next();
});

export default mongoose.models.Event || mongoose.model('Event', EventSchema);