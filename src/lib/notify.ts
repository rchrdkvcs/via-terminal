import { toast } from 'vue-sonner'

interface Action {
  label: string
  run: () => void
}

function options(action?: Action) {
  return action ? { action: { label: action.label, onClick: action.run } } : undefined
}

export const notify = {
  info: (message: string, action?: Action) => toast(message, options(action)),
  success: (message: string, action?: Action) => toast.success(message, options(action)),
  error: (message: string, action?: Action) => toast.error(message, options(action)),
}
