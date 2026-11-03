<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreNewsletterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email:rfc', 'max:254'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required' => 'validation.email_required',
            'email.string' => 'validation.email_invalid',
            'email.email' => 'validation.email_invalid',
            'email.max' => 'validation.email_max',
        ];
    }
}
