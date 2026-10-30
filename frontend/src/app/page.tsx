'use client';

import { useState, useEffect, FormEvent } from 'react';

interface Task {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function TaskManagerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch all tasks from backend
  const fetchTasks = async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/tasks`);
      if (!res.ok) {
        throw new Error(`Failed to load tasks (Status: ${res.status})`);
      }
      const data: Task[] = await res.json();
      setTasks(data);
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      setError(err.message || 'Unable to connect to backend API');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Handle Add Task
  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create task');
      }

      const newTask: Task = await res.json();
      setTasks((prev) => [newTask, ...prev]);
      setTitle('');
    } catch (err: any) {
      console.error('Error adding task:', err);
      setError(err.message || 'Could not add task');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Mark Complete
  const handleCompleteTask = async (id: number) => {
    try {
      setActionInProgressId(id);
      setError(null);
      const res = await fetch(`${API_BASE}/tasks/${id}/complete`, {
        method: 'PATCH',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to complete task');
      }

      const updatedTask: Task = await res.json();
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: updatedTask.completed } : t))
      );
    } catch (err: any) {
      console.error('Error completing task:', err);
      setError(err.message || 'Could not mark task as completed');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Handle Delete Task
  const handleDeleteTask = async (id: number) => {
    try {
      setActionInProgressId(id);
      setError(null);
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete task');
      }

      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      console.error('Error deleting task:', err);
      setError(err.message || 'Could not delete task');
    } finally {
      setActionInProgressId(null);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Mini Task Manager</h1>
        <p>Next.js • NestJS • PostgreSQL • Redis • Docker</p>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="alert-error">
          <span>⚠️ {error}</span>
          <button className="btn btn-delete" onClick={fetchTasks} style={{ marginLeft: '1rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Add Task Form */}
      <div className="card">
        <form onSubmit={handleAddTask} className="add-form">
          <input
            type="text"
            className="input"
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || !title.trim()}
          >
            {isSubmitting ? 'Adding...' : 'Add Task'}
          </button>
        </form>
      </div>

      {/* Task List */}
      <div className="card">
        {isLoading ? (
          <div className="loader">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            No tasks found. Add your first task above!
          </div>
        ) : (
          <div className="task-list">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`task-item ${task.completed ? 'completed' : ''}`}
              >
                <div className="task-info">
                  <span className={`task-title ${task.completed ? 'completed' : ''}`}>
                    {task.title}
                  </span>
                  <span className="task-date">
                    Added {new Date(task.createdAt).toLocaleDateString()} at{' '}
                    {new Date(task.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="task-actions">
                  {task.completed ? (
                    <span className="badge-done">Completed ✓</span>
                  ) : (
                    <button
                      className="btn btn-complete"
                      onClick={() => handleCompleteTask(task.id)}
                      disabled={actionInProgressId === task.id}
                    >
                      {actionInProgressId === task.id ? '...' : 'Complete'}
                    </button>
                  )}

                  <button
                    className="btn btn-delete"
                    onClick={() => handleDeleteTask(task.id)}
                    disabled={actionInProgressId === task.id}
                  >
                    {actionInProgressId === task.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Architecture / Redis Learning Banner */}
      <div className="info-banner">
        <strong>💡 Redis Caching Flow:</strong> The list endpoint (<code>GET /tasks</code>) caches in Redis for 60s. Adding, completing, or deleting a task automatically invalidates the cache so fresh data is retrieved from PostgreSQL.
      </div>
    </div>
  );
}
