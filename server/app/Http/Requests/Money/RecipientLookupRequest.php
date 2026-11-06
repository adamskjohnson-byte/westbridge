<?php

namespace App\Http\Requests\Money;

use Illuminate\Foundation\Http\FormRequest;

class RecipientLookupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['account_number' => ['required', 'string', 'regex:/^\d{10}$/']];
    }

    public function messages(): array
    {
        return [
            'account_number.required' => 'validation.account_number_required',
            'account_number.regex' => 'validation.account_number_invalid',
        ];
    }
}
