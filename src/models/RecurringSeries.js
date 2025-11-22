import mongoose from 'mongoose';

const RecurrencePatternSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'custom'],
    required: true
  },
  interval: {
    type: Number,
    required: true,
    min: 1
  },
  daysOfWeek: [{
    type: Number,
    min: 0,
    max: 6
  }],
  dayOfMonth: {
    type: Number,
    min: 1,
    max: 31
  },
  weekOfMonth: {
    type: Number,
    min: -1,
    max: 4
  },
  dayOfWeek: {
    type: Number,
    min: 0,
    max: 6
  },
  endCondition: {
    type: {
      type: String,
      enum: ['date', 'count', 'never'],
      required: true
    },
    endDate: Date,
    occurrenceCount: {
      type: Number,
      min: 1
    }
  }
}, { _id: false });

const ReminderSettingSchema = new mongoose.Schema({
  timing: {
    type: Number,
    required: true,
    min: 0
  },
  enabled: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const SeriesNotificationSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: true
  },
  sent: {
    type: Boolean,
    default: false
  },
  sentAt: Date
}, { _id: false });

const RecurringSeriesSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Meeting title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  host: {
    type: String,
    required: [true, 'Host email is required'],
    trim: true
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  
  // Recurrence Configuration
  recurrencePattern: {
    type: RecurrencePatternSchema,
    required: true
  },
  
  // Meeting Configuration
  duration: {
    type: Number,
    required: true,
    min: 1
  },
  participants: [{
    type: String,
    trim: true
  }],
  provider: {
    type: String,
    enum: ['zoom', 'google_meet'],
    required: true
  },
  zoomSettings: {
    type: mongoose.Schema.Types.Mixed
  },
  joinUrl: {
    type: String,
    trim: true
  },
  
  // Notification Configuration
  reminderSettings: [ReminderSettingSchema],
  seriesNotification: {
    type: SeriesNotificationSchema,
    default: () => ({})
  },
  
  // Tracking Configuration
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
  useInterstitialJoin: {
    type: Boolean,
    default: false
  },
  redirectDelay: {
    type: Number,
    default: 0,
    min: 0
  },
  includeDirectMeetingLink: {
    type: Boolean,
    default: true
  },
  
  // Series Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  nextGenerationDate: {
    type: Date,
    required: true
  },
  lastGeneratedUntil: Date,
  
  // Statistics
  totalInstances: {
    type: Number,
    default: 0,
    min: 0
  },
  completedInstances: {
    type: Number,
    default: 0,
    min: 0
  },
  cancelledInstances: {
    type: Number,
    default: 0,
    min: 0
  }
}, { 
  timestamps: true,
  collection: 'recurring_series'
});

// Indexes for efficient querying
RecurringSeriesSchema.index({ nextGenerationDate: 1, isActive: 1 });
RecurringSeriesSchema.index({ hostId: 1 });
RecurringSeriesSchema.index({ createdAt: -1 });

// Virtual for getting active series
RecurringSeriesSchema.virtual('isExpired').get(function() {
  if (this.recurrencePattern.endCondition.type === 'date') {
    return new Date() > this.recurrencePattern.endCondition.endDate;
  }
  if (this.recurrencePattern.endCondition.type === 'count') {
    return this.totalInstances >= this.recurrencePattern.endCondition.occurrenceCount;
  }
  return false;
});

// Method to update statistics
RecurringSeriesSchema.methods.updateStatistics = function() {
  // This will be implemented when we have the Event model integration
  return this.save();
};

export default mongoose.models.RecurringSeries || mongoose.model('RecurringSeries', RecurringSeriesSchema);