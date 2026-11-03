import { api } from '@/lib/api'

export type ContactFormValues = {
  name: string
  email: string
  subject: string
  message: string
  website: string
}

export type ContactSubmissionResponse = {
  message: string
}

export function submitContactMessage(values: ContactFormValues) {
  return api<ContactSubmissionResponse>('/v1/contact', {
    method: 'POST',
    body: values,
  })
}
