// Shared TypeScript types for LazyApply

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface JobApplication {
  id: string;
  user_id: string;
  job_title: string;
  company: string;
  status: 'pending' | 'applied' | 'rejected' | 'interview';
  created_at: string;
  updated_at: string;
}

// Add more shared types here
