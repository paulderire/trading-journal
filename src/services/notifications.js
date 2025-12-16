// Browser Notification Service for Trading Journal

// Check if notifications are supported
export const isNotificationSupported = () => {
  return 'Notification' in window;
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

// Get current permission status
export const getNotificationPermission = () => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

// Show a notification
export const showNotification = (title, options = {}) => {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    console.warn('Cannot show notification - not permitted');
    return null;
  }

  const defaultOptions = {
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    ...options
  };

  try {
    const notification = new Notification(title, defaultOptions);
    
    notification.onclick = () => {
      window.focus();
      notification.close();
      if (options.onClick) options.onClick();
    };

    // Auto close after 10 seconds if not required interaction
    if (!defaultOptions.requireInteraction) {
      setTimeout(() => notification.close(), 10000);
    }

    return notification;
  } catch (error) {
    console.error('Error showing notification:', error);
    return null;
  }
};

// Habit reminder notification
export const showHabitReminder = (habitName, habitDescription) => {
  return showNotification('📋 Habit Reminder', {
    body: `Don't forget: ${habitName}${habitDescription ? `\n${habitDescription}` : ''}`,
    tag: `habit-${habitName}`,
    requireInteraction: true
  });
};

// Goal reminder notification
export const showGoalReminder = (goalName, progress, target) => {
  const percentage = Math.round((progress / target) * 100);
  return showNotification('🎯 Goal Progress', {
    body: `${goalName}\nProgress: ${percentage}% (${progress}/${target})`,
    tag: `goal-${goalName}`,
    requireInteraction: false
  });
};

// Trading session reminder
export const showTradingReminder = (message) => {
  return showNotification('📊 Trading Reminder', {
    body: message,
    tag: 'trading-reminder',
    requireInteraction: false
  });
};

// Daily planner reminder
export const showPlannerReminder = (taskName) => {
  return showNotification('📅 Task Reminder', {
    body: `Upcoming task: ${taskName}`,
    tag: `task-${taskName}`,
    requireInteraction: false
  });
};

// Schedule a notification for a specific time
export const scheduleNotification = (title, options, scheduledTime) => {
  const now = new Date();
  const targetTime = new Date(scheduledTime);
  const delay = targetTime.getTime() - now.getTime();

  if (delay <= 0) {
    console.warn('Scheduled time is in the past');
    return null;
  }

  const timeoutId = setTimeout(() => {
    showNotification(title, options);
  }, delay);

  return timeoutId;
};

// Cancel a scheduled notification
export const cancelScheduledNotification = (timeoutId) => {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
};

// Initialize notifications on app load
export const initializeNotifications = async () => {
  if (!isNotificationSupported()) {
    console.log('Browser notifications not supported');
    return false;
  }

  const hasPermission = await requestNotificationPermission();
  
  if (hasPermission) {
    console.log('Notifications enabled');
    return true;
  }
  
  console.log('Notification permission denied');
  return false;
};

export default {
  isNotificationSupported,
  requestNotificationPermission,
  getNotificationPermission,
  showNotification,
  showHabitReminder,
  showGoalReminder,
  showTradingReminder,
  showPlannerReminder,
  scheduleNotification,
  cancelScheduledNotification,
  initializeNotifications
};
