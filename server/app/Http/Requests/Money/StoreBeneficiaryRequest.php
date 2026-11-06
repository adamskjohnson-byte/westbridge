<?php

namespace App\Http\Requests\Money;

use Illuminate\Foundation\Http\FormRequest;

class StoreBeneficiaryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'account_number' => ['required', 'string', 'regex:/^\d{10}$/'],
            'nickname' => ['sometimes', 'nullable', 'string', 'max:80'],
        ];
    }

    public function messages(): array
    {
        return [
            'account_number.required' => 'validation.account_number_required',
            'account_number.regex' => 'validation.account_number_invalid',
            'nickname.max' => 'validation.nickname_max',
        ];
    }
}
