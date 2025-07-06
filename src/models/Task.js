import mongoose from 'mongoose';

const TaskSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  title: {
    type: String,
    required: [true, 'Task title is required.'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ['To Do', 'In Progress', 'Done'],
    default: 'To Do',
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser', // Assuming your user model is named AdminUser
  },
  dueDate: {
    type: Date,
  },
}, { timestamps: true });

export default mongoose.models.Task || mongoose.model('Task', TaskSchema);
