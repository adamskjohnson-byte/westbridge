<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreContactRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // Spam submissions should receive the neutral success path even if their other fields are malformed.
        if ($this->filled('website')) {
            return [];
        }

        return [
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => ['required', 'string', 'email:rfc', 'max:254'],
            'subject' => ['required', 'string', 'min:3', 'max:150'],
            'message' => ['required', 'string', 'min:10', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'validation.name_required',
            'name.string' => 'validation.name_invalid',
            'name.min' => 'validation.name_min',
            'name.max' => 'validation.name_max',
            'email.required' => 'validation.email_required',
            'email.string' => 'validation.email_invalid',
            'email.email' => 'validation.email_invalid',
            'email.max' => 'validation.email_max',
            'subject.required' => 'validation.subject_required',
            'subject.string' => 'validation.subject_invalid',
            'subject.min' => 'validation.subject_min',
            'subject.max' => 'validation.subject_max',
            'message.required' => 'validation.message_required',
            'message.string' => 'validation.message_invalid',
            'message.min' => 'validation.message_min',
            'message.max' => 'validation.message_max',
        ];
    }
}
