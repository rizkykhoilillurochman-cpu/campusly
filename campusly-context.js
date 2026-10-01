import { localDateKey } from './campusly-dates.js?v=20261001-final1';

export function buildAIContext(state, date = new Date()) {
  const today = localDateKey(date);
  const tomorrowDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const tomorrow = localDateKey(tomorrowDate);
  const todayName = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(date);
  const tomorrowName = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(tomorrowDate);
  const tasks = (state.tasks || [])
    .filter(task => !task.deletedAt && !task.done && task.deadline && task.deadline <= tomorrow)
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)))
    .slice(0, 3)
    .map(({ title, course, deadline, priority }) => ({ title, course, deadline, priority }));
  const schedule = (state.schedule || [])
    .filter(item => !item.deletedAt && [todayName, tomorrowName].includes(item.day))
    .sort((a, b) => String(a.start).localeCompare(String(b.start)))
    .slice(0, 8)
    .map(({ name, day, start, end, room }) => ({ name, day, start, end, room }));
  const context = {
    profile: {
      preferredName: state.profile?.preferredName || '',
      major: state.profile?.major || '',
      semester: state.profile?.semester || ''
    },
    date: today,
    tasks,
    schedule
  };
  return { data: context, json: JSON.stringify(context), summary: { taskCount: tasks.length, scheduleTodayCount: schedule.filter(x => x.day === todayName).length } };
}
